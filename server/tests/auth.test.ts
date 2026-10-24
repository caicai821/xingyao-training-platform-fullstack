import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clearLoginAttempts } from '../src/services/auth.js'
import {
  authHeaders,
  createApp,
  createPrisma,
  login,
  resetDatabase,
  seedUsers,
  TEST_PASSWORD,
} from './helpers.js'

describe('auth and permissions', () => {
  let prisma: PrismaClient
  let app: FastifyInstance

  beforeAll(async () => {
    prisma = createPrisma()
    const created = await createApp(prisma)
    app = created.app
  })

  beforeEach(async () => {
    clearLoginAttempts()
    await resetDatabase(prisma)
    await seedUsers(prisma)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('reports health without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.status).toBe('ok')
    expect(body.data.database).toBe('ok')
    expect(body.data.generation.scene.mode).toBe('mock')
    expect(body.data.generation.scene.configured).toBe(true)
  })

  it('rejects unauthenticated business requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/learners' })
    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe('AUTH_REQUIRED')
  })

  it('rejects invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'wrong-password' },
    })
    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS')
  })

  it('logs in with a secure cookie and can log out', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: TEST_PASSWORD },
    })
    expect(response.statusCode).toBe(200)
    const setCookie = response.headers['set-cookie']
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : String(setCookie)
    expect(cookieHeader).toContain('qicheng_session=')
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('SameSite=Lax')

    const cookie = await login(app)
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: authHeaders(cookie),
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().data.user.username).toBe('admin')
    expect(me.json().data.user.role).toBe('ADMIN')

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: authHeaders(cookie),
    })
    expect(logout.statusCode).toBe(200)

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: authHeaders(cookie),
    })
    expect(after.statusCode).toBe(401)
  })

  it('enforces role checks on the server', async () => {
    const guideCookie = await login(app, 'guide')
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/learners',
      headers: authHeaders(guideCookie),
      payload: {
        name: '权限测试学员',
        ageGroup: '6-8 岁',
        status: 'active',
        traits: [],
        interests: [],
        communicationStyle: '',
        promptPreference: '',
        environmentNotes: '',
        currentGoalText: '',
        notes: '',
      },
    })
    expect(created.statusCode).toBe(201)
    const learnerId = created.json().data.id

    const denied = await app.inject({
      method: 'DELETE',
      url: `/api/v1/learners/${learnerId}`,
      headers: authHeaders(guideCookie),
    })
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.code).toBe('FORBIDDEN')

    const adminCookie = await login(app)
    const archived = await app.inject({
      method: 'DELETE',
      url: `/api/v1/learners/${learnerId}`,
      headers: authHeaders(adminCookie),
    })
    expect(archived.statusCode).toBe(200)
    expect(archived.json().data.status).toBe('archived')
  })

  it('locks repeated failed logins for the same account and IP', async () => {
    for (let index = 0; index < 5; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'admin', password: 'wrong-password' },
      })
      expect(response.statusCode).toBe(401)
    }
    const locked = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: TEST_PASSWORD },
    })
    expect(locked.statusCode).toBe(429)
    expect(locked.json().error.code).toBe('LOGIN_LOCKED')
    clearLoginAttempts()
  })
})
