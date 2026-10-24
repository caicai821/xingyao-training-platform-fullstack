import { LearnerStatus, Prisma, type PrismaClient } from '@prisma/client'
import type { LearnerCreateInput, LearnerUpdateInput } from '../schemas/index.js'
import { conflict, notFound } from '../utils/errors.js'
import { nextCode } from '../utils/codes.js'
import { addActivity, requireLearner } from './activities.js'

const statusMap = {
  active: LearnerStatus.ACTIVE,
  paused: LearnerStatus.PAUSED,
  archived: LearnerStatus.ARCHIVED,
} as const

export interface LearnerListParams {
  q?: string
  status?: 'active' | 'paused' | 'archived'
  includeArchived?: boolean
  page: number
  pageSize: number
}

export async function listLearners(prisma: PrismaClient, params: LearnerListParams) {
  const where: Prisma.LearnerWhereInput = {}
  if (params.status) {
    where.status = statusMap[params.status]
  } else if (params.includeArchived === false) {
    where.status = { not: LearnerStatus.ARCHIVED }
  }
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { code: { contains: params.q, mode: 'insensitive' } },
      { nickname: { contains: params.q, mode: 'insensitive' } },
      { currentGoalText: { contains: params.q, mode: 'insensitive' } },
    ]
  }

  const [total, items] = await prisma.$transaction([
    prisma.learner.count({ where }),
    prisma.learner.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ])
  return { items, total }
}

export async function getLearner(prisma: PrismaClient, id: string) {
  const learner = await prisma.learner.findUnique({ where: { id } })
  if (!learner) throw notFound('未找到对应的学员档案')
  return learner
}

export async function createLearner(
  prisma: PrismaClient,
  input: LearnerCreateInput,
  actorId: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const codes = await prisma.learner.findMany({ select: { code: true } })
    const code = nextCode(
      codes.map((item) => item.code),
      `XS-${new Date().getFullYear()}`,
    )
    try {
      return await prisma.$transaction(async (tx) => {
        const learner = await tx.learner.create({
          data: {
            code,
            name: input.name,
            nickname: input.nickname?.trim() || null,
            ageGroup: input.ageGroup,
            status: statusMap[input.status],
            traits: input.traits,
            interests: input.interests,
            communicationStyle: input.communicationStyle,
            promptPreference: input.promptPreference,
            environmentNotes: input.environmentNotes,
            currentGoalText: input.currentGoalText,
            notes: input.notes,
            createdById: actorId,
          },
        })
        await addActivity(tx, {
          type: 'LEARNER',
          title: '学员档案已创建',
          detail: `${learner.name} · ${learner.code}`,
          link: `/learners/${learner.id}`,
          actorId,
        })
        return learner
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }
  throw conflict('学员编号生成失败，请稍后重试')
}

export async function updateLearner(
  prisma: PrismaClient,
  id: string,
  input: LearnerUpdateInput,
  actorId: string,
) {
  const existing = await requireLearner(prisma, id, { allowArchived: true })
  const data: Prisma.LearnerUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.nickname !== undefined) data.nickname = input.nickname.trim() || null
  if (input.ageGroup !== undefined) data.ageGroup = input.ageGroup
  if (input.status !== undefined) {
    data.status = statusMap[input.status]
    data.archivedAt = input.status === 'archived' ? (existing.archivedAt ?? new Date()) : null
  }
  if (input.traits !== undefined) data.traits = input.traits
  if (input.interests !== undefined) data.interests = input.interests
  if (input.communicationStyle !== undefined) data.communicationStyle = input.communicationStyle
  if (input.promptPreference !== undefined) data.promptPreference = input.promptPreference
  if (input.environmentNotes !== undefined) data.environmentNotes = input.environmentNotes
  if (input.currentGoalText !== undefined) data.currentGoalText = input.currentGoalText
  if (input.notes !== undefined) data.notes = input.notes

  return prisma.$transaction(async (tx) => {
    const learner = await tx.learner.update({ where: { id }, data })
    await addActivity(tx, {
      type: 'LEARNER',
      title: '学员档案已更新',
      detail: learner.name,
      link: `/learners/${learner.id}`,
      actorId,
    })
    return learner
  })
}

export async function archiveLearner(
  prisma: PrismaClient,
  id: string,
  actorId: string,
) {
  const learner = await requireLearner(prisma, id, { allowArchived: true })
  if (learner.status === 'ARCHIVED') return learner
  return prisma.$transaction(async (tx) => {
    const archived = await tx.learner.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
    await addActivity(tx, {
      type: 'LEARNER',
      title: '学员档案已归档',
      detail: archived.name,
      link: `/learners/${archived.id}`,
      actorId,
    })
    return archived
  })
}
