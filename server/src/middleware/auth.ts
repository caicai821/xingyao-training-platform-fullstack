import type { PrismaClient } from '@prisma/client'
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import type { AppConfig } from '../config/env.js'
import { authenticate, type AuthUser } from '../services/auth.js'
import { authRequired, forbidden } from '../utils/errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser
    sessionId?: string
  }
}

export function createRequireAuth(
  prisma: PrismaClient,
  config: AppConfig,
): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = request.cookies[config.sessionCookieName]
    const session = await authenticate(prisma, config, token)
    request.authUser = session.user
    request.sessionId = session.sessionId
  }
}

export function requireRole(role: 'ADMIN' | 'USER'): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest) => {
    if (!request.authUser) throw authRequired()
    if (request.authUser.role !== role) throw forbidden()
  }
}

export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.authUser) throw authRequired()
  return request.authUser
}
