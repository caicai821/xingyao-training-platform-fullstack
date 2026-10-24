import type { FastifyReply } from 'fastify'
import type { PaginationMeta } from '../utils/pagination.js'

export function sendData<T>(reply: FastifyReply, data: T, meta?: PaginationMeta) {
  return reply.send(meta ? { data, meta } : { data })
}

export function sendCreated<T>(reply: FastifyReply, data: T) {
  return reply.code(201).send({ data })
}
