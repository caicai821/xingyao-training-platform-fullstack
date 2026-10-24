import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { z } from 'zod'

const boolFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173'),
  PUBLIC_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DOCS_ENABLED: boolFromString.default(true),

  SESSION_COOKIE_NAME: z.string().default('qicheng_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(24 * 7),
  COOKIE_SECURE: boolFromString.optional(),
  SESSION_SLIDING: boolFromString.default(false),

  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(10),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(15),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(50 * 1024 * 1024).default(2 * 1024 * 1024),
  UPLOAD_SIGNING_SECRET: z.string().optional(),
  UPLOAD_SIGNED_URL_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),

  SCRIPT_PROVIDER: z.enum(['mock', 'real']).default('mock'),
  PROFILE_PROVIDER: z.enum(['mock', 'real']).default('mock'),
  SCENE_PROVIDER: z.enum(['mock', 'real']).default('mock'),
  SCRIPT_PROVIDER_URL: z.string().optional(),
  SCRIPT_PROVIDER_TOKEN: z.string().optional(),
  PROFILE_PROVIDER_URL: z.string().optional(),
  PROFILE_PROVIDER_TOKEN: z.string().optional(),
  SCENE_PROVIDER_URL: z.string().optional(),
  SCENE_PROVIDER_TOKEN: z.string().optional(),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),

  MOCK_SCENE_QUEUE_MS: z.coerce.number().int().min(0).max(600000).default(1500),
  MOCK_SCENE_GENERATE_MS: z.coerce.number().int().min(0).max(600000).default(5000),
  TASK_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60000).default(1000),
  ENABLE_TASK_RUNNER: boolFromString.default(true),
})

export type ProviderMode = 'mock' | 'real'

export interface ProviderConfig {
  mode: ProviderMode
  url?: string
  token?: string
  timeoutMs: number
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  host: string
  databaseUrl: string
  corsOrigins: string[]
  publicBaseUrl: string
  logLevel: string
  docsEnabled: boolean
  sessionCookieName: string
  sessionTtlMs: number
  cookieSecure: boolean
  sessionSliding: boolean
  loginMaxAttempts: number
  loginRateLimitMax: number
  loginLockMs: number
  uploadDir: string
  maxUploadBytes: number
  uploadSigningSecret: string
  uploadSignedUrlTtlMs: number
  scriptProvider: ProviderConfig
  profileProvider: ProviderConfig
  sceneProvider: ProviderConfig
  mockSceneQueueMs: number
  mockSceneGenerateMs: number
  taskPollIntervalMs: number
  enableTaskRunner: boolean
}

export type ConfigOverrides = Partial<Record<keyof z.infer<typeof rawSchema>, string>>

export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const merged: Record<string, unknown> = { ...process.env, ...overrides }
  const parsed = rawSchema.safeParse(merged)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ')
    throw new Error(`环境变量配置无效：${detail}`)
  }
  const env = parsed.data
  const publicBaseUrl =
    env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    databaseUrl: env.DATABASE_URL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
    logLevel: env.LOG_LEVEL,
    docsEnabled: env.DOCS_ENABLED,
    sessionCookieName: env.SESSION_COOKIE_NAME,
    sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    sessionSliding: env.SESSION_SLIDING,
    loginMaxAttempts: env.LOGIN_MAX_ATTEMPTS,
    loginRateLimitMax: env.LOGIN_RATE_LIMIT_MAX,
    loginLockMs: env.LOGIN_LOCK_MINUTES * 60 * 1000,
    uploadDir: path.resolve(process.cwd(), env.UPLOAD_DIR),
    maxUploadBytes: env.MAX_UPLOAD_BYTES,
    uploadSigningSecret:
      env.UPLOAD_SIGNING_SECRET?.trim() || randomBytes(32).toString('hex'),
    uploadSignedUrlTtlMs: env.UPLOAD_SIGNED_URL_TTL_MINUTES * 60 * 1000,
    scriptProvider: {
      mode: env.SCRIPT_PROVIDER,
      url: env.SCRIPT_PROVIDER_URL,
      token: env.SCRIPT_PROVIDER_TOKEN,
      timeoutMs: env.PROVIDER_TIMEOUT_MS,
    },
    profileProvider: {
      mode: env.PROFILE_PROVIDER,
      url: env.PROFILE_PROVIDER_URL,
      token: env.PROFILE_PROVIDER_TOKEN,
      timeoutMs: env.PROVIDER_TIMEOUT_MS,
    },
    sceneProvider: {
      mode: env.SCENE_PROVIDER,
      url: env.SCENE_PROVIDER_URL,
      token: env.SCENE_PROVIDER_TOKEN,
      timeoutMs: env.PROVIDER_TIMEOUT_MS,
    },
    mockSceneQueueMs: env.MOCK_SCENE_QUEUE_MS,
    mockSceneGenerateMs: env.MOCK_SCENE_GENERATE_MS,
    taskPollIntervalMs: env.TASK_POLL_INTERVAL_MS,
    enableTaskRunner: env.ENABLE_TASK_RUNNER,
  }
}

export function isProviderConfigured(provider: ProviderConfig): boolean {
  return provider.mode === 'mock' || Boolean(provider.url && provider.token)
}
