import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { loadConfig, type AppConfig } from './config/env.js'
import { createRequireAuth, requireRole } from './middleware/auth.js'
import { createProviders } from './providers/index.js'
import { activityRoutes } from './routes/activities.js'
import { authRoutes } from './routes/auth.js'
import { goalRoutes } from './routes/goals.js'
import { healthRoutes } from './routes/health.js'
import { learnerRoutes } from './routes/learners.js'
import { profileRoutes } from './routes/profiles.js'
import { sceneRoutes } from './routes/scenes.js'
import { scriptRoutes } from './routes/scripts.js'
import { uploadRoutes } from './routes/uploads.js'
import { startTaskRunner, type RunnerLogger } from './services/taskRunner.js'
import {
  AppError,
  forbidden,
  isAppError,
} from './utils/errors.js'
import type { RouteDeps } from './routes/types.js'

export interface BuildAppOptions {
  config?: AppConfig
  prisma?: PrismaClient
  startRunner?: boolean
  logger?: boolean
}

export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig()
  const ownsPrisma = !options.prisma
  const prisma =
    options.prisma ??
    new PrismaClient({
      datasources: { db: { url: config.databaseUrl } },
      log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
    })

  if (ownsPrisma) {
    try {
      await prisma.$connect()
    } catch (error) {
      throw new Error(
        `数据库连接失败，请检查 DATABASE_URL 与数据库服务：${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  const providers = createProviders(config)
  const allowedOrigins = new Set(config.corsOrigins)
  try {
    allowedOrigins.add(new URL(config.publicBaseUrl).origin)
  } catch {
    // PUBLIC_BASE_URL is validated by config; ignore parsing edge cases.
  }

  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.logLevel,
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers["set-cookie"]',
            ],
          },
    genReqId: () => randomUUID(),
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: false,
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(cookie)
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  })
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
  })
  await app.register(multipart, {
    limits: {
      fileSize: config.maxUploadBytes,
      files: 1,
      fields: 8,
    },
  })

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id)
    const origin = request.headers.origin
    if (origin && !allowedOrigins.has(origin)) {
      throw forbidden('请求来源不在允许列表中')
    }
  })

  if (config.docsEnabled) {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: '启澄 · 3D 场景辅助训练系统 API',
          version: '0.1.0',
          description:
            '学员档案 → 能力画像 → 训练目标 → 训练脚本 → 场景任务 → 场景资产。除健康检查与登录外，所有接口均要求登录（HttpOnly Cookie 会话）。',
        },
        servers: [{ url: config.publicBaseUrl }],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: config.sessionCookieName,
            },
          },
        },
      },
      transform: jsonSchemaTransform,
    })
    await app.register(swaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    })
  }

  const deps: RouteDeps = {
    prisma,
    config,
    providers,
    requireAuth: createRequireAuth(prisma, config),
    requireAdminRole: requireRole('ADMIN'),
  }

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `未找到接口 ${request.method} ${request.url}`,
      },
      requestId: request.id,
    })
  })

  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id

    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, code: error.code }, 'request failed')
      }
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
        requestId,
      })
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const details = (error.validation ?? []).map((issue) => ({
        path: issue.instancePath,
        message: issue.message,
      }))
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: details[0]?.message
            ? `请求参数校验失败：${details[0].message}`
            : '请求参数校验失败',
          details,
        },
        requestId,
      })
    }

    const errorCode = (error as { code?: string }).code
    if (errorCode === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({
        error: { code: 'UPLOAD_TOO_LARGE', message: '上传文件超过大小限制' },
        requestId,
      })
    }
    if (errorCode === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
      return reply.code(415).send({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: '文件上传请求必须使用 multipart/form-data',
        },
        requestId,
      })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.code(409).send({
          error: { code: 'CONFLICT', message: '数据已存在，违反唯一性约束' },
          requestId,
        })
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '记录不存在或已被删除' },
          requestId,
        })
      }
      if (error.code === 'P2003') {
        return reply.code(409).send({
          error: { code: 'CONFLICT', message: '存在关联数据，无法完成该操作' },
          requestId,
        })
      }
    }

    if (errorCode === 'RATE_LIMITED' || (error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({
        error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
        requestId,
      })
    }

    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        error: {
          code: (errorCode as string) ?? 'REQUEST_ERROR',
          message: (error as Error).message,
        },
        requestId,
      })
    }

    request.log.error({ err: error }, 'unhandled request error')
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误，请稍后重试',
      },
      requestId,
    })
  })


  const routePlugins = [
    healthRoutes,
    authRoutes,
    learnerRoutes,
    profileRoutes,
    goalRoutes,
    scriptRoutes,
    sceneRoutes,
    uploadRoutes,
    activityRoutes,
  ]

  for (const plugin of routePlugins) {
    await app.register(plugin, { prefix: '/api/v1', ...deps })
  }

  let stopRunner: (() => void) | undefined
  if (options.startRunner ?? config.enableTaskRunner) {
    stopRunner = startTaskRunner(
      prisma,
      config,
      providers,
      app.log as unknown as RunnerLogger,
    )
  }

  app.addHook('onClose', async () => {
    stopRunner?.()
    if (ownsPrisma) await prisma.$disconnect()
  })

  return app
}

export type { AppError }
