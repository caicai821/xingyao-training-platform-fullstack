import { Prisma, type PrismaClient } from '@prisma/client'
import type { Providers } from '../providers/index.js'
import {
  abilityDimensionKeys,
  type AssessmentCreateInput,
  type ProfileUpdateInput,
} from '../schemas/index.js'
import { notFound } from '../utils/errors.js'
import { addActivity, requireLearner, type Db } from './activities.js'

async function profileSnapshot(db: Db, profileId: string) {
  const profile = await db.abilityProfile.findUnique({ where: { id: profileId } })
  if (!profile) throw notFound('未找到对应的能力画像')
  return profile
}

async function appendRevision(
  db: Db,
  profileId: string,
  action: string,
  snapshot: unknown,
  actorId: string,
  note = '',
) {
  const last = await db.abilityProfileRevision.findFirst({
    where: { profileId },
    orderBy: { revision: 'desc' },
  })
  await db.abilityProfileRevision.create({
    data: {
      profileId,
      revision: (last?.revision ?? 0) + 1,
      action,
      snapshot: snapshot as Prisma.InputJsonValue,
      note,
      createdById: actorId,
    },
  })
}

export async function listAssessments(prisma: PrismaClient, learnerId?: string) {
  return prisma.abilityAssessment.findMany({
    where: learnerId ? { learnerId } : undefined,
    orderBy: { createdAt: 'desc' },
  })
}

export async function saveAssessment(
  prisma: PrismaClient,
  learnerId: string,
  input: AssessmentCreateInput,
  actorId: string,
) {
  const learner = await requireLearner(prisma, learnerId)
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.abilityAssessment.create({
      data: {
        learnerId,
        scores: input.scores,
        generalNotes: input.generalNotes,
        author: input.author || '训练指导',
        createdById: actorId,
      },
    })
    await tx.learner.update({
      where: { id: learnerId },
      data: { lastAssessmentAt: assessment.createdAt },
    })
    await addActivity(tx, {
      type: 'ASSESSMENT',
      title: '能力信息已保存',
      detail: `${learner.name} · 新增一次能力记录`,
      link: `/learners/${learner.id}`,
      actorId,
    })
    return assessment
  })
}

export interface ProfileListParams {
  learnerId?: string
  status?: 'unconfirmed' | 'confirmed'
  page: number
  pageSize: number
}

export async function listProfiles(prisma: PrismaClient, params: ProfileListParams) {
  const where: Prisma.AbilityProfileWhereInput = {}
  if (params.learnerId) where.learnerId = params.learnerId
  if (params.status) where.status = params.status === 'confirmed' ? 'CONFIRMED' : 'UNCONFIRMED'
  const [total, items] = await prisma.$transaction([
    prisma.abilityProfile.count({ where }),
    prisma.abilityProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ])
  return { items, total }
}

export async function getProfile(prisma: PrismaClient, id: string) {
  const profile = await prisma.abilityProfile.findUnique({ where: { id } })
  if (!profile) throw notFound('未找到对应的能力画像')
  return profile
}

export async function generateProfile(
  prisma: PrismaClient,
  providers: Providers,
  learnerId: string,
  input: { assessmentId: string; extraNotes?: string },
  actorId: string,
) {
  const learner = await requireLearner(prisma, learnerId)
  const assessment = await prisma.abilityAssessment.findFirst({
    where: { id: input.assessmentId, learnerId },
  })
  if (!assessment) throw notFound('请先完成本次能力信息录入')

  const generated = await providers.profile.analyze({
    learner: {
      id: learner.id,
      name: learner.name,
      nickname: learner.nickname,
      ageGroup: learner.ageGroup,
      traits: learner.traits,
      interests: learner.interests,
      communicationStyle: learner.communicationStyle,
      promptPreference: learner.promptPreference,
      environmentNotes: learner.environmentNotes,
    },
    assessment: {
      scores: assessment.scores as Record<
        string,
        {
          score: number
          description: string
          strengths: string
          concerns: string
          observation: string
        }
      >,
      generalNotes: assessment.generalNotes,
    },
    extraNotes: input.extraNotes,
  })

  const insights: Record<string, string> = {}
  for (const key of abilityDimensionKeys) {
    insights[key] = generated.dimensionInsights[key] ?? ''
  }

  const isDemo = providers.profile.mode === 'mock'
  return prisma.$transaction(async (tx) => {
    const profile = await tx.abilityProfile.create({
      data: {
        learnerId,
        assessmentId: assessment.id,
        summary: generated.summary,
        strengths: generated.strengths,
        developmentAreas: generated.developmentAreas,
        recommendations: generated.recommendations,
        dimensionInsights: insights,
        observationSnapshot: generated.observationSnapshot,
        generatedBy: isDemo ? 'mock' : 'api',
        isDemo,
        createdById: actorId,
      },
    })
    await appendRevision(tx, profile.id, 'generated', profile, actorId, '首次生成')
    await addActivity(tx, {
      type: 'PROFILE',
      title: isDemo ? '能力画像已生成（演示数据）' : '能力画像已生成',
      detail: `${learner.name} · 待确认`,
      link: `/profiles/${learner.id}`,
      actorId,
    })
    return profile
  })
}

export async function updateProfile(
  prisma: PrismaClient,
  id: string,
  input: ProfileUpdateInput,
  actorId: string,
) {
  const existing = await profileSnapshot(prisma, id)
  const data: Prisma.AbilityProfileUpdateInput = {
    status: 'UNCONFIRMED',
    confirmedBy: { disconnect: true },
    confirmedAt: null,
  }
  if (input.summary !== undefined) data.summary = input.summary
  if (input.strengths !== undefined) data.strengths = input.strengths
  if (input.developmentAreas !== undefined) data.developmentAreas = input.developmentAreas
  if (input.recommendations !== undefined) data.recommendations = input.recommendations
  if (input.dimensionInsights !== undefined) {
    data.dimensionInsights = input.dimensionInsights
  }
  if (input.observationSnapshot !== undefined) {
    data.observationSnapshot = input.observationSnapshot
  }

  return prisma.$transaction(async (tx) => {
    await appendRevision(tx, id, 'updated', existing, actorId, '保存修改')
    const profile = await tx.abilityProfile.update({ where: { id }, data })
    const learner = await tx.learner.findUnique({ where: { id: profile.learnerId } })
    await addActivity(tx, {
      type: 'PROFILE',
      title: '能力画像已更新',
      detail: learner?.name ?? '学员',
      link: `/profiles/${profile.learnerId}`,
      actorId,
    })
    return profile
  })
}

export async function confirmProfile(
  prisma: PrismaClient,
  id: string,
  actorId: string,
) {
  const existing = await profileSnapshot(prisma, id)
  if (existing.status === 'CONFIRMED') return existing
  return prisma.$transaction(async (tx) => {
    await appendRevision(tx, id, 'confirmed', existing, actorId, '确认前快照')
    const profile = await tx.abilityProfile.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: actorId },
    })
    const learner = await tx.learner.findUnique({ where: { id: profile.learnerId } })
    await addActivity(tx, {
      type: 'PROFILE',
      title: '能力画像已确认',
      detail: learner?.name ?? '学员',
      link: `/profiles/${profile.learnerId}`,
      actorId,
    })
    return profile
  })
}

export async function listProfileHistory(prisma: PrismaClient, id: string) {
  await getProfile(prisma, id)
  return prisma.abilityProfileRevision.findMany({
    where: { profileId: id },
    include: { createdBy: true },
    orderBy: { revision: 'desc' },
  })
}
