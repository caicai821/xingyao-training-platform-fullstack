import { z } from 'zod'

export const abilityDimensionKeys = [
  'communication',
  'social',
  'attention',
  'emotion',
  'adaptation',
  'dailyLiving',
  'cognition',
  'learning',
] as const

export const dimensionKeySchema = z.enum(abilityDimensionKeys)

export const learnerStatusSchema = z.enum(['active', 'paused', 'archived'])
export const profileStatusSchema = z.enum(['unconfirmed', 'confirmed'])
export const goalStatusSchema = z.enum(['planning', 'in_progress', 'completed', 'archived'])
export const goalPrioritySchema = z.enum(['high', 'medium', 'low'])
export const scriptStatusSchema = z.enum(['draft', 'generated', 'confirmed', 'archived'])
export const sceneSourceTypeSchema = z.enum(['text', 'image', 'script'])
export const sceneTaskStatusSchema = z.enum([
  'draft',
  'pending',
  'queued',
  'generating',
  'succeeded',
  'failed',
])
export const sceneComplexitySchema = z.enum(['简洁', '适中', '丰富'])

const mediumText = z.string().trim().max(600)
const longText = z.string().trim().max(4000)
const stringArray = z.array(z.string().trim().min(1).max(80)).max(50)

export const paginationQuery = {
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
}

export const idParamsSchema = z.object({ id: z.string().min(1).max(64) })

/* ------------------------------- auth ---------------------------------- */

export const loginSchema = z.object({
  username: z.string().trim().min(1, '请输入账号').max(100),
  password: z.string().min(1, '请输入密码').max(200),
})

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '账号至少 3 位')
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, '账号只能包含字母、数字、点、下划线和连字符'),
  password: z.string().min(8, '密码至少 8 位').max(200),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
})

/* ------------------------------ learner -------------------------------- */

const learnerFields = {
  name: z.string().trim().min(1, '请填写学员姓名或匿名编号').max(80),
  nickname: z.string().trim().max(80).optional(),
  ageGroup: z.string().trim().min(1, '请选择年龄段').max(40),
  status: learnerStatusSchema,
  traits: stringArray,
  interests: stringArray,
  communicationStyle: mediumText,
  promptPreference: mediumText,
  environmentNotes: longText,
  currentGoalText: mediumText,
  notes: longText,
}

export const learnerCreateSchema = z.object({
  ...learnerFields,
  status: learnerFields.status.default('active'),
  traits: learnerFields.traits.default([]),
  interests: learnerFields.interests.default([]),
  communicationStyle: learnerFields.communicationStyle.default(''),
  promptPreference: learnerFields.promptPreference.default(''),
  environmentNotes: learnerFields.environmentNotes.default(''),
  currentGoalText: learnerFields.currentGoalText.default(''),
  notes: learnerFields.notes.default(''),
})

export const learnerUpdateSchema = z.object(learnerFields).partial()

export const learnerListQuery = z.object({
  ...paginationQuery,
  q: z.string().trim().max(120).optional(),
  status: learnerStatusSchema.optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
})

/* ---------------------------- assessment ------------------------------- */

const dimensionEntrySchema = z.object({
  score: z.number().int().min(1).max(5),
  description: z.string().max(2000).default(''),
  strengths: z.string().max(2000).default(''),
  concerns: z.string().max(2000).default(''),
  observation: z.string().max(2000).default(''),
})

export const scoresSchema = z.object({
  communication: dimensionEntrySchema,
  social: dimensionEntrySchema,
  attention: dimensionEntrySchema,
  emotion: dimensionEntrySchema,
  adaptation: dimensionEntrySchema,
  dailyLiving: dimensionEntrySchema,
  cognition: dimensionEntrySchema,
  learning: dimensionEntrySchema,
})

export const assessmentCreateSchema = z.object({
  scores: scoresSchema,
  generalNotes: z.string().max(6000).default(''),
  author: z.string().trim().max(120).optional(),
})

/* ------------------------------ profile -------------------------------- */

export const profileGenerateSchema = z.object({
  assessmentId: z.string().min(1, '请先完成本次能力信息录入'),
  extraNotes: z.string().max(6000).optional(),
})

export const profileUpdateSchema = z.object({
  summary: z.string().max(6000).optional(),
  strengths: stringArray.optional(),
  developmentAreas: stringArray.optional(),
  recommendations: stringArray.optional(),
  dimensionInsights: z.record(z.string(), z.string().max(4000)).optional(),
  observationSnapshot: z.string().max(6000).optional(),
})

export const profileListQuery = z.object({
  ...paginationQuery,
  learnerId: z.string().min(1).max(64).optional(),
  status: profileStatusSchema.optional(),
})

/* -------------------------------- goal --------------------------------- */

const targetDateSchema = z.string().trim().max(40).optional()

const goalFields = {
  learnerId: z.string().min(1, '请选择关联学员'),
  profileId: z.string().min(1).max(64).optional(),
  title: z.string().trim().min(1, '请填写训练目标名称').max(160),
  category: z.string().trim().max(60),
  description: z.string().trim().max(4000),
  successCriteria: z.string().trim().max(2000),
  relatedDimensions: z.array(dimensionKeySchema).max(8),
  priority: goalPrioritySchema,
  status: goalStatusSchema,
  targetDate: targetDateSchema,
}

export const goalCreateSchema = z.object({
  ...goalFields,
  profileId: goalFields.profileId,
  category: goalFields.category.default(''),
  description: goalFields.description.default(''),
  successCriteria: goalFields.successCriteria.default(''),
  relatedDimensions: goalFields.relatedDimensions.default([]),
  priority: goalFields.priority.default('medium'),
  status: goalFields.status.default('planning'),
})

export const goalUpdateSchema = z.object(goalFields).partial()

export const goalStatusSchemaBody = z.object({ status: goalStatusSchema })

export const goalListQuery = z.object({
  ...paginationQuery,
  learnerId: z.string().min(1).max(64).optional(),
  profileId: z.string().min(1).max(64).optional(),
  status: goalStatusSchema.optional(),
  q: z.string().trim().max(120).optional(),
})

/* ------------------------------- script -------------------------------- */

export const scriptStepSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(200),
  trigger: z.string().trim().max(1000),
  prompt: z.string().trim().max(2000),
  expectedBehavior: z.string().trim().max(2000),
  completion: z.string().trim().max(2000),
  observationPoints: z.array(z.string().trim().min(1).max(200)).max(20),
})

export const scriptSceneConfigSchema = z.object({
  theme: z.string().trim().min(1).max(200),
  sceneType: z.string().trim().min(1).max(80),
  complexity: sceneComplexitySchema,
  stepCount: z.number().int().min(2).max(8),
  duration: z.number().int().min(5).max(60),
  promptStyle: z.string().trim().max(80),
  environmentPrefs: z.array(z.string().trim().min(1).max(120)).max(20),
  avoidElements: z.array(z.string().trim().min(1).max(120)).max(20),
})

export const scriptGenerateSchema = z.object({
  learnerId: z.string().min(1, '请选择学员'),
  goalId: z.string().min(1, '请选择训练目标'),
  goalTitle: z.string().trim().max(160).default(''),
  sceneConfig: scriptSceneConfigSchema,
  expectedBehavior: z.string().trim().max(2000).default(''),
  completionStandard: z.string().trim().max(2000).default(''),
  observationPoints: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  extraNotes: z.string().trim().max(4000).optional(),
})

export const scriptCreateSchema = z.object({
  learnerId: z.string().min(1),
  goalId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  objective: z.string().trim().max(2000).default(''),
  scenarioSummary: z.string().trim().max(4000).default(''),
  preparation: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  environmentElements: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  steps: z.array(scriptStepSchema).min(1).max(20),
  sceneAdaptation: z.string().trim().max(4000).default(''),
  cautions: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  sceneConfig: scriptSceneConfigSchema,
  status: z.enum(['draft', 'generated']).default('draft'),
})

export const scriptUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    objective: z.string().trim().max(2000),
    scenarioSummary: z.string().trim().max(4000),
    preparation: z.array(z.string().trim().min(1).max(300)).max(30),
    environmentElements: z.array(z.string().trim().min(1).max(200)).max(30),
    steps: z.array(scriptStepSchema).min(1).max(20),
    sceneAdaptation: z.string().trim().max(4000),
    cautions: z.array(z.string().trim().min(1).max(300)).max(30),
    sceneConfig: scriptSceneConfigSchema,
  })
  .partial()

export const scriptUpdateQuery = z.object({
  versionNote: z.string().trim().max(200).optional(),
})

export const scriptRegenerateSchema = z
  .object({
    theme: z.string().trim().min(1).max(200),
    sceneType: z.string().trim().min(1).max(80),
    complexity: sceneComplexitySchema,
    stepCount: z.number().int().min(2).max(8),
    duration: z.number().int().min(5).max(60),
    promptStyle: z.string().trim().max(80),
    environmentPrefs: z.array(z.string().trim().min(1).max(120)).max(20),
    avoidElements: z.array(z.string().trim().min(1).max(120)).max(20),
  })
  .partial()

export const scriptListQuery = z.object({
  ...paginationQuery,
  learnerId: z.string().min(1).max(64).optional(),
  goalId: z.string().min(1).max(64).optional(),
  status: scriptStatusSchema.optional(),
  q: z.string().trim().max(120).optional(),
})

/* -------------------------------- scene -------------------------------- */

export const imageReferenceSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(260).optional(),
  size: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
  type: z.string().max(100).optional(),
  previewUrl: z.string().max(2000).optional(),
})

export const sceneConfigSchema = z.object({
  theme: z.string().trim().max(200).optional(),
  sceneType: z.string().trim().min(1, '请选择场景类型').max(80),
  visualStyle: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  sensoryPrefs: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  keyElements: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  avoidElements: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  characters: z.string().trim().max(1000).default(''),
  complexity: sceneComplexitySchema.default('适中'),
})

export const sceneTaskCreateSchema = z.object({
  sourceType: sceneSourceTypeSchema,
  sceneName: z.string().trim().min(1, '请填写场景名称').max(200),
  scenePurpose: z.string().trim().max(1000).default(''),
  prompt: z.string().trim().max(6000).default(''),
  learnerId: z.string().min(1).max(64).optional(),
  trainingGoalId: z.string().min(1).max(64).optional(),
  scriptId: z.string().min(1).max(64).optional(),
  imageReferences: z.array(imageReferenceSchema).max(5).default([]),
  sceneConfig: sceneConfigSchema,
  submit: z.boolean().default(false),
})

export const sceneTaskListQuery = z.object({
  ...paginationQuery,
  q: z.string().trim().max(120).optional(),
  status: sceneTaskStatusSchema.optional(),
  learnerId: z.string().min(1).max(64).optional(),
  scriptId: z.string().min(1).max(64).optional(),
  sourceType: sceneSourceTypeSchema.optional(),
})

export const assetUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000),
    tags: z.array(z.string().trim().min(1).max(60)).max(30),
    note: z.string().trim().max(4000),
  })
  .partial()

export const assetListQuery = z.object({
  ...paginationQuery,
  q: z.string().trim().max(120).optional(),
  learnerId: z.string().min(1).max(64).optional(),
  scriptId: z.string().min(1).max(64).optional(),
  taskId: z.string().min(1).max(64).optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
})

/* ------------------------------ activity ------------------------------- */

export const activityListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(80),
})

export type LoginInput = z.infer<typeof loginSchema>
export type LearnerCreateInput = z.infer<typeof learnerCreateSchema>
export type LearnerUpdateInput = z.infer<typeof learnerUpdateSchema>
export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type GoalCreateInput = z.infer<typeof goalCreateSchema>
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>
export type ScriptGenerateInput = z.infer<typeof scriptGenerateSchema>
export type ScriptCreateInput = z.infer<typeof scriptCreateSchema>
export type ScriptUpdateInput = z.infer<typeof scriptUpdateSchema>
export type SceneTaskCreateInput = z.infer<typeof sceneTaskCreateSchema>
export type ImageReferenceInput = z.infer<typeof imageReferenceSchema>
export type SceneConfigInput = z.infer<typeof sceneConfigSchema>
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>
