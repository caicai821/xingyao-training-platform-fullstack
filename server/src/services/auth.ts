import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient, User } from '@prisma/client'
import type { AppConfig } from '../config/env.js'
import { AppError, authRequired, sessionExpired } from '../utils/errors.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import type { LoginInput } from '../schemas/index.js'

export interface AuthUser {
  id: string
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
  status: 'ACTIVE' | 'DISABLED'
}

export interface LoginMeta {
  ipAddress?: string
  userAgent?: string
}

interface AttemptRecord {
  count: number
  lockedUntil: number
}

const loginAttempts = new Map<string, AttemptRecord>()
let dummyPasswordHash: string | null = null

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  }
}

async function getDummyHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await hashPassword(randomBytes(18).toString('base64url'))
  }
  return dummyPasswordHash
}

function attemptKey(username: string, meta: LoginMeta): string {
  return `${meta.ipAddress ?? 'unknown'}|${username.toLowerCase()}`
}

function registerFailure(key: string, config: AppConfig): void {
  const record = loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 }
  record.count += 1
  if (record.count >= config.loginMaxAttempts) {
    record.lockedUntil = Date.now() + config.loginLockMs
    record.count = 0
  }
  loginAttempts.set(key, record)
}

export async function login(
  prisma: PrismaClient,
  config: AppConfig,
  input: LoginInput,
  meta: LoginMeta,
): Promise<{ token: string; expiresAt: Date; user: AuthUser }> {
  const key = attemptKey(input.username, meta)
  const existing = loginAttempts.get(key)
  if (existing && existing.lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((existing.lockedUntil - Date.now()) / 60000))
    throw new AppError(
      429,
      'LOGIN_LOCKED',
      `登录尝试过多，请 ${minutes} 分钟后再试`,
    )
  }

  const user = await prisma.user.findUnique({ where: { username: input.username } })
  const passwordOk = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, await getDummyHash())

  if (!user || !passwordOk) {
    registerFailure(key, config)
    throw new AppError(401, 'INVALID_CREDENTIALS', '账号或密码不正确')
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_DISABLED', '该账号已被停用，请联系管理员')
  }

  loginAttempts.delete(key)
  await prisma.session.deleteMany({
    where: { userId: user.id, expiresAt: { lte: new Date() } },
  })

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionTtlMs)
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300),
      ipAddress: meta.ipAddress?.slice(0, 80),
    },
  })

  return { token, expiresAt, user: toAuthUser(user) }
}

export async function logout(
  prisma: PrismaClient,
  token: string | undefined,
): Promise<void> {
  if (!token) return
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
}

export async function authenticate(
  prisma: PrismaClient,
  config: AppConfig,
  token: string | undefined,
): Promise<{ user: AuthUser; sessionId: string }> {
  if (!token) throw authRequired()
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!session) throw sessionExpired()
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    throw sessionExpired()
  }
  if (session.user.status !== 'ACTIVE') {
    throw new AppError(403, 'ACCOUNT_DISABLED', '该账号已被停用，请联系管理员')
  }

  const now = new Date()
  const stale = now.getTime() - session.lastUsedAt.getTime() > 5 * 60 * 1000
  if (stale) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: {
          lastUsedAt: now,
          ...(config.sessionSliding
            ? { expiresAt: new Date(now.getTime() + config.sessionTtlMs) }
            : {}),
        },
      })
      .catch(() => undefined)
  }

  return { user: toAuthUser(session.user), sessionId: session.id }
}

export async function createUser(
  prisma: PrismaClient,
  input: {
    username: string
    password: string
    displayName: string
    role: 'ADMIN' | 'USER'
  },
): Promise<AuthUser> {
  const existing = await prisma.user.findUnique({ where: { username: input.username } })
  if (existing) throw new AppError(409, 'CONFLICT', '该账号已存在')
  const user = await prisma.user.create({
    data: {
      username: input.username,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      role: input.role,
    },
  })
  return toAuthUser(user)
}

export async function listUsers(prisma: PrismaClient): Promise<AuthUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
  return users.map(toAuthUser)
}

export function clearLoginAttempts(): void {
  loginAttempts.clear()
}
