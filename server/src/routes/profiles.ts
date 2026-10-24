import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { currentUser } from '../middleware/auth.js'
import {
  idParamsSchema,
  profileGenerateSchema,
  profileListQuery,
  profileUpdateSchema,
} from '../schemas/index.js'
import {
  confirmProfile,
  generateProfile,
  getProfile,
  listProfileHistory,
  listProfiles,
  updateProfile,
} from '../services/profiles.js'
import { getLearner } from '../services/learners.js'
import { buildPaginationMeta, resolvePagination } from '../utils/pagination.js'
import { serializeProfile } from '../utils/serializers.js'
import { sendCreated, sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

interface LearnerParams {
  id: string
}

export async function profileRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  const listAll = async (
    request: FastifyRequest<{ Querystring: z.infer<typeof profileListQuery> }>,
    reply: FastifyReply,
  ) => {
    const query = request.query
    const pagination = resolvePagination(query)
    const { items, total } = await listProfiles(deps.prisma, {
      learnerId: query.learnerId,
      status: query.status,
      ...pagination,
    })
    return sendData(
      reply,
      items.map(serializeProfile),
      buildPaginationMeta(total, pagination),
    )
  }

  const listForLearner = async (
    request: FastifyRequest<{ Params: LearnerParams }>,
    reply: FastifyReply,
  ) => {
    await getLearner(deps.prisma, request.params.id)
    const pagination = resolvePagination({})
    const { items, total } = await listProfiles(deps.prisma, {
      learnerId: request.params.id,
      ...pagination,
    })
    return sendData(
      reply,
      items.map(serializeProfile),
      buildPaginationMeta(total, pagination),
    )
  }

  const generateForLearner = async (
    request: FastifyRequest<{
      Params: LearnerParams
      Body: z.infer<typeof profileGenerateSchema>
    }>,
    reply: FastifyReply,
  ) => {
    const actor = currentUser(request)
    const profile = await generateProfile(
      deps.prisma,
      deps.providers,
      request.params.id,
      request.body,
      actor.id,
    )
    return sendCreated(reply, serializeProfile(profile))
  }

  server.get(
    '/profiles',
    {
      schema: {
        tags: ['能力画像'],
        summary: '能力画像列表',
        querystring: profileListQuery,
      },
      preHandler: deps.requireAuth,
    },
    listAll,
  )

  server.get(
    '/learners/:id/profiles',
    {
      schema: {
        tags: ['能力画像'],
        summary: '指定学员的能力画像',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    listForLearner,
  )

  server.post(
    '/learners/:id/profiles',
    {
      schema: {
        tags: ['能力画像'],
        summary: '生成能力画像',
        description:
          '通过配置的能力分析 Provider 生成。默认 mock Provider 的结果会标注为演示数据；未配置真实 Provider 时返回 PROVIDER_NOT_CONFIGURED。',
        params: idParamsSchema,
        body: profileGenerateSchema,
      },
      preHandler: deps.requireAuth,
    },
    generateForLearner,
  )

  server.get(
    '/profiles/:id',
    {
      schema: {
        tags: ['能力画像'],
        summary: '能力画像详情',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const profile = await getProfile(deps.prisma, request.params.id)
      return sendData(reply, serializeProfile(profile))
    },
  )

  server.patch(
    '/profiles/:id',
    {
      schema: {
        tags: ['能力画像'],
        summary: '修改能力画像',
        description: '修改后的画像会恢复为待确认状态，需要重新确认。',
        params: idParamsSchema,
        body: profileUpdateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const profile = await updateProfile(
        deps.prisma,
        request.params.id,
        request.body,
        actor.id,
      )
      return sendData(reply, serializeProfile(profile))
    },
  )

  server.post(
    '/profiles/:id/confirm',
    {
      schema: {
        tags: ['能力画像'],
        summary: '确认能力画像',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const profile = await confirmProfile(deps.prisma, request.params.id, actor.id)
      return sendData(reply, serializeProfile(profile))
    },
  )

  server.get(
    '/profiles/:id/history',
    {
      schema: {
        tags: ['能力画像'],
        summary: '能力画像历史记录',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const revisions = await listProfileHistory(deps.prisma, request.params.id)
      return sendData(
        reply,
        revisions.map((revision) => ({
          id: revision.id,
          revision: revision.revision,
          action: revision.action,
          snapshot: revision.snapshot,
          note: revision.note,
          createdAt: revision.createdAt.toISOString(),
          actorName: revision.createdBy?.displayName,
        })),
      )
    },
  )

  /* ------------------- compatibility aliases for older clients ------------------- */

  server.get(
    '/ability-profiles',
    {
      schema: {
        tags: ['能力画像'],
        summary: '能力画像列表（兼容别名）',
        querystring: profileListQuery,
      },
      preHandler: deps.requireAuth,
    },
    listAll,
  )

  server.get(
    '/learners/:id/ability-profiles',
    {
      schema: {
        tags: ['能力画像'],
        summary: '指定学员的能力画像（兼容别名）',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    listForLearner,
  )

  server.post(
    '/learners/:id/ability-profile/generate',
    {
      schema: {
        tags: ['能力画像'],
        summary: '生成能力画像（兼容别名）',
        params: idParamsSchema,
        body: profileGenerateSchema,
      },
      preHandler: deps.requireAuth,
    },
    generateForLearner,
  )

  server.patch(
    '/ability-profiles/:id',
    {
      schema: {
        tags: ['能力画像'],
        summary: '修改能力画像（兼容别名）',
        params: idParamsSchema,
        body: profileUpdateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const profile = await updateProfile(
        deps.prisma,
        request.params.id,
        request.body as z.infer<typeof profileUpdateSchema>,
        actor.id,
      )
      return sendData(reply, serializeProfile(profile))
    },
  )

  server.post(
    '/ability-profiles/:id/confirm',
    {
      schema: {
        tags: ['能力画像'],
        summary: '确认能力画像（兼容别名）',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const profile = await confirmProfile(deps.prisma, request.params.id, actor.id)
      return sendData(reply, serializeProfile(profile))
    },
  )
}
