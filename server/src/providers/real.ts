import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { ProviderConfig } from '../config/env.js'
import {
  AppError,
  providerError,
  providerInvalidResponse,
  providerNotConfigured,
} from '../utils/errors.js'
import type {
  GeneratedProfileContent,
  GeneratedScriptContent,
  ProfileGenerationRequest,
  ProfileProvider,
  SceneJobRequest,
  SceneJobState,
  SceneJobSubmission,
  SceneProvider,
  ScriptGenerationRequest,
  ScriptProvider,
} from './types.js'

const stepSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  trigger: z.string(),
  prompt: z.string(),
  expectedBehavior: z.string(),
  completion: z.string(),
  observationPoints: z.array(z.string()),
})

const scriptContentSchema = z.object({
  name: z.string().min(1),
  objective: z.string(),
  scenarioSummary: z.string(),
  preparation: z.array(z.string()),
  environmentElements: z.array(z.string()),
  steps: z.array(stepSchema).min(1),
  sceneAdaptation: z.string(),
  cautions: z.array(z.string()),
})

const profileContentSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  developmentAreas: z.array(z.string()),
  recommendations: z.array(z.string()),
  dimensionInsights: z.record(z.string(), z.string()),
  observationSnapshot: z.string(),
})

const sceneSubmitSchema = z.object({ jobId: z.string().min(1) })

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), '必须为 http(s) 地址')

const scenePollSchema = z.object({
  status: z.enum(['pending', 'queued', 'generating', 'succeeded', 'failed']),
  progress: z.number().min(0).max(100).optional(),
  result: z
    .object({
      previewSeed: z.string().optional(),
      previewUrl: httpUrlSchema.optional(),
      sceneFileUrl: httpUrlSchema.optional(),
      sceneUrl: httpUrlSchema.optional(),
      modelUrl: httpUrlSchema.optional(),
      resolution: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }).optional(),
})

async function callProvider(
  provider: ProviderConfig,
  serviceName: string,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  if (provider.mode !== 'real') {
    throw providerNotConfigured(serviceName)
  }
  if (!provider.url || !provider.token) {
    throw providerNotConfigured(serviceName)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs)
  const base = provider.url.replace(/\/$/, '')
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.token}`,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      let detail = `服务返回 HTTP ${response.status}`
      try {
        const body = (await response.json()) as {
          error?: { message?: string }
          message?: string
        }
        const message = body?.error?.message ?? body?.message
        if (message) detail = `${detail}：${message}`
      } catch {
        // Keep the HTTP status when the provider does not return JSON.
      }
      throw providerError(serviceName, detail)
    }
    return (await response.json()) as unknown
  } catch (error) {
    if (error instanceof AppError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw providerError(serviceName, '请求超时')
    }
    throw providerError(serviceName, error instanceof Error ? error.message : '网络请求失败')
  } finally {
    clearTimeout(timer)
  }
}

class RealScriptProvider implements ScriptProvider {
  readonly mode = 'real' as const

  constructor(private readonly config: ProviderConfig) {}

  async generate(request: ScriptGenerationRequest): Promise<GeneratedScriptContent> {
    const raw = await callProvider(this.config, '训练脚本生成服务', '/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    const parsed = scriptContentSchema.safeParse(raw)
    if (!parsed.success) throw providerInvalidResponse('训练脚本生成服务')
    return {
      ...parsed.data,
      steps: parsed.data.steps.map((step) => ({
        ...step,
        id: step.id ?? `step_${randomUUID()}`,
      })),
    }
  }
}

class RealProfileProvider implements ProfileProvider {
  readonly mode = 'real' as const

  constructor(private readonly config: ProviderConfig) {}

  async analyze(request: ProfileGenerationRequest): Promise<GeneratedProfileContent> {
    const raw = await callProvider(this.config, '能力分析服务', '/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    const parsed = profileContentSchema.safeParse(raw)
    if (!parsed.success) throw providerInvalidResponse('能力分析服务')
    return parsed.data
  }
}

class RealSceneProvider implements SceneProvider {
  readonly mode = 'real' as const

  constructor(private readonly config: ProviderConfig) {}

  async submit(request: SceneJobRequest): Promise<SceneJobSubmission> {
    const raw = await callProvider(this.config, '3D 场景生成服务', '/jobs', {
      method: 'POST',
      headers: { 'Idempotency-Key': `${request.taskId}:${request.attempt}` },
      body: JSON.stringify(request),
    })
    const parsed = sceneSubmitSchema.safeParse(raw)
    if (!parsed.success) throw providerInvalidResponse('3D 场景生成服务')
    return parsed.data
  }

  async poll(input: { jobId: string }): Promise<SceneJobState> {
    const raw = await callProvider(
      this.config,
      '3D 场景生成服务',
      `/jobs/${encodeURIComponent(input.jobId)}`,
      { method: 'GET' },
    )
    const parsed = scenePollSchema.safeParse(raw)
    if (!parsed.success) throw providerInvalidResponse('3D 场景生成服务')

    const status = parsed.data.status === 'pending' ? 'queued' : parsed.data.status
    const progress = parsed.data.progress ?? (status === 'succeeded' ? 100 : 0)

    if (status === 'succeeded') {
      const result = parsed.data.result
      if (!result?.sceneUrl && !result?.modelUrl) {
        throw providerInvalidResponse('3D 场景生成服务（缺少场景地址引用）')
      }
      return {
        status,
        progress: 100,
        result: {
          previewSeed: result.previewSeed ?? `real:${input.jobId}`,
          previewUrl: result.previewUrl,
          sceneFileUrl: result.sceneFileUrl,
          sceneUrl: result.sceneUrl,
          modelUrl: result.modelUrl,
          resolution: result.resolution ?? '未提供',
          notes: result.notes ?? '',
        },
      }
    }

    if (status === 'failed') {
      return {
        status,
        progress,
        error: parsed.data.error ?? {
          code: 'PROVIDER_JOB_FAILED',
          message: '3D 场景生成服务报告任务失败',
        },
      }
    }

    return { status, progress }
  }
}

export function createRealProviders(config: {
  script: ProviderConfig
  profile: ProviderConfig
  scene: ProviderConfig
}) {
  return {
    script: new RealScriptProvider(config.script),
    profile: new RealProfileProvider(config.profile),
    scene: new RealSceneProvider(config.scene),
  }
}
