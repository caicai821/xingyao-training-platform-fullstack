import {
  Prisma,
  SceneSourceType,
  SceneTaskStatus,
  type PrismaClient,
} from '@prisma/client'
import { isProviderConfigured, type AppConfig } from '../config/env.js'
import type { SceneTaskCreateInput } from '../schemas/index.js'
import {
  AppError,
  badRequest,
  conflict,
  invalidTransition,
  notFound,
  providerNotConfigured,
} from '../utils/errors.js'
import { nextCode } from '../utils/codes.js'
import { addActivity, requireLearner } from './activities.js'

export type TaskWithAsset = Prisma.SceneTaskGetPayload<{ include: { asset: true } }>

const sourceMap = {
  text: SceneSourceType.TEXT,
  image: SceneSourceType.IMAGE,
  script: SceneSourceType.SCRIPT,
} as const

export interface ResolvedTaskRelations {
  learnerId: string | null
  goalId: string | null
  scriptId: string | null
  images: { id: string; name: string; size: number; type: string }[]
}

export async function resolveTaskRelations(
  prisma: PrismaClient,
  input: SceneTaskCreateInput,
): Promise<ResolvedTaskRelations> {
  let learnerId = input.learnerId ?? null
  let goalId = input.trainingGoalId ?? null
  const scriptId = input.scriptId ?? null

  if (input.sourceType === 'script' && !scriptId) {
    throw badRequest('基于训练脚本创建场景时必须选择已确认的训练脚本')
  }

  if (scriptId) {
    const script = await prisma.trainingScript.findUnique({ where: { id: scriptId } })
    if (!script) throw notFound('未找到关联的训练脚本')
    if (learnerId && script.learnerId !== learnerId) {
      throw conflict('训练脚本与所选学员不匹配')
    }
    if (script.status !== 'CONFIRMED') {
      throw new AppError(
        409,
        'SCRIPT_NOT_CONFIRMED',
        '训练脚本尚未确认，确认后才能创建关联的场景任务',
      )
    }
    learnerId = script.learnerId
    if (goalId && script.goalId !== goalId) {
      throw conflict('训练脚本与所选训练目标不匹配')
    }
    goalId = script.goalId
  }

  if (learnerId) {
    await requireLearner(prisma, learnerId)
  }

  if (goalId) {
    const goal = await prisma.trainingGoal.findUnique({ where: { id: goalId } })
    if (!goal) throw notFound('未找到关联的训练目标')
    if (learnerId && goal.learnerId !== learnerId) {
      throw conflict('训练目标与所选学员不匹配')
    }
    learnerId = goal.learnerId
  }

  const imageIds = Array.from(new Set(input.imageReferences.map((item) => item.id)))
  let images: ResolvedTaskRelations['images'] = []
  if (imageIds.length > 0) {
    const files = await prisma.uploadFile.findMany({
      where: { id: { in: imageIds } },
    })
    if (files.length !== imageIds.length) {
      throw badRequest('引用的图片不存在或已被移除，请重新上传')
    }
    const order = new Map(imageIds.map((id, index) => [id, index]))
    images = files
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((file) => ({
        id: file.id,
        name: file.originalName,
        size: file.size,
        type: file.mimeType,
      }))
  }

  if (input.submit) {
    if (input.sourceType === 'image' && images.length === 0) {
      throw badRequest('提交图像场景任务前请先上传参考图片')
    }
    if (input.sourceType !== 'image' && !input.prompt) {
      throw badRequest('提交场景任务前请填写场景描述')
    }
  }

  return { learnerId, goalId, scriptId, images }
}

export async function assertSceneProviderAvailable(config: AppConfig): Promise<void> {
  if (!isProviderConfigured(config.sceneProvider)) {
    throw providerNotConfigured('3D 场景生成服务')
  }
}

export async function createTask(
  prisma: PrismaClient,
  config: AppConfig,
  input: SceneTaskCreateInput,
  actorId: string,
) {
  const relations = await resolveTaskRelations(prisma, input)
  if (input.submit) await assertSceneProviderAvailable(config)

  const providerMode = config.sceneProvider.mode
  const isDemo = providerMode === 'mock'

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const codes = await prisma.sceneTask.findMany({ select: { code: true } })
    const code = nextCode(
      codes.map((item) => item.code),
      `RW-${new Date().getFullYear()}`,
    )
    try {
      return await prisma.$transaction(async (tx) => {
        const task = await tx.sceneTask.create({
          data: {
            code,
            sourceType: sourceMap[input.sourceType],
            sceneName: input.sceneName,
            scenePurpose: input.scenePurpose,
            prompt: input.prompt,
            learnerId: relations.learnerId,
            trainingGoalId: relations.goalId,
            scriptId: relations.scriptId,
            imageReferences: relations.images as Prisma.InputJsonValue,
            sceneConfig: input.sceneConfig as Prisma.InputJsonValue,
            status: input.submit ? 'PENDING' : 'DRAFT',
            progress: input.submit ? 2 : 0,
            submittedAt: input.submit ? new Date() : null,
            providerMode,
            isDemo,
            attempts: input.submit ? 1 : 0,
            createdById: actorId,
          },
        })
        if (relations.images.length > 0) {
          await tx.sceneTaskFile.createMany({
            data: relations.images.map((image) => ({
              taskId: task.id,
              fileId: image.id,
            })),
            skipDuplicates: true,
          })
        }
        await addActivity(tx, {
          type: 'TASK',
          title: input.submit
            ? isDemo
              ? '场景任务已提交（演示 Provider）'
              : '场景任务已提交'
            : '场景任务草稿已保存',
          detail: task.sceneName,
          link: `/scenes/tasks/${task.id}`,
          actorId,
        })
        return tx.sceneTask.findUniqueOrThrow({
          where: { id: task.id },
          include: { asset: true },
        })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }
  throw conflict('场景任务编号生成失败，请稍后重试')
}

export interface TaskListParams {
  q?: string
  status?:
    | 'draft'
    | 'pending'
    | 'queued'
    | 'generating'
    | 'succeeded'
    | 'failed'
  learnerId?: string
  scriptId?: string
  sourceType?: 'text' | 'image' | 'script'
  page: number
  pageSize: number
}

export async function listTasks(prisma: PrismaClient, params: TaskListParams) {
  const where: Prisma.SceneTaskWhereInput = {}
  if (params.status) where.status = params.status.toUpperCase() as SceneTaskStatus
  if (params.learnerId) where.learnerId = params.learnerId
  if (params.scriptId) where.scriptId = params.scriptId
  if (params.sourceType) where.sourceType = sourceMap[params.sourceType]
  if (params.q) {
    where.OR = [
      { sceneName: { contains: params.q, mode: 'insensitive' } },
      { code: { contains: params.q, mode: 'insensitive' } },
      { prompt: { contains: params.q, mode: 'insensitive' } },
    ]
  }
  const [total, items] = await prisma.$transaction([
    prisma.sceneTask.count({ where }),
    prisma.sceneTask.findMany({
      where,
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ])
  return { items, total }
}

export async function getTask(prisma: PrismaClient, id: string): Promise<TaskWithAsset> {
  const task = await prisma.sceneTask.findUnique({
    where: { id },
    include: { asset: true },
  })
  if (!task) throw notFound('未找到对应的场景任务')
  return task
}

async function transitionTask(
  prisma: PrismaClient,
  config: AppConfig,
  id: string,
  from: SceneTaskStatus,
  actorId: string,
  title: string,
) {
  await assertSceneProviderAvailable(config)
  const current = await getTask(prisma, id)
  if (current.status !== from) {
    throw invalidTransition(
      `当前任务状态为「${current.status}」，无法执行该操作`,
    )
  }
  const providerMode = config.sceneProvider.mode
  const isDemo = providerMode === 'mock'
  const result = await prisma.sceneTask.updateMany({
    where: { id, status: from },
    data: {
      status: 'PENDING',
      progress: 2,
      submittedAt: new Date(),
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      result: Prisma.DbNull,
      providerJobId: null,
      providerMode,
      isDemo,
      attempts: { increment: 1 },
    },
  })
  if (result.count === 0) {
    throw invalidTransition('任务状态已发生变化，请刷新后重试')
  }
  await addActivity(prisma, {
    type: 'TASK',
    title,
    detail: current.sceneName,
    link: `/scenes/tasks/${current.id}`,
    actorId,
  })
  return getTask(prisma, id)
}

export async function submitTask(
  prisma: PrismaClient,
  config: AppConfig,
  id: string,
  actorId: string,
) {
  return transitionTask(prisma, config, id, 'DRAFT', actorId, '场景任务已提交')
}

export async function retryTask(
  prisma: PrismaClient,
  config: AppConfig,
  id: string,
  actorId: string,
) {
  return transitionTask(prisma, config, id, 'FAILED', actorId, '场景任务已重新提交')
}
