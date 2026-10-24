import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { currentUser } from '../middleware/auth.js'
import {
  idParamsSchema,
  scriptCreateSchema,
  scriptGenerateSchema,
  scriptListQuery,
  scriptRegenerateSchema,
  scriptUpdateQuery,
  scriptUpdateSchema,
} from '../schemas/index.js'
import {
  archiveScript,
  confirmScript,
  createScript,
  duplicateScript,
  generateScript,
  getScript,
  listScriptVersions,
  listScripts,
  regenerateScript,
  updateScript,
} from '../services/scripts.js'
import { buildPaginationMeta, resolvePagination } from '../utils/pagination.js'
import { serializeScript } from '../utils/serializers.js'
import { sendCreated, sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

export async function scriptRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/training-scripts',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '训练脚本列表',
        querystring: scriptListQuery,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const pagination = resolvePagination(request.query)
      const { items, total } = await listScripts(deps.prisma, {
        learnerId: request.query.learnerId,
        goalId: request.query.goalId,
        status: request.query.status,
        q: request.query.q,
        ...pagination,
      })
      return sendData(reply, items.map(serializeScript), buildPaginationMeta(total, pagination))
    },
  )

  server.post(
    '/training-scripts/generate',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '生成训练脚本',
        description:
          '通过配置的脚本生成 Provider 生成。默认 mock Provider 的结果标记为演示数据；真实 Provider 未配置时返回 PROVIDER_NOT_CONFIGURED。',
        body: scriptGenerateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await generateScript(deps.prisma, deps.providers, request.body, actor.id)
      return sendCreated(reply, serializeScript(script))
    },
  )

  server.post(
    '/training-scripts',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '手动创建训练脚本',
        body: scriptCreateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await createScript(deps.prisma, request.body, actor.id)
      return sendCreated(reply, serializeScript(script))
    },
  )

  server.get(
    '/training-scripts/:id',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '训练脚本详情（包含版本历史）',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const script = await getScript(deps.prisma, request.params.id)
      return sendData(reply, serializeScript(script))
    },
  )

  server.patch(
    '/training-scripts/:id',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '修改训练脚本',
        description:
          '修改内容会生成新的版本快照并递增版本号；已确认脚本被修改后需重新确认。',
        params: idParamsSchema,
        querystring: scriptUpdateQuery,
        body: scriptUpdateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await updateScript(
        deps.prisma,
        request.params.id,
        request.body,
        actor.id,
        request.query.versionNote,
      )
      return sendData(reply, serializeScript(script))
    },
  )

  server.post(
    '/training-scripts/:id/confirm',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '确认训练脚本',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await confirmScript(deps.prisma, request.params.id, actor.id)
      return sendData(reply, serializeScript(script))
    },
  )

  server.post(
    '/training-scripts/:id/generate',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '重新生成训练脚本',
        params: idParamsSchema,
        body: scriptRegenerateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await regenerateScript(
        deps.prisma,
        deps.providers,
        request.params.id,
        request.body,
        actor.id,
      )
      return sendData(reply, serializeScript(script))
    },
  )

  server.post(
    '/training-scripts/:id/regenerate',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '重新生成训练脚本（兼容别名）',
        params: idParamsSchema,
        body: scriptRegenerateSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await regenerateScript(
        deps.prisma,
        deps.providers,
        request.params.id,
        request.body,
        actor.id,
      )
      return sendData(reply, serializeScript(script))
    },
  )

  server.post(
    '/training-scripts/:id/duplicate',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '复制训练脚本',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await duplicateScript(deps.prisma, request.params.id, actor.id)
      return sendCreated(reply, serializeScript(script))
    },
  )

  server.post(
    '/training-scripts/:id/archive',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '归档训练脚本',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const actor = currentUser(request)
      const script = await archiveScript(deps.prisma, request.params.id, actor.id)
      return sendData(reply, serializeScript(script))
    },
  )

  server.get(
    '/training-scripts/:id/versions',
    {
      schema: {
        tags: ['训练脚本'],
        summary: '训练脚本版本历史',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const versions = await listScriptVersions(deps.prisma, request.params.id)
      return sendData(
        reply,
        versions.map((version) => ({
          id: version.id,
          version: version.version,
          savedAt: version.savedAt.toISOString(),
          name: version.name,
          objective: version.objective,
          scenarioSummary: version.scenarioSummary,
          steps: version.steps,
          note: version.note,
          actorName: version.createdBy?.displayName,
        })),
      )
    },
  )
}
