import type { CookieSerializeOptions } from '@fastify/cookie'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { createUserSchema, loginSchema } from '../schemas/index.js'
import {
  createUser,
  listUsers,
  login,
  logout,
} from '../services/auth.js'
import { serializeUser } from '../utils/serializers.js'
import { currentUser } from '../middleware/auth.js'
import { sendCreated, sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

function cookieOptions(deps: RouteDeps): CookieSerializeOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: deps.config.cookieSecure,
    maxAge: Math.floor(deps.config.sessionTtlMs / 1000),
  }
}

export async function authRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.post(
    '/auth/login',
    {
      schema: {
        tags: ['身份验证'],
        summary: '登录',
        body: loginSchema,
      },
      config: {
        rateLimit: {
          max: deps.config.loginRateLimitMax,
          timeWindow: '15 minutes',
          keyGenerator: (request) => request.ip,
        },
      },
    },
    async (request, reply) => {
      const result = await login(deps.prisma, deps.config, request.body, {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      })
      reply.setCookie(
        deps.config.sessionCookieName,
        result.token,
        cookieOptions(deps),
      )
      return sendData(reply, {
        user: serializeUser(result.user),
        expiresAt: result.expiresAt.toISOString(),
      })
    },
  )

  server.post(
    '/auth/logout',
    {
      schema: {
        tags: ['身份验证'],
        summary: '退出登录',
      },
    },
    async (request, reply) => {
      await logout(deps.prisma, request.cookies[deps.config.sessionCookieName])
      reply.clearCookie(deps.config.sessionCookieName, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: deps.config.cookieSecure,
      })
      return sendData(reply, { ok: true })
    },
  )

  server.get(
    '/auth/me',
    {
      schema: { tags: ['身份验证'], summary: '当前登录用户' },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const user = currentUser(request)
      return sendData(reply, { user: serializeUser(user) })
    },
  )

  server.get(
    '/users',
    {
      schema: { tags: ['用户管理'], summary: '用户列表（管理员）' },
      preHandler: [deps.requireAuth, deps.requireAdminRole],
    },
    async (_request, reply) => {
      const users = await listUsers(deps.prisma)
      return sendData(reply, users.map((user) => serializeUser(user)))
    },
  )

  server.post(
    '/users',
    {
      schema: {
        tags: ['用户管理'],
        summary: '创建用户（管理员）',
        body: createUserSchema,
      },
      preHandler: [deps.requireAuth, deps.requireAdminRole],
    },
    async (request, reply) => {
      const user = await createUser(deps.prisma, request.body)
      return sendCreated(reply, serializeUser(user))
    },
  )

  server.get(
    '/auth/permissions',
    {
      schema: { tags: ['身份验证'], summary: '当前用户权限说明' },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const user = currentUser(request)
      return sendData(reply, {
        role: user.role,
        canManageUsers: user.role === 'ADMIN',
        canArchiveLearners: user.role === 'ADMIN',
        canWriteTrainingData: ['ADMIN', 'USER'].includes(user.role),
      })
    },
  )
}
