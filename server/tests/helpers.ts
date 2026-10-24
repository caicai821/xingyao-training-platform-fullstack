import { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { loadConfig, type AppConfig } from '../src/config/env.js'
import { createProviders, type Providers } from '../src/providers/index.js'
import { hashPassword } from '../src/utils/password.js'
import type { RunnerLogger } from '../src/services/taskRunner.js'

export const TEST_PASSWORD = 'test-password-123'

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      '缺少 TEST_DATABASE_URL。请先准备测试数据库（与开发库分离）并设置该环境变量。',
    )
  }
  return url
}

export function testConfig(overrides: Partial<Record<string, string>> = {}): AppConfig {
  return loadConfig({
    DATABASE_URL: testDatabaseUrl(),
    NODE_ENV: 'test',
    ENABLE_TASK_RUNNER: 'false',
    DOCS_ENABLED: 'false',
    UPLOAD_DIR: './.test-uploads',
    COOKIE_SECURE: 'false',
    MOCK_SCENE_QUEUE_MS: '0',
    MOCK_SCENE_GENERATE_MS: '0',
    TASK_POLL_INTERVAL_MS: '1000',
    LOG_LEVEL: 'silent',
    LOGIN_RATE_LIMIT_MAX: '1000',
    CORS_ORIGINS: 'http://localhost:5173',
    PUBLIC_BASE_URL: 'http://localhost:4000',
    ...overrides,
  })
}

export function createPrisma(url = testDatabaseUrl()): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } })
}

export async function createApp(
  prisma: PrismaClient,
  overrides: Partial<Record<string, string>> = {},
): Promise<{ app: FastifyInstance; config: AppConfig; providers: Providers }> {
  const config = testConfig(overrides)
  const providers = createProviders(config)
  const app = await buildApp({ config, prisma, startRunner: false, logger: false })
  await app.ready()
  return { app, config, providers }
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "scene_task_files","scene_assets","scene_tasks","script_versions","training_scripts","training_goals","ability_profile_revisions","ability_profiles","ability_assessments","learners","activities","upload_files","sessions","users" RESTART IDENTITY CASCADE',
  )
}

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hashPassword(TEST_PASSWORD)
  await prisma.user.createMany({
    data: [
      {
        username: 'admin',
        passwordHash,
        displayName: '测试管理员',
        role: 'ADMIN',
      },
      {
        username: 'guide',
        passwordHash,
        displayName: '测试指导',
        role: 'USER',
      },
    ],
  })
}

export async function login(
  app: FastifyInstance,
  username = 'admin',
  password = TEST_PASSWORD,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { username, password },
  })
  if (response.statusCode !== 200) {
    throw new Error(`login failed: ${response.statusCode} ${response.body}`)
  }
  const raw = response.headers['set-cookie']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) throw new Error('login response missing set-cookie')
  return value.split(';')[0]
}

export function authHeaders(cookie: string): Record<string, string> {
  return { cookie }
}

export const silentLogger: RunnerLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

export function multipart(
  content: Buffer,
  filename = 'reference.png',
  mimeType = 'image/png',
): { payload: Buffer; contentType: string } {
  const boundary = '----qicheng-test-boundary'
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([head, content, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
