import { Prisma, type PrismaClient, type SceneTask } from '@prisma/client'
import type { AppConfig } from '../config/env.js'
import type {
  Providers,
  SceneJobRequest,
  SceneJobState,
  ScriptStepContent,
} from '../providers/index.js'
import { AppError } from '../utils/errors.js'
import { createSignedContentUrl } from './uploads.js'

export interface RunnerLogger {
  info: (payload: unknown, message?: string) => void
  warn: (payload: unknown, message?: string) => void
  error: (payload: unknown, message?: string) => void
}

const ACTIVE_STATUSES = ['QUEUED', 'GENERATING'] as const

const SOURCE_LABELS: Record<string, string> = {
  TEXT: '文本描述',
  IMAGE: '图像上传',
  SCRIPT: '训练脚本',
}

function toStoredImages(task: SceneTask): { id: string }[] {
  const value = task.imageReferences
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is { id: string } => Boolean(item && typeof item === 'object' && 'id' in item))
    .map((item) => ({ id: String(item.id) }))
}

async function buildJobRequest(
  prisma: PrismaClient,
  config: AppConfig,
  task: SceneTask,
): Promise<SceneJobRequest> {
  const learner = task.learnerId
    ? await prisma.learner.findUnique({ where: { id: task.learnerId } })
    : null
  const script = task.scriptId
    ? await prisma.trainingScript.findUnique({ where: { id: task.scriptId } })
    : null

  return {
    taskId: task.id,
    attempt: task.attempts > 0 ? task.attempts : 1,
    sourceType: task.sourceType.toLowerCase() as 'text' | 'image' | 'script',
    sceneName: task.sceneName,
    scenePurpose: task.scenePurpose,
    prompt: task.prompt,
    sceneConfig: (task.sceneConfig ?? {}) as Record<string, unknown>,
    imageUrls: toStoredImages(task).map((image) =>
      createSignedContentUrl(config, image.id),
    ),
    learner: learner
      ? {
          id: learner.id,
          name: learner.name,
          nickname: learner.nickname,
          ageGroup: learner.ageGroup,
          traits: learner.traits,
          interests: learner.interests,
          communicationStyle: learner.communicationStyle,
          promptPreference: learner.promptPreference,
          environmentNotes: learner.environmentNotes,
        }
      : undefined,
    script: script
      ? {
          id: script.id,
          name: script.name,
          objective: script.objective,
          scenarioSummary: script.scenarioSummary,
          steps: script.steps as unknown as ScriptStepContent[],
        }
      : undefined,
  }
}

function errorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message }
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    return { code: error.code, message: error.message }
  }
  return {
    code: 'PROVIDER_ERROR',
    message: error instanceof Error ? error.message : '生成服务调用失败',
  }
}

async function failTask(
  prisma: PrismaClient,
  task: SceneTask,
  error: unknown,
  logger: RunnerLogger,
): Promise<void> {
  const detail = errorDetails(error)
  const updated = await prisma.sceneTask.updateMany({
    where: { id: task.id, status: { in: ['PENDING', ...ACTIVE_STATUSES] } },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errorCode: detail.code,
      errorMessage: detail.message,
    },
  })
  if (updated.count > 0) {
    await prisma.activity.create({
      data: {
        type: 'TASK',
        title: '场景任务失败',
        detail: task.sceneName,
        link: `/scenes/tasks/${task.id}`,
        actorId: task.createdById,
      },
    })
    logger.warn(
      { taskId: task.id, code: detail.code, message: detail.message },
      'scene task failed',
    )
  }
}

async function finishTask(
  prisma: PrismaClient,
  task: SceneTask,
  state: SceneJobState,
  logger: RunnerLogger,
): Promise<void> {
  const now = new Date()
  const result = state.result
  const previewSeed = result?.previewSeed ?? `${task.id}:${task.sceneName}`
  const isDemo = task.isDemo
  const resultPayload = {
    previewSeed,
    resolution: result?.resolution ?? (isDemo ? '2048 × 1280' : '未提供'),
    previewUrl: result?.previewUrl,
    sceneFileUrl: result?.sceneFileUrl,
    modelUrl: result?.modelUrl,
    sceneUrl: result?.sceneUrl,
    notes:
      result?.notes ??
      (isDemo
        ? '演示模式生成结果：由后端模拟 Provider 生成，不代表真实 3D 渲染输出。'
        : '由外部 3D 场景生成服务返回的结果。'),
    isDemo,
  } satisfies Prisma.InputJsonObject

  await prisma.$transaction(async (tx) => {
    const updated = await tx.sceneTask.updateMany({
      where: { id: task.id, status: { in: [...ACTIVE_STATUSES] } },
      data: {
        status: 'SUCCEEDED',
        progress: 100,
        completedAt: now,
        errorCode: null,
        errorMessage: null,
        result: resultPayload,
      },
    })
    if (updated.count === 0) return

    const taskWithFiles = await tx.sceneTask.findUniqueOrThrow({
      where: { id: task.id },
      include: { files: true },
    })
    const sceneConfig = (taskWithFiles.sceneConfig ?? {}) as { sceneType?: string }
    const sceneType = sceneConfig.sceneType ?? '自定义场景'
    const tags = [
      sceneType,
      SOURCE_LABELS[taskWithFiles.sourceType] ?? '场景任务',
      isDemo ? '演示场景' : '真实生成',
    ].filter(Boolean)

    await tx.sceneAsset.upsert({
      where: { taskId: task.id },
      create: {
        taskId: task.id,
        name: taskWithFiles.sceneName,
        sceneType,
        description:
          taskWithFiles.scenePurpose || taskWithFiles.prompt.slice(0, 90) || taskWithFiles.sceneName,
        learnerId: taskWithFiles.learnerId,
        trainingGoalId: taskWithFiles.trainingGoalId,
        scriptId: taskWithFiles.scriptId,
        sourceType: taskWithFiles.sourceType,
        tags,
        previewSeed,
        previewFileId: taskWithFiles.files[0]?.fileId ?? null,
        previewUrl: result?.previewUrl ?? null,
        sceneFileUrl: result?.sceneFileUrl ?? null,
        sceneUrl: result?.sceneUrl ?? null,
        isDemo,
        note: isDemo
          ? '演示 Provider 生成的场景资产，可在接入真实生成服务后替换。'
          : '由 3D 场景生成服务创建的场景资产。',
        createdById: taskWithFiles.createdById,
      },
      update: {
        previewSeed,
        previewUrl: result?.previewUrl ?? null,
        sceneFileUrl: result?.sceneFileUrl ?? null,
        sceneUrl: result?.sceneUrl ?? null,
      },
    })

    await tx.activity.create({
      data: {
        type: 'TASK',
        title: isDemo ? '场景任务生成成功（演示数据）' : '场景任务生成成功',
        detail: taskWithFiles.sceneName,
        link: `/scenes/tasks/${taskWithFiles.id}`,
        actorId: taskWithFiles.createdById,
      },
    })
  })

  logger.info({ taskId: task.id }, 'scene task succeeded')
}

async function processPending(
  prisma: PrismaClient,
  config: AppConfig,
  providers: Providers,
  logger: RunnerLogger,
): Promise<void> {
  const pending = await prisma.sceneTask.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    take: 20,
  })

  for (const task of pending) {
    try {
      if (task.providerMode !== providers.scene.mode) {
        throw new AppError(
          502,
          'PROVIDER_ERROR',
          '生成服务模式已变更，请重新提交该任务',
        )
      }
      const request = await buildJobRequest(prisma, config, task)
      const submission = await providers.scene.submit(request)
      const updated = await prisma.sceneTask.updateMany({
        where: { id: task.id, status: 'PENDING' },
        data: {
          status: 'QUEUED',
          progress: 5,
          providerJobId: submission.jobId,
        },
      })
      if (updated.count > 0) {
        logger.info({ taskId: task.id }, 'scene task queued at provider')
      }
    } catch (error) {
      await failTask(prisma, task, error, logger)
    }
  }
}

async function pollActive(
  prisma: PrismaClient,
  providers: Providers,
  logger: RunnerLogger,
): Promise<void> {
  const active = await prisma.sceneTask.findMany({
    where: { status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { updatedAt: 'asc' },
    take: 50,
  })

  for (const task of active) {
    try {
      if (task.providerMode !== providers.scene.mode) {
        throw new AppError(
          502,
          'PROVIDER_ERROR',
          '生成服务模式已变更，请重新提交该任务',
        )
      }
      if (!task.providerJobId) {
        throw new AppError(502, 'PROVIDER_ERROR', '任务缺少生成服务作业编号，请重新提交')
      }

      const state = await providers.scene.poll({
        jobId: task.providerJobId,
        submittedAt: task.submittedAt ?? task.updatedAt,
        now: new Date(),
      })

      if (state.status === 'succeeded') {
        await finishTask(prisma, task, state, logger)
        continue
      }
      if (state.status === 'failed') {
        await failTask(prisma, task, state.error ?? {
          code: 'PROVIDER_JOB_FAILED',
          message: '生成服务报告任务失败',
        }, logger)
        continue
      }

      const nextStatus =
        state.status === 'generating' ? 'GENERATING' : task.status
      if (task.status === 'GENERATING' && state.status === 'queued') {
        continue
      }
      await prisma.sceneTask.updateMany({
        where: { id: task.id, status: { in: [...ACTIVE_STATUSES] } },
        data: {
          status: nextStatus,
          progress: Math.max(task.progress, Math.min(99, state.progress)),
        },
      })
    } catch (error) {
      await failTask(prisma, task, error, logger)
    }
  }
}

export async function runTaskTick(
  prisma: PrismaClient,
  config: AppConfig,
  providers: Providers,
  logger: RunnerLogger,
): Promise<void> {
  await processPending(prisma, config, providers, logger)
  await pollActive(prisma, providers, logger)
}

export function startTaskRunner(
  prisma: PrismaClient,
  config: AppConfig,
  providers: Providers,
  logger: RunnerLogger,
): () => void {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await runTaskTick(prisma, config, providers, logger)
    } catch (error) {
      logger.error({ error }, 'scene task runner tick failed')
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), config.taskPollIntervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
