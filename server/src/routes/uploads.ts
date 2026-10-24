import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { currentUser } from '../middleware/auth.js'
import { authenticate } from '../services/auth.js'
import { verifyUploadSignature } from '../utils/signing.js'
import { idParamsSchema } from '../schemas/index.js'
import {
  createUploadReadStream,
  getUpload,
  getUploadContent,
  saveUpload,
} from '../services/uploads.js'
import { badRequest } from '../utils/errors.js'
import { serializeUpload } from '../utils/serializers.js'
import { sendCreated, sendData } from './helpers.js'
import type { RouteDeps } from './types.js'

function contentDisposition(filename: string, download: boolean): string {
  const encoded = encodeURIComponent(filename)
  return `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encoded}`
}

export async function uploadRoutes(app: FastifyInstance, deps: RouteDeps) {
  const server = app.withTypeProvider<ZodTypeProvider>()
  const serializerOptions = { publicBaseUrl: deps.config.publicBaseUrl }

  const requireContentAccess: preHandlerAsyncHookHandler = async (request) => {
    const query = request.query as { expires?: string; signature?: string }
    const params = request.params as { id: string }
    if (query.expires && query.signature) {
      const expiresAt = Number(query.expires)
      const valid = verifyUploadSignature(
        deps.config.uploadSigningSecret,
        params.id,
        expiresAt,
        query.signature,
      )
      if (valid) return
    }
    const token = request.cookies[deps.config.sessionCookieName]
    const session = await authenticate(deps.prisma, deps.config, token)
    request.authUser = session.user
    request.sessionId = session.sessionId
  }

  server.post(
    '/uploads',
    {
      schema: {
        tags: ['文件上传'],
        summary: '上传图片',
        description:
          '仅支持 JPG/PNG/WebP，默认最大 2 MB。服务端会校验文件内容签名并使用随机文件名存储，返回受控访问引用。',
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const part = await request.file()
      if (!part) throw badRequest('请选择要上传的图片文件')
      if (part.fieldname !== 'file' && part.fieldname !== 'image') {
        part.file.resume()
        throw badRequest('文件字段名应为 file')
      }
      const actor = currentUser(request)
      const file = await saveUpload(deps.prisma, deps.config, actor.id, part)
      return sendCreated(reply, serializeUpload(file, serializerOptions))
    },
  )

  server.get(
    '/uploads/:id',
    {
      schema: {
        tags: ['文件上传'],
        summary: '上传文件元数据',
        params: idParamsSchema,
      },
      preHandler: deps.requireAuth,
    },
    async (request, reply) => {
      const file = await getUpload(deps.prisma, request.params.id)
      return sendData(reply, serializeUpload(file, serializerOptions))
    },
  )

  server.get(
    '/uploads/:id/content',
    {
      schema: {
        tags: ['文件上传'],
        summary: '读取上传文件内容（登录会话或短期签名链接）',
        description:
          '登录用户可直接读取；外部生成服务可通过后端签发的短期签名 URL 读取，无需 Cookie。',
        params: idParamsSchema,
      },
      preHandler: requireContentAccess,
    },
    async (request, reply) => {
      const download = (request.query as { download?: string } | undefined)?.download === '1'
      const { file, absolutePath } = await getUploadContent(
        deps.prisma,
        deps.config,
        request.params.id,
      )
      reply
        .type(file.mimeType)
        .header('Content-Length', String(file.size))
        .header('Content-Disposition', contentDisposition(file.originalName, download))
        .header('Cache-Control', 'private, max-age=300')
        .header('X-Content-Type-Options', 'nosniff')
      return reply.send(createUploadReadStream(absolutePath))
    },
  )
}
