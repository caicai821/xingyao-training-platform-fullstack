import type { Prisma, PrismaClient } from '@prisma/client'
import { conflict, notFound } from '../utils/errors.js'

export type Db = PrismaClient | Prisma.TransactionClient

export type ActivityKind =
  | 'LEARNER'
  | 'ASSESSMENT'
  | 'PROFILE'
  | 'GOAL'
  | 'SCRIPT'
  | 'TASK'
  | 'ASSET'

export async function addActivity(
  db: Db,
  input: {
    type: ActivityKind
    title: string
    detail?: string
    link?: string
    actorId?: string
  },
): Promise<void> {
  await db.activity.create({
    data: {
      type: input.type,
      title: input.title,
      detail: input.detail ?? '',
      link: input.link,
      actorId: input.actorId,
    },
  })
}

export async function listActivities(prisma: PrismaClient, limit: number) {
  return prisma.activity.findMany({
    include: { actor: true },
    orderBy: { at: 'desc' },
    take: limit,
  })
}

export async function requireLearner(
  db: Db,
  learnerId: string,
  options: { allowArchived?: boolean } = {},
) {
  const learner = await db.learner.findUnique({ where: { id: learnerId } })
  if (!learner) throw notFound('未找到对应的学员档案')
  if (!options.allowArchived && learner.status === 'ARCHIVED') {
    throw conflict('学员档案已归档，无法继续创建或修改关联数据')
  }
  return learner
}
