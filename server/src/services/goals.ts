import {
  GoalPriority,
  GoalStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client'
import type { GoalCreateInput, GoalUpdateInput } from '../schemas/index.js'
import { badRequest, conflict, notFound } from '../utils/errors.js'
import { addActivity, requireLearner } from './activities.js'

const statusMap = {
  planning: GoalStatus.PLANNING,
  in_progress: GoalStatus.IN_PROGRESS,
  completed: GoalStatus.COMPLETED,
  archived: GoalStatus.ARCHIVED,
} as const

const priorityMap = {
  high: GoalPriority.HIGH,
  medium: GoalPriority.MEDIUM,
  low: GoalPriority.LOW,
} as const

function parseTargetDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) throw badRequest('目标日期格式不正确')
  return parsed
}

async function resolveProfile(
  prisma: PrismaClient,
  learnerId: string,
  profileId?: string,
) {
  if (profileId) {
    const profile = await prisma.abilityProfile.findUnique({ where: { id: profileId } })
    if (!profile || profile.learnerId !== learnerId) {
      throw notFound('所选能力画像不存在或不属于该学员')
    }
    if (profile.status !== 'CONFIRMED') {
      throw conflict('所选能力画像尚未确认，请先确认后再关联训练目标')
    }
    return profile
  }
  return prisma.abilityProfile.findFirst({
    where: { learnerId, status: 'CONFIRMED' },
    orderBy: { createdAt: 'desc' },
  })
}

export interface GoalListParams {
  learnerId?: string
  profileId?: string
  status?: 'planning' | 'in_progress' | 'completed' | 'archived'
  q?: string
  page: number
  pageSize: number
}

export async function listGoals(prisma: PrismaClient, params: GoalListParams) {
  const where: Prisma.TrainingGoalWhereInput = {}
  if (params.learnerId) where.learnerId = params.learnerId
  if (params.profileId) where.profileId = params.profileId
  if (params.status) where.status = statusMap[params.status]
  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: 'insensitive' } },
      { description: { contains: params.q, mode: 'insensitive' } },
    ]
  }
  const [total, items] = await prisma.$transaction([
    prisma.trainingGoal.count({ where }),
    prisma.trainingGoal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ])
  return { items, total }
}

export async function getGoal(prisma: PrismaClient, id: string) {
  const goal = await prisma.trainingGoal.findUnique({ where: { id } })
  if (!goal) throw notFound('未找到对应的训练目标')
  return goal
}

export async function createGoal(
  prisma: PrismaClient,
  input: GoalCreateInput,
  actorId: string,
) {
  const learner = await requireLearner(prisma, input.learnerId)
  const profile = await resolveProfile(prisma, input.learnerId, input.profileId)
  const targetDate = parseTargetDate(input.targetDate)

  return prisma.$transaction(async (tx) => {
    const goal = await tx.trainingGoal.create({
      data: {
        learnerId: input.learnerId,
        profileId: profile?.id,
        title: input.title,
        category: input.category,
        description: input.description,
        successCriteria: input.successCriteria,
        relatedDimensions: input.relatedDimensions,
        priority: priorityMap[input.priority],
        status: statusMap[input.status],
        targetDate: targetDate ?? null,
        archivedAt: input.status === 'archived' ? new Date() : null,
        createdById: actorId,
      },
    })
    await tx.learner.update({
      where: { id: input.learnerId },
      data: { currentGoalText: goal.title },
    })
    await addActivity(tx, {
      type: 'GOAL',
      title: '训练目标已创建',
      detail: `${learner.name} · ${goal.title}`,
      link: `/goals?learner=${learner.id}`,
      actorId,
    })
    return goal
  })
}

export async function updateGoal(
  prisma: PrismaClient,
  id: string,
  input: GoalUpdateInput,
  actorId: string,
) {
  const existing = await getGoal(prisma, id)
  const learnerId = input.learnerId ?? existing.learnerId
  if (input.learnerId && input.learnerId !== existing.learnerId) {
    await requireLearner(prisma, input.learnerId)
  }

  let profileId = existing.profileId
  if (input.profileId !== undefined) {
    const profile = input.profileId
      ? await resolveProfile(prisma, learnerId, input.profileId)
      : null
    profileId = profile?.id ?? null
  } else if (input.learnerId && input.learnerId !== existing.learnerId) {
    const profile = await resolveProfile(prisma, learnerId)
    profileId = profile?.id ?? null
  }

  const data: Prisma.TrainingGoalUpdateInput = {}
  if (input.learnerId !== undefined) data.learner = { connect: { id: learnerId } }
  data.profile = profileId ? { connect: { id: profileId } } : { disconnect: true }
  if (input.title !== undefined) data.title = input.title
  if (input.category !== undefined) data.category = input.category
  if (input.description !== undefined) data.description = input.description
  if (input.successCriteria !== undefined) data.successCriteria = input.successCriteria
  if (input.relatedDimensions !== undefined) data.relatedDimensions = input.relatedDimensions
  if (input.priority !== undefined) data.priority = priorityMap[input.priority]
  if (input.status !== undefined) {
    data.status = statusMap[input.status]
    data.archivedAt = input.status === 'archived' ? (existing.archivedAt ?? new Date()) : null
  }
  if (input.targetDate !== undefined) data.targetDate = parseTargetDate(input.targetDate) ?? null

  return prisma.$transaction(async (tx) => {
    const goal = await tx.trainingGoal.update({ where: { id }, data })
    await addActivity(tx, {
      type: 'GOAL',
      title: input.status === 'archived' ? '训练目标已归档' : '训练目标已更新',
      detail: goal.title,
      link: `/goals?learner=${goal.learnerId}`,
      actorId,
    })
    return goal
  })
}

export async function updateGoalStatus(
  prisma: PrismaClient,
  id: string,
  status: keyof typeof statusMap,
  actorId: string,
) {
  const existing = await getGoal(prisma, id)
  return prisma.$transaction(async (tx) => {
    const goal = await tx.trainingGoal.update({
      where: { id },
      data: {
        status: statusMap[status],
        archivedAt:
          status === 'archived' ? (existing.archivedAt ?? new Date()) : null,
      },
    })
    await addActivity(tx, {
      type: 'GOAL',
      title: status === 'archived' ? '训练目标已归档' : '训练目标状态已更新',
      detail: goal.title,
      link: `/goals?learner=${goal.learnerId}`,
      actorId,
    })
    return goal
  })
}
