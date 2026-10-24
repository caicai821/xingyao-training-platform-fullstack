import type { PrismaClient } from '@prisma/client'
import type { preHandlerAsyncHookHandler } from 'fastify'
import type { AppConfig } from '../config/env.js'
import type { Providers } from '../providers/index.js'

export interface RouteDeps {
  prisma: PrismaClient
  config: AppConfig
  providers: Providers
  requireAuth: preHandlerAsyncHookHandler
  requireAdminRole: preHandlerAsyncHookHandler
}
