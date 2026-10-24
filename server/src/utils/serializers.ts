import type { Prisma } from '@prisma/client'

type ScriptStep = {
  id: string
  title: string
  trigger: string
  prompt: string
  expectedBehavior: string
  completion: string
  observationPoints: string[]
}

const iso = (value: Date | null | undefined): string | undefined => value?.toISOString()
const dateOnly = (value: Date | null | undefined): string | undefined =>
  value ? value.toISOString().slice(0, 10) : undefined
const lower = (value: string) => value.toLowerCase()

export interface SerializerOptions {
  publicBaseUrl: string
}

export function contentUrl(options: SerializerOptions, fileId: string): string {
  return `${options.publicBaseUrl}/api/v1/uploads/${fileId}/content`
}

export function serializeUser(user: {
  id: string
  username: string
  displayName: string
  role: string
  status: string
  createdAt?: Date
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: lower(user.status),
    createdAt: user.createdAt?.toISOString(),
  }
}

export function serializeLearner(learner: Prisma.LearnerGetPayload<object>) {
  return {
    id: learner.id,
    code: learner.code,
    name: learner.name,
    nickname: learner.nickname ?? undefined,
    ageGroup: learner.ageGroup,
    status: lower(learner.status),
    traits: learner.traits,
    interests: learner.interests,
    communicationStyle: learner.communicationStyle,
    promptPreference: learner.promptPreference,
    environmentNotes: learner.environmentNotes,
    currentGoalText: learner.currentGoalText,
    notes: learner.notes,
    createdAt: learner.createdAt.toISOString(),
    updatedAt: learner.updatedAt.toISOString(),
    lastAssessmentAt: iso(learner.lastAssessmentAt),
  }
}

export function serializeAssessment(assessment: Prisma.AbilityAssessmentGetPayload<object>) {
  return {
    id: assessment.id,
    learnerId: assessment.learnerId,
    createdAt: assessment.createdAt.toISOString(),
    author: assessment.author,
    scores: assessment.scores,
    generalNotes: assessment.generalNotes,
  }
}

export function serializeProfile(profile: Prisma.AbilityProfileGetPayload<object>) {
  return {
    id: profile.id,
    learnerId: profile.learnerId,
    assessmentId: profile.assessmentId,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    status: lower(profile.status),
    summary: profile.summary,
    strengths: profile.strengths,
    developmentAreas: profile.developmentAreas,
    recommendations: profile.recommendations,
    dimensionInsights: profile.dimensionInsights as Record<string, string>,
    observationSnapshot: profile.observationSnapshot,
    generatedBy: (profile.generatedBy === 'mock' ? 'mock' : 'api') as 'mock' | 'api',
    isDemo: profile.isDemo,
    confirmedAt: iso(profile.confirmedAt),
  }
}

export function serializeGoal(goal: Prisma.TrainingGoalGetPayload<object>) {
  return {
    id: goal.id,
    learnerId: goal.learnerId,
    profileId: goal.profileId ?? undefined,
    title: goal.title,
    category: goal.category,
    description: goal.description,
    successCriteria: goal.successCriteria,
    relatedDimensions: goal.relatedDimensions,
    priority: lower(goal.priority),
    status: lower(goal.status),
    targetDate: dateOnly(goal.targetDate),
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  }
}

export function serializeScript(
  script: Prisma.TrainingScriptGetPayload<{ include: { versions: true } }>,
) {
  const versions = [...script.versions].sort((a, b) => a.version - b.version)
  return {
    id: script.id,
    code: script.code,
    learnerId: script.learnerId,
    goalId: script.goalId,
    name: script.name,
    objective: script.objective,
    scenarioSummary: script.scenarioSummary,
    status: lower(script.status),
    version: script.version,
    preparation: script.preparation,
    environmentElements: script.environmentElements,
    steps: script.steps as unknown as ScriptStep[],
    sceneAdaptation: script.sceneAdaptation,
    cautions: script.cautions,
    sceneConfig: script.sceneConfig,
    createdAt: script.createdAt.toISOString(),
    updatedAt: script.updatedAt.toISOString(),
    confirmedAt: iso(script.confirmedAt),
    history: versions.map((version) => ({
      id: version.id,
      version: version.version,
      savedAt: version.savedAt.toISOString(),
      name: version.name,
      objective: version.objective,
      scenarioSummary: version.scenarioSummary,
      steps: version.steps as unknown as ScriptStep[],
      note: version.note,
    })),
    generatedBy: (script.generatedBy === 'mock' ? 'mock' : 'api') as 'mock' | 'api',
    isDemo: script.isDemo,
  }
}

interface StoredImageReference {
  id: string
  name?: string
  size?: number
  type?: string
}

export function serializeTask(
  task: Prisma.SceneTaskGetPayload<{ include: { asset: true } }>,
  options: SerializerOptions,
) {
  const images = (task.imageReferences as unknown as StoredImageReference[] | null) ?? []
  return {
    id: task.id,
    code: task.code,
    sourceType: lower(task.sourceType),
    sceneName: task.sceneName,
    scenePurpose: task.scenePurpose,
    prompt: task.prompt,
    learnerId: task.learnerId ?? undefined,
    trainingGoalId: task.trainingGoalId ?? undefined,
    scriptId: task.scriptId ?? undefined,
    imageReferences: images.map((image) => ({
      ...image,
      previewUrl: contentUrl(options, image.id),
    })),
    sceneConfig: task.sceneConfig,
    status: lower(task.status),
    progress: task.progress,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    submittedAt: iso(task.submittedAt),
    completedAt: iso(task.completedAt),
    result: task.result ?? undefined,
    error: task.errorCode
      ? { code: task.errorCode, message: task.errorMessage ?? '生成失败' }
      : undefined,
    assetId: task.asset?.id,
    providerMode: task.providerMode,
    isDemo: task.isDemo,
  }
}

export function serializeAsset(
  asset: Prisma.SceneAssetGetPayload<{ include: { previewFile: true } }>,
  options: SerializerOptions,
) {
  return {
    id: asset.id,
    taskId: asset.taskId,
    name: asset.name,
    sceneType: asset.sceneType,
    description: asset.description,
    learnerId: asset.learnerId ?? undefined,
    trainingGoalId: asset.trainingGoalId ?? undefined,
    scriptId: asset.scriptId ?? undefined,
    sourceType: lower(asset.sourceType),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    tags: asset.tags,
    previewSeed: asset.previewSeed,
    previewUrl: asset.previewFile
      ? contentUrl(options, asset.previewFile.id)
      : (asset.previewUrl ?? undefined),
    sceneFileUrl: asset.sceneFileUrl ?? undefined,
    sceneUrl: asset.sceneUrl ?? undefined,
    isDemo: asset.isDemo,
    note: asset.note,
    archivedAt: iso(asset.archivedAt),
  }
}

export function serializeActivity(
  activity: Prisma.ActivityGetPayload<{ include: { actor: true } }>,
) {
  return {
    id: activity.id,
    type: lower(activity.type),
    title: activity.title,
    detail: activity.detail,
    at: activity.at.toISOString(),
    link: activity.link ?? undefined,
    actorName: activity.actor?.displayName ?? undefined,
  }
}

export function serializeUpload(
  file: Prisma.UploadFileGetPayload<object>,
  options: SerializerOptions,
) {
  const url = contentUrl(options, file.id)
  return {
    id: file.id,
    name: file.originalName,
    size: file.size,
    type: file.mimeType,
    previewUrl: url,
    url,
    createdAt: file.createdAt.toISOString(),
    uploadedById: file.uploadedById ?? undefined,
  }
}
