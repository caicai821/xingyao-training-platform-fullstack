import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { activityListQuery } from '../schemas/index.js'
import { listActivities } from '../services/activities.js'
import { serializeActivity } from '../utils/serializers.js'
import { sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

export async function activityRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/activities',
    {
      schema: {
        tags: ['动态记录'],
        summary: '最近业务动态',
        querystring: activityListQuery,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const activities = await listActivities(deps.prisma, request.query.limit)
      return sendData(reply, activities.map(serializeActivity))
    },
  )
}
