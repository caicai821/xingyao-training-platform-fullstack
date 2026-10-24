import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { currentUser } from '../middleware/auth.js'
import {
  assetListQuery,
  assetUpdateSchema,
  idParamsSchema,
  sceneTaskCreateSchema,
  sceneTaskListQuery,
} from '../schemas/index.js'
import {
  archiveAsset,
  getAsset,
  getAssetByTask,
  listAssets,
  updateAsset,
} from '../services/assets.js'
import {
  createTask,
  getTask,
  listTasks,
  retryTask,
  submitTask,
} from '../services/tasks.js'
import { buildPaginationMeta, resolvePagination } from '../utils/pagination.js'
import { serializeAsset, serializeTask } from '../utils/serializers.js'
import { sendCreated, sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

export async function sceneRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()
  const serializerOptions = { publicBaseUrl: deps.config.publicBaseUrl }

  server.get(
    '/scene-tasks',
    {
      schema: {
        tags: ['场景任务'],
        summary: '场景任务列表',
        querystring: sceneTaskListQuery,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const pagination = resolvePagination(request.query)
      const { items, total } = await listTasks(deps.prisma, {
        q: request.query.q,
        status: request.query.status,
        learnerId: request.query.learnerId,
        scriptId: request.query.scriptId,
        sourceType: request.query.sourceType,
        ...pagination,
      })
      return sendData(
        reply,
        items.map((task) => serializeTask(task, serializerOptions)),
        buildPaginationMeta(total, pagination),
      )
    },
  )

  server.post(
    '/scene-tasks',
    {
      schema: {
        tags: ['场景任务'],
        summary: '创建场景任务',
        description:
          '任务会持久化到数据库。submit=true 时立即进入生成队列；真实场景 Provider 未配置时返回 PROVIDER_NOT_CONFIGURED，不会伪造成功结果。',
        body: sceneTaskCreateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const task = await createTask(deps.prisma, deps.config, request.body, actor.id)
      return sendCreated(reply, serializeTask(task, serializerOptions))
    },
  )

  server.get(
    '/scene-tasks/:id',
    {
      schema: {
        tags: ['场景任务'],
        summary: '场景任务详情（含最新状态）',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const task = await getTask(deps.prisma, request.params.id)
      return sendData(reply, serializeTask(task, serializerOptions))
    },
  )

  server.post(
    '/scene-tasks/:id/submit',
    {
      schema: {
        tags: ['场景任务'],
        summary: '提交草稿任务',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const task = await submitTask(deps.prisma, deps.config, request.params.id, actor.id)
      return sendData(reply, serializeTask(task, serializerOptions))
    },
  )

  server.post(
    '/scene-tasks/:id/retry',
    {
      schema: {
        tags: ['场景任务'],
        summary: '重试失败任务',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const task = await retryTask(deps.prisma, deps.config, request.params.id, actor.id)
      return sendData(reply, serializeTask(task, serializerOptions))
    },
  )

  server.get(
    '/scene-tasks/:id/asset',
    {
      schema: {
        tags: ['场景任务'],
        summary: '查询任务生成的场景资产',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const asset = await getAssetByTask(deps.prisma, request.params.id)
      return sendData(reply, serializeAsset(asset, serializerOptions))
    },
  )

  server.get(
    '/scene-assets',
    {
      schema: {
        tags: ['场景资产'],
        summary: '场景资产列表（分页、搜索、筛选）',
        querystring: assetListQuery,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const pagination = resolvePagination(request.query)
      const { items, total } = await listAssets(deps.prisma, {
        q: request.query.q,
        learnerId: request.query.learnerId,
        scriptId: request.query.scriptId,
        taskId: request.query.taskId,
        includeArchived: request.query.includeArchived === 'true',
        ...pagination,
      })
      return sendData(
        reply,
        items.map((asset) => serializeAsset(asset, serializerOptions)),
        buildPaginationMeta(total, pagination),
      )
    },
  )

  server.get(
    '/scene-assets/:id',
    {
      schema: {
        tags: ['场景资产'],
        summary: '场景资产详情',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const asset = await getAsset(deps.prisma, request.params.id)
      return sendData(reply, serializeAsset(asset, serializerOptions))
    },
  )

  server.patch(
    '/scene-assets/:id',
    {
      schema: {
        tags: ['场景资产'],
        summary: '更新场景资产基础信息',
        params: idParamsSchema,
        body: assetUpdateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const asset = await updateAsset(deps.prisma, request.params.id, request.body, actor.id)
      return sendData(reply, serializeAsset(asset, serializerOptions))
    },
  )

  server.post(
    '/scene-assets/:id/archive',
    {
      schema: {
        tags: ['场景资产'],
        summary: '归档场景资产',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const asset = await archiveAsset(deps.prisma, request.params.id, actor.id)
      return sendData(reply, serializeAsset(asset, serializerOptions))
    },
  )

  server.delete(
    '/scene-assets/:id',
    {
      schema: {
        tags: ['场景资产'],
        summary: '归档场景资产（受控删除）',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const asset = await archiveAsset(deps.prisma, request.params.id, actor.id)
      return sendData(reply, serializeAsset(asset, serializerOptions))
    },
  )
}
