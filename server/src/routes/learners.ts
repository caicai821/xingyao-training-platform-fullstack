import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { currentUser } from '../middleware/auth.js'
import {
  assessmentCreateSchema,
  idParamsSchema,
  learnerCreateSchema,
  learnerListQuery,
  learnerUpdateSchema,
} from '../schemas/index.js'
import {
  archiveLearner,
  createLearner,
  getLearner,
  listLearners,
  updateLearner,
} from '../services/learners.js'
import {
  listAssessments,
  saveAssessment,
} from '../services/profiles.js'
import { buildPaginationMeta, resolvePagination } from '../utils/pagination.js'
import {
  serializeAssessment,
  serializeLearner,
} from '../utils/serializers.js'
import { sendCreated, sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

export async function learnerRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/learners',
    {
      schema: {
        tags: ['学员档案'],
        summary: '学员列表（分页、搜索、状态筛选）',
        querystring: learnerListQuery,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const pagination = resolvePagination(request.query)
      const { items, total } = await listLearners(deps.prisma, {
        q: request.query.q,
        status: request.query.status,
        includeArchived: request.query.includeArchived !== 'false',
        ...pagination,
      })
      return sendData(
        reply,
        items.map(serializeLearner),
        buildPaginationMeta(total, pagination),
      )
    },
  )

  server.post(
    '/learners',
    {
      schema: {
        tags: ['学员档案'],
        summary: '创建学员档案',
        body: learnerCreateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const learner = await createLearner(deps.prisma, request.body, actor.id)
      return sendCreated(reply, serializeLearner(learner))
    },
  )

  server.get(
    '/learners/:id',
    {
      schema: {
        tags: ['学员档案'],
        summary: '学员详情',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const learner = await getLearner(deps.prisma, request.params.id)
      return sendData(reply, serializeLearner(learner))
    },
  )

  server.patch(
    '/learners/:id',
    {
      schema: {
        tags: ['学员档案'],
        summary: '更新学员档案',
        params: idParamsSchema,
        body: learnerUpdateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const learner = await updateLearner(
        deps.prisma,
        request.params.id,
        request.body,
        actor.id,
      )
      return sendData(reply, serializeLearner(learner))
    },
  )

  server.delete(
    '/learners/:id',
    {
      schema: {
        tags: ['学员档案'],
        summary: '归档学员档案（管理员）',
        description: '受控删除：仅归档档案及其关联历史，不物理删除数据。',
        params: idParamsSchema,
      },
      preHandler: [deps.requireAuth, deps.requireAdminRole],
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const learner = await archiveLearner(deps.prisma, request.params.id, actor.id)
      return sendData(reply, serializeLearner(learner))
    },
  )

  server.get(
    '/assessments',
    {
      schema: { tags: ['能力信息'], summary: '全部能力信息记录' },
      preHandler: deps.requireAuth,
    },
    async (_request, reply) => {
      const assessments = await listAssessments(deps.prisma)
      return sendData(reply, assessments.map(serializeAssessment))
    },
  )

  server.get(
    '/learners/:id/assessments',
    {
      schema: {
        tags: ['能力信息'],
        summary: '指定学员的能力信息记录',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      await getLearner(deps.prisma, request.params.id)
      const assessments = await listAssessments(deps.prisma, request.params.id)
      return sendData(reply, assessments.map(serializeAssessment))
    },
  )

  server.post(
    '/learners/:id/assessments',
    {
      schema: {
        tags: ['能力信息'],
        summary: '保存能力信息',
        params: idParamsSchema,
        body: assessmentCreateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const assessment = await saveAssessment(
        deps.prisma,
        request.params.id,
        request.body,
        actor.id,
      )
      return sendCreated(reply, serializeAssessment(assessment))
    },
  )
}
