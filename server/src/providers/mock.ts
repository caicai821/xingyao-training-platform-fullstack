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
import { buildMockProfile, buildMockScript } from './mockContent.js'

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

class MockScriptProvider implements ScriptProvider {
  readonly mode = 'mock' as const

  async generate(request: ScriptGenerationRequest): Promise<GeneratedScriptContent> {
    return buildMockScript(request)
  }
}

class MockProfileProvider implements ProfileProvider {
  readonly mode = 'mock' as const

  async analyze(request: ProfileGenerationRequest): Promise<GeneratedProfileContent> {
    return buildMockProfile(
      request.learner,
      request.assessment.scores,
      request.assessment.generalNotes,
      request.extraNotes,
    )
  }
}

class MockSceneProvider implements SceneProvider {
  readonly mode = 'mock' as const

  constructor(
    private readonly queueMs: number,
    private readonly generateMs: number,
  ) {}

  async submit(request: SceneJobRequest): Promise<SceneJobSubmission> {
    return { jobId: `mock:${request.taskId}` }
  }

  async poll(input: { jobId: string; submittedAt: Date; now?: Date }): Promise<SceneJobState> {
    const now = input.now ?? new Date()
    const elapsed = Math.max(0, now.getTime() - input.submittedAt.getTime())
    const queueMs = this.queueMs
    const generateMs = this.generateMs

    if (elapsed < queueMs) {
      return { status: 'queued', progress: 3 }
    }

    if (elapsed < queueMs + generateMs) {
      const ratio = generateMs === 0 ? 1 : (elapsed - queueMs) / generateMs
      return {
        status: 'generating',
        progress: Math.min(95, Math.round(10 + ratio * 85)),
      }
    }

    return {
      status: 'succeeded',
      progress: 100,
      result: {
        previewSeed: `demo:${input.jobId}:${hashString(input.jobId)}`,
        resolution: '2048 × 1280',
        notes:
          '演示模式生成结果：由后端模拟 Provider 生成，用于展示任务持久化与结果流程，不代表真实 3D 渲染输出。',
      },
    }
  }
}

export function createMockProviders(options: {
  mockSceneQueueMs: number
  mockSceneGenerateMs: number
}) {
  return {
    script: new MockScriptProvider(),
    profile: new MockProfileProvider(),
    scene: new MockSceneProvider(options.mockSceneQueueMs, options.mockSceneGenerateMs),
  }
}
