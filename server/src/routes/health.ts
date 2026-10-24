import type { FastifyInstance } from 'fastify'
import { isProviderConfigured } from '../config/env.js'
import type { RouteDeps } from './types.js'

export async function healthRoutes(app: FastifyInstance, deps: RouteDeps) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['系统'],
        summary: '健康检查与运行模式',
        description:
          '无需登录。返回数据库连接状态、数据模式与生成服务模式；不会暴露服务地址或令牌。',
      },
    },
    async (_request, reply) => {
      let database = 'ok'
      try {
        await deps.prisma.$queryRaw`SELECT 1`
      } catch {
        database = 'unavailable'
      }
      const generation = {
        script: {
          mode: deps.config.scriptProvider.mode,
          configured: isProviderConfigured(deps.config.scriptProvider),
        },
        profile: {
          mode: deps.config.profileProvider.mode,
          configured: isProviderConfigured(deps.config.profileProvider),
        },
        scene: {
          mode: deps.config.sceneProvider.mode,
          configured: isProviderConfigured(deps.config.sceneProvider),
        },
      }
      const healthy = database === 'ok'
      return reply.code(healthy ? 200 : 503).send({
        data: {
          status: healthy ? 'ok' : 'degraded',
          database,
          dataMode: 'api',
          generation,
          time: new Date().toISOString(),
          version: '0.1.0',
        },
      })
    },
  )
}
