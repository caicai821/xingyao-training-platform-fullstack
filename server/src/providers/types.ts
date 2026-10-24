import type { ProviderMode } from '../config/env.js'

export interface LearnerContext {
  id: string
  name: string
  nickname?: string | null
  ageGroup: string
  traits: string[]
  interests: string[]
  communicationStyle: string
  promptPreference: string
  environmentNotes: string
}

export interface ScriptSceneConfig {
  theme: string
  sceneType: string
  complexity: '简洁' | '适中' | '丰富'
  stepCount: number
  duration: number
  promptStyle: string
  environmentPrefs: string[]
  avoidElements: string[]
}

export interface ScriptStepContent {
  id: string
  title: string
  trigger: string
  prompt: string
  expectedBehavior: string
  completion: string
  observationPoints: string[]
}

export interface ScriptGenerationRequest {
  learner: LearnerContext
  goalTitle: string
  sceneConfig: ScriptSceneConfig
  expectedBehavior: string
  completionStandard: string
  observationPoints: string[]
  extraNotes?: string
}

export interface GeneratedScriptContent {
  name: string
  objective: string
  scenarioSummary: string
  preparation: string[]
  environmentElements: string[]
  steps: ScriptStepContent[]
  sceneAdaptation: string
  cautions: string[]
}

export interface DimensionEntryContent {
  score: number
  description: string
  strengths: string
  concerns: string
  observation: string
}

export interface ProfileGenerationRequest {
  learner: LearnerContext
  assessment: {
    scores: Record<string, DimensionEntryContent>
    generalNotes: string
  }
  extraNotes?: string
}

export interface GeneratedProfileContent {
  summary: string
  strengths: string[]
  developmentAreas: string[]
  recommendations: string[]
  dimensionInsights: Record<string, string>
  observationSnapshot: string
}

export interface SceneJobRequest {
  taskId: string
  attempt: number
  sourceType: 'text' | 'image' | 'script'
  sceneName: string
  scenePurpose: string
  prompt: string
  sceneConfig: Record<string, unknown>
  imageUrls: string[]
  learner?: LearnerContext
  script?: {
    id: string
    name: string
    objective: string
    scenarioSummary: string
    steps: ScriptStepContent[]
  }
}

export interface SceneJobSubmission {
  jobId: string
}

export interface SceneJobResult {
  previewSeed?: string
  previewUrl?: string
  sceneFileUrl?: string
  sceneUrl?: string
  modelUrl?: string
  resolution?: string
  notes?: string
}

export type SceneJobStatus = 'queued' | 'generating' | 'succeeded' | 'failed'

export interface SceneJobState {
  status: SceneJobStatus
  progress: number
  result?: SceneJobResult
  error?: { code: string; message: string }
}

export interface ScriptProvider {
  mode: ProviderMode
  generate(request: ScriptGenerationRequest): Promise<GeneratedScriptContent>
}

export interface ProfileProvider {
  mode: ProviderMode
  analyze(request: ProfileGenerationRequest): Promise<GeneratedProfileContent>
}

export interface SceneProvider {
  mode: ProviderMode
  submit(request: SceneJobRequest): Promise<SceneJobSubmission>
  poll(input: { jobId: string; submittedAt: Date; now?: Date }): Promise<SceneJobState>
}

export interface Providers {
  script: ScriptProvider
  profile: ProfileProvider
  scene: SceneProvider
}
