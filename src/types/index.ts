export type AbilityDimensionKey =
  | 'communication'
  | 'social'
  | 'attention'
  | 'emotion'
  | 'adaptation'
  | 'dailyLiving'
  | 'cognition'
  | 'learning'

export type LearnerStatus = 'active' | 'paused' | 'archived'

export interface Learner {
  id: string
  code: string
  name: string
  nickname?: string
  ageGroup: string
  status: LearnerStatus
  traits: string[]
  interests: string[]
  communicationStyle: string
  promptPreference: string
  environmentNotes: string
  currentGoalText: string
  notes: string
  createdAt: string
  updatedAt: string
  lastAssessmentAt?: string
}

export type LearnerInput = Omit<
  Learner,
  'id' | 'code' | 'createdAt' | 'updatedAt' | 'lastAssessmentAt'
>

export interface DimensionEntry {
  score: number
  description: string
  strengths: string
  concerns: string
  observation: string
}

export type AbilityScores = Record<AbilityDimensionKey, DimensionEntry>

export interface AbilityAssessment {
  id: string
  learnerId: string
  createdAt: string
  author: string
  scores: AbilityScores
  generalNotes: string
}

export type ProfileStatus = 'unconfirmed' | 'confirmed'

export interface AbilityProfile {
  id: string
  learnerId: string
  assessmentId: string
  createdAt: string
  updatedAt: string
  status: ProfileStatus
  summary: string
  strengths: string[]
  developmentAreas: string[]
  recommendations: string[]
  dimensionInsights: Record<AbilityDimensionKey, string>
  observationSnapshot: string
  generatedBy: 'mock' | 'api'
  isDemo: boolean
  confirmedAt?: string
}

export interface AbilityProfileInput {
  learnerId: string
  assessmentId: string
  extraNotes?: string
}

export type GoalStatus = 'planning' | 'in_progress' | 'completed' | 'archived'
export type GoalPriority = 'high' | 'medium' | 'low'

export interface TrainingGoal {
  id: string
  learnerId: string
  title: string
  category: string
  description: string
  successCriteria: string
  relatedDimensions: AbilityDimensionKey[]
  priority: GoalPriority
  status: GoalStatus
  targetDate?: string
  createdAt: string
  updatedAt: string
  profileId?: string
}

export type TrainingGoalInput = Omit<TrainingGoal, 'id' | 'createdAt' | 'updatedAt'>

export type ScriptStatus = 'draft' | 'generated' | 'confirmed' | 'archived'
export type SceneComplexity = '简洁' | '适中' | '丰富'

export interface ScriptSceneConfig {
  theme: string
  sceneType: string
  complexity: SceneComplexity
  stepCount: number
  duration: number
  promptStyle: string
  environmentPrefs: string[]
  avoidElements: string[]
}

export interface ScriptStep {
  id: string
  title: string
  trigger: string
  prompt: string
  expectedBehavior: string
  completion: string
  observationPoints: string[]
}

export interface ScriptVersion {
  id: string
  version: number
  savedAt: string
  name: string
  objective: string
  scenarioSummary: string
  steps: ScriptStep[]
  note: string
}

export interface TrainingScript {
  id: string
  code: string
  learnerId: string
  goalId: string
  name: string
  objective: string
  scenarioSummary: string
  status: ScriptStatus
  version: number
  preparation: string[]
  environmentElements: string[]
  steps: ScriptStep[]
  sceneAdaptation: string
  cautions: string[]
  sceneConfig: ScriptSceneConfig
  createdAt: string
  updatedAt: string
  history: ScriptVersion[]
  generatedBy: 'mock' | 'api'
  isDemo: boolean
  confirmedAt?: string
}

export interface ScriptGenerationInput {
  learnerId: string
  goalId: string
  goalTitle: string
  sceneConfig: ScriptSceneConfig
  expectedBehavior: string
  completionStandard: string
  observationPoints: string[]
  extraNotes?: string
}

export type SceneSourceType = 'text' | 'image' | 'script'
export type SceneTaskStatus =
  | 'draft'
  | 'pending'
  | 'queued'
  | 'generating'
  | 'succeeded'
  | 'failed'

export interface ImageReference {
  id: string
  name: string
  size: number
  type: string
  previewUrl?: string
}

export interface SceneConfig {
  theme?: string
  sceneType: string
  visualStyle: string[]
  sensoryPrefs: string[]
  keyElements: string[]
  avoidElements: string[]
  characters: string
  complexity: SceneComplexity
}

export interface SceneGenerationInput {
  sourceType: SceneSourceType
  sceneName: string
  scenePurpose: string
  prompt: string
  learnerId?: string
  trainingGoalId?: string
  scriptId?: string
  imageReferences?: ImageReference[]
  sceneConfig: SceneConfig
}

export interface SceneTaskResult {
  previewSeed: string
  resolution: string
  previewUrl?: string
  sceneFileUrl?: string
  modelUrl?: string
  sceneUrl?: string
  notes: string
  isDemo: boolean
}

export interface SceneTask {
  id: string
  code: string
  sourceType: SceneSourceType
  sceneName: string
  scenePurpose: string
  prompt: string
  learnerId?: string
  trainingGoalId?: string
  scriptId?: string
  imageReferences: ImageReference[]
  sceneConfig: SceneConfig
  status: SceneTaskStatus
  progress: number
  createdAt: string
  updatedAt: string
  submittedAt?: string
  completedAt?: string
  result?: SceneTaskResult
  error?: { code: string; message: string }
  assetId?: string
  providerMode?: 'mock' | 'real'
  isDemo: boolean
  willFail?: boolean
}

export interface SceneTaskSubmitOptions {
  submit: boolean
}

export interface SceneAsset {
  id: string
  taskId: string
  name: string
  sceneType: string
  description: string
  learnerId?: string
  trainingGoalId?: string
  scriptId?: string
  sourceType: SceneSourceType
  createdAt: string
  updatedAt: string
  tags: string[]
  previewSeed: string
  previewUrl?: string
  sceneFileUrl?: string
  sceneUrl?: string
  isDemo: boolean
  note: string
  archivedAt?: string
}

export type ActivityType =
  | 'learner'
  | 'assessment'
  | 'profile'
  | 'goal'
  | 'script'
  | 'task'
  | 'asset'

export interface Activity {
  id: string
  type: ActivityType
  title: string
  detail: string
  at: string
  link?: string
}

export interface AppSettings {
  apiMode: 'mock' | 'live'
  apiBaseUrl: string
  uploadUrl: string
  requestTimeout: number
  simulateFailure: boolean
  simulateDelay: number
  showDemoBadge: boolean
}

export interface MockDatabase {
  learners: Learner[]
  assessments: AbilityAssessment[]
  profiles: AbilityProfile[]
  goals: TrainingGoal[]
  scripts: TrainingScript[]
  tasks: SceneTask[]
  assets: SceneAsset[]
  activities: Activity[]
}
