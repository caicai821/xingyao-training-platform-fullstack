import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { currentUser } from '../middleware/auth.js'
import {
  goalCreateSchema,
  goalListQuery,
  goalStatusSchemaBody,
  goalUpdateSchema,
  idParamsSchema,
} from '../schemas/index.js'
import {
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
  updateGoalStatus,
} from '../services/goals.js'
import { buildPaginationMeta, resolvePagination } from '../utils/pagination.js'
import { serializeGoal } from '../utils/serializers.js'
import { sendCreated, sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

export async function goalRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/training-goals',
    {
      schema: {
        tags: ['训练目标'],
        summary: '训练目标列表',
        querystring: goalListQuery,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const pagination = resolvePagination(request.query)
      const { items, total } = await listGoals(deps.prisma, {
        learnerId: request.query.learnerId,
        profileId: request.query.profileId,
        status: request.query.status,
        q: request.query.q,
        ...pagination,
      })
      return sendData(reply, items.map(serializeGoal), buildPaginationMeta(total, pagination))
    },
  )

  server.post(
    '/training-goals',
    {
      schema: {
        tags: ['训练目标'],
        summary: '创建训练目标',
        body: goalCreateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const goal = await createGoal(deps.prisma, request.body, actor.id)
      return sendCreated(reply, serializeGoal(goal))
    },
  )

  server.get(
    '/training-goals/:id',
    {
      schema: {
        tags: ['训练目标'],
        summary: '训练目标详情',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const goal = await getGoal(deps.prisma, request.params.id)
      return sendData(reply, serializeGoal(goal))
    },
  )

  server.patch(
    '/training-goals/:id',
    {
      schema: {
        tags: ['训练目标'],
        summary: '修改训练目标',
        params: idParamsSchema,
        body: goalUpdateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const goal = await updateGoal(deps.prisma, request.params.id, request.body, actor.id)
      return sendData(reply, serializeGoal(goal))
    },
  )

  server.post(
    '/training-goals/:id/status',
    {
      schema: {
        tags: ['训练目标'],
        summary: '更新训练目标状态',
        params: idParamsSchema,
        body: goalStatusSchemaBody,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const goal = await updateGoalStatus(
        deps.prisma,
        request.params.id,
        request.body.status,
        actor.id,
      )
      return sendData(reply, serializeGoal(goal))
    },
  )

  server.post(
    '/training-goals/:id/archive',
    {
      schema: {
        tags: ['训练目标'],
        summary: '归档训练目标',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const goal = await updateGoalStatus(deps.prisma, request.params.id, 'archived', actor.id)
      return sendData(reply, serializeGoal(goal))
    },
  )
}
