import { randomUUID } from 'node:crypto'
import { Prisma, ScriptStatus, type PrismaClient } from '@prisma/client'
import type { Providers } from '../providers/index.js'
import type {
  ScriptCreateInput,
  ScriptGenerateInput,
  ScriptUpdateInput,
} from '../schemas/index.js'
import { conflict, notFound } from '../utils/errors.js'
import { nextCode } from '../utils/codes.js'
import { addActivity, requireLearner } from './activities.js'

const statusMap = {
  draft: ScriptStatus.DRAFT,
  generated: ScriptStatus.GENERATED,
  confirmed: ScriptStatus.CONFIRMED,
  archived: ScriptStatus.ARCHIVED,
} as const

type ScriptWithVersions = Prisma.TrainingScriptGetPayload<{ include: { versions: true } }>

function normalizeSteps(
  steps: {
    id?: string
    title: string
    trigger: string
    prompt: string
    expectedBehavior: string
    completion: string
    observationPoints: string[]
  }[],
) {
  return steps.map((step) => ({
    id: step.id ?? `step_${randomUUID()}`,
    title: step.title,
    trigger: step.trigger,
    prompt: step.prompt,
    expectedBehavior: step.expectedBehavior,
    completion: step.completion,
    observationPoints: step.observationPoints,
  }))
}

async function findScriptWithVersions(
  prisma: PrismaClient,
  id: string,
): Promise<ScriptWithVersions> {
  const script = await prisma.trainingScript.findUnique({
    where: { id },
    include: { versions: true },
  })
  if (!script) throw notFound('未找到对应的训练脚本')
  return script
}

async function assertGoal(prisma: PrismaClient, learnerId: string, goalId: string) {
  const goal = await prisma.trainingGoal.findUnique({ where: { id: goalId } })
  if (!goal) throw notFound('未找到关联的训练目标')
  if (goal.learnerId !== learnerId) {
    throw conflict('训练目标与所选学员不匹配')
  }
  return goal
}

async function appendVersion(
  tx: Prisma.TransactionClient,
  script: {
    id: string
    version: number
    name: string
    objective: string
    scenarioSummary: string
    steps: Prisma.JsonValue
  },
  note: string,
  actorId: string,
) {
  await tx.scriptVersion.create({
    data: {
      scriptId: script.id,
      version: script.version,
      name: script.name,
      objective: script.objective,
      scenarioSummary: script.scenarioSummary,
      steps: script.steps as Prisma.InputJsonValue,
      note,
      createdById: actorId,
    },
  })
}

export interface ScriptListParams {
  learnerId?: string
  goalId?: string
  status?: 'draft' | 'generated' | 'confirmed' | 'archived'
  q?: string
  page: number
  pageSize: number
}

export async function listScripts(prisma: PrismaClient, params: ScriptListParams) {
  const where: Prisma.TrainingScriptWhereInput = {}
  if (params.learnerId) where.learnerId = params.learnerId
  if (params.goalId) where.goalId = params.goalId
  if (params.status) where.status = statusMap[params.status]
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { code: { contains: params.q, mode: 'insensitive' } },
      { objective: { contains: params.q, mode: 'insensitive' } },
    ]
  }
  const [total, items] = await prisma.$transaction([
    prisma.trainingScript.count({ where }),
    prisma.trainingScript.findMany({
      where,
      include: { versions: true },
      orderBy: { updatedAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ])
  return { items, total }
}

export async function getScript(prisma: PrismaClient, id: string) {
  return findScriptWithVersions(prisma, id)
}

export async function generateScript(
  prisma: PrismaClient,
  providers: Providers,
  input: ScriptGenerateInput,
  actorId: string,
) {
  const learner = await requireLearner(prisma, input.learnerId)
  const goal = await assertGoal(prisma, input.learnerId, input.goalId)

  const content = await providers.script.generate({
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
    goalTitle: input.goalTitle.trim() || goal.title,
    sceneConfig: input.sceneConfig,
    expectedBehavior: input.expectedBehavior,
    completionStandard: input.completionStandard,
    observationPoints: input.observationPoints,
    extraNotes: input.extraNotes,
  })

  const isDemo = providers.script.mode === 'mock'
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const codes = await prisma.trainingScript.findMany({ select: { code: true } })
    const code = nextCode(
      codes.map((item) => item.code),
      `JB-${new Date().getFullYear()}`,
    )
    try {
      return await prisma.$transaction(async (tx) => {
        const script = await tx.trainingScript.create({
          data: {
            code,
            learnerId: input.learnerId,
            goalId: input.goalId,
            name: content.name,
            objective: content.objective,
            scenarioSummary: content.scenarioSummary,
            status: 'GENERATED',
            version: 1,
            preparation: content.preparation,
            environmentElements: content.environmentElements,
            steps: content.steps as unknown as Prisma.InputJsonValue,
            sceneAdaptation: content.sceneAdaptation,
            cautions: content.cautions,
            sceneConfig: input.sceneConfig,
            generatedBy: isDemo ? 'mock' : 'api',
            isDemo,
            createdById: actorId,
          },
        })
        await appendVersion(tx, script, '首次生成', actorId)
        await addActivity(tx, {
          type: 'SCRIPT',
          title: isDemo ? '训练脚本已生成（演示数据）' : '训练脚本已生成',
          detail: `${learner.name} · ${script.name}`,
          link: `/scripts/${script.id}`,
          actorId,
        })
        return tx.trainingScript.findUniqueOrThrow({
          where: { id: script.id },
          include: { versions: true },
        })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }
  throw conflict('训练脚本编号生成失败，请稍后重试')
}

export async function createScript(
  prisma: PrismaClient,
  input: ScriptCreateInput,
  actorId: string,
) {
  const learner = await requireLearner(prisma, input.learnerId)
  await assertGoal(prisma, input.learnerId, input.goalId)
  const steps = normalizeSteps(input.steps)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const codes = await prisma.trainingScript.findMany({ select: { code: true } })
    const code = nextCode(
      codes.map((item) => item.code),
      `JB-${new Date().getFullYear()}`,
    )
    try {
      return await prisma.$transaction(async (tx) => {
        const script = await tx.trainingScript.create({
          data: {
            code,
            learnerId: input.learnerId,
            goalId: input.goalId,
            name: input.name,
            objective: input.objective,
            scenarioSummary: input.scenarioSummary,
            status: statusMap[input.status],
            version: 1,
            preparation: input.preparation,
            environmentElements: input.environmentElements,
            steps,
            sceneAdaptation: input.sceneAdaptation,
            cautions: input.cautions,
            sceneConfig: input.sceneConfig,
            generatedBy: 'api',
            isDemo: false,
            createdById: actorId,
          },
        })
        await appendVersion(tx, script, '手动创建', actorId)
        await addActivity(tx, {
          type: 'SCRIPT',
          title: '训练脚本已创建',
          detail: `${learner.name} · ${script.name}`,
          link: `/scripts/${script.id}`,
          actorId,
        })
        return tx.trainingScript.findUniqueOrThrow({
          where: { id: script.id },
          include: { versions: true },
        })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }
  throw conflict('训练脚本编号生成失败，请稍后重试')
}

export async function updateScript(
  prisma: PrismaClient,
  id: string,
  input: ScriptUpdateInput,
  actorId: string,
  versionNote?: string,
) {
  const existing = await findScriptWithVersions(prisma, id)
  if (existing.status === 'ARCHIVED') {
    throw conflict('训练脚本已归档，无法继续修改')
  }
  const contentKeys: (keyof ScriptUpdateInput)[] = [
    'name',
    'objective',
    'scenarioSummary',
    'preparation',
    'environmentElements',
    'steps',
    'sceneAdaptation',
    'cautions',
    'sceneConfig',
  ]
  const changed = contentKeys.some((key) => input[key] !== undefined)
  if (!changed) return existing

  const data: Prisma.TrainingScriptUpdateInput = {
    version: existing.version + 1,
  }
  if (input.name !== undefined) data.name = input.name
  if (input.objective !== undefined) data.objective = input.objective
  if (input.scenarioSummary !== undefined) data.scenarioSummary = input.scenarioSummary
  if (input.preparation !== undefined) data.preparation = input.preparation
  if (input.environmentElements !== undefined) {
    data.environmentElements = input.environmentElements
  }
  if (input.steps !== undefined) data.steps = normalizeSteps(input.steps)
  if (input.sceneAdaptation !== undefined) data.sceneAdaptation = input.sceneAdaptation
  if (input.cautions !== undefined) data.cautions = input.cautions
  if (input.sceneConfig !== undefined) data.sceneConfig = input.sceneConfig
  if (existing.status === 'CONFIRMED') {
    data.status = 'GENERATED'
    data.confirmedAt = null
    data.confirmedBy = { disconnect: true }
  }

  return prisma.$transaction(async (tx) => {
    await appendVersion(
      tx,
      existing,
      versionNote?.trim() || '保存编辑',
      actorId,
    )
    const script = await tx.trainingScript.update({ where: { id }, data })
    await addActivity(tx, {
      type: 'SCRIPT',
      title: '训练脚本已更新',
      detail: script.name,
      link: `/scripts/${script.id}`,
      actorId,
    })
    return tx.trainingScript.findUniqueOrThrow({
      where: { id },
      include: { versions: true },
    })
  })
}

export async function confirmScript(
  prisma: PrismaClient,
  id: string,
  actorId: string,
) {
  const existing = await findScriptWithVersions(prisma, id)
  if (existing.status === 'ARCHIVED') {
    throw conflict('训练脚本已归档，无法确认')
  }
  if (existing.status === 'CONFIRMED') return existing

  return prisma.$transaction(async (tx) => {
    const script = await tx.trainingScript.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: actorId },
    })
    const learner = await tx.learner.findUnique({ where: { id: script.learnerId } })
    await addActivity(tx, {
      type: 'SCRIPT',
      title: '训练脚本已确认',
      detail: `${learner?.name ?? '学员'} · ${script.name}`,
      link: `/scripts/${script.id}`,
      actorId,
    })
    return tx.trainingScript.findUniqueOrThrow({
      where: { id },
      include: { versions: true },
    })
  })
}

export async function regenerateScript(
  prisma: PrismaClient,
  providers: Providers,
  id: string,
  overrides: Partial<{
    theme: string
    sceneType: string
    complexity: '简洁' | '适中' | '丰富'
    stepCount: number
    duration: number
    promptStyle: string
    environmentPrefs: string[]
    avoidElements: string[]
  }>,
  actorId: string,
) {
  const existing = await findScriptWithVersions(prisma, id)
  if (existing.status === 'ARCHIVED') {
    throw conflict('训练脚本已归档，无法重新生成')
  }
  const learner = await requireLearner(prisma, existing.learnerId)
  const goal = await prisma.trainingGoal.findUnique({ where: { id: existing.goalId } })
  if (!goal) throw notFound('未找到关联的训练目标')

  const sceneConfig = {
    ...(existing.sceneConfig as Record<string, unknown>),
    ...overrides,
  } as unknown as {
    theme: string
    sceneType: string
    complexity: '简洁' | '适中' | '丰富'
    stepCount: number
    duration: number
    promptStyle: string
    environmentPrefs: string[]
    avoidElements: string[]
  }

  const content = await providers.script.generate({
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
    goalTitle: goal.title,
    sceneConfig,
    expectedBehavior: goal.successCriteria,
    completionStandard: '',
    observationPoints: [],
  })

  const isDemo = providers.script.mode === 'mock'
  return prisma.$transaction(async (tx) => {
    await appendVersion(tx, existing, '重新生成前自动保存', actorId)
    const script = await tx.trainingScript.update({
      where: { id },
      data: {
        name: content.name,
        objective: content.objective,
        scenarioSummary: content.scenarioSummary,
        preparation: content.preparation,
        environmentElements: content.environmentElements,
        steps: content.steps as unknown as Prisma.InputJsonValue,
        sceneAdaptation: content.sceneAdaptation,
        cautions: content.cautions,
        sceneConfig,
        version: existing.version + 1,
        status: 'GENERATED',
        generatedBy: isDemo ? 'mock' : 'api',
        isDemo,
        confirmedAt: null,
        confirmedBy: { disconnect: true },
      },
    })
    await addActivity(tx, {
      type: 'SCRIPT',
      title: '训练脚本已重新生成',
      detail: `${learner.name} · ${script.name}`,
      link: `/scripts/${script.id}`,
      actorId,
    })
    return tx.trainingScript.findUniqueOrThrow({
      where: { id },
      include: { versions: true },
    })
  })
}

export async function duplicateScript(
  prisma: PrismaClient,
  id: string,
  actorId: string,
) {
  const source = await findScriptWithVersions(prisma, id)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const codes = await prisma.trainingScript.findMany({ select: { code: true } })
    const code = nextCode(
      codes.map((item) => item.code),
      `JB-${new Date().getFullYear()}`,
    )
    try {
      return await prisma.$transaction(async (tx) => {
        const copy = await tx.trainingScript.create({
          data: {
            code,
            learnerId: source.learnerId,
            goalId: source.goalId,
            name: `${source.name}（副本）`,
            objective: source.objective,
            scenarioSummary: source.scenarioSummary,
            status: 'DRAFT',
            version: 1,
            preparation: source.preparation,
            environmentElements: source.environmentElements,
            steps: source.steps as Prisma.InputJsonValue,
            sceneAdaptation: source.sceneAdaptation,
            cautions: source.cautions,
            sceneConfig: source.sceneConfig as Prisma.InputJsonValue,
            generatedBy: source.generatedBy,
            isDemo: source.isDemo,
            createdById: actorId,
          },
        })
        await appendVersion(tx, copy, '从已有脚本复制', actorId)
        await addActivity(tx, {
          type: 'SCRIPT',
          title: '训练脚本已复制',
          detail: copy.name,
          link: `/scripts/${copy.id}`,
          actorId,
        })
        return tx.trainingScript.findUniqueOrThrow({
          where: { id: copy.id },
          include: { versions: true },
        })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }
  throw conflict('训练脚本编号生成失败，请稍后重试')
}

export async function archiveScript(
  prisma: PrismaClient,
  id: string,
  actorId: string,
) {
  const existing = await findScriptWithVersions(prisma, id)
  if (existing.status === 'ARCHIVED') return existing
  return prisma.$transaction(async (tx) => {
    const script = await tx.trainingScript.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
    await addActivity(tx, {
      type: 'SCRIPT',
      title: '训练脚本已归档',
      detail: script.name,
      link: `/scripts/${script.id}`,
      actorId,
    })
    return tx.trainingScript.findUniqueOrThrow({
      where: { id },
      include: { versions: true },
    })
  })
}

export async function listScriptVersions(prisma: PrismaClient, id: string) {
  await findScriptWithVersions(prisma, id)
  return prisma.scriptVersion.findMany({
    where: { scriptId: id },
    include: { createdBy: true },
    orderBy: { savedAt: 'desc' },
  })
}
