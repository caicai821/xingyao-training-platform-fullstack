import type {
  AbilityAssessment,
  AbilityProfile,
  AbilityScores,
  Activity,
  AppSettings,
  ImageReference,
  Learner,
  LearnerInput,
  SceneAsset,
  SceneGenerationInput,
  SceneTask,
  SceneTaskSubmitOptions,
  ScriptGenerationInput,
  TrainingGoal,
  TrainingGoalInput,
  TrainingScript,
} from '@/types'
import type { SceneConfigInput, TrainingServices } from '../contracts'
import { apiRequest, apiRequestOrNull, apiUpload } from '../http'
import { getSettings, resetSettings, saveSettings } from '../settingsStore'

const encode = encodeURIComponent

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
})

const patch = (body: unknown): RequestInit => ({
  method: 'PATCH',
  body: JSON.stringify(body),
})

export const apiServices: TrainingServices = {
  learners: {
    list: () => apiRequest<Learner[]>('/learners?pageSize=200'),
    get: (id) => apiRequestOrNull<Learner>(`/learners/${encode(id)}`),
    create: (input: LearnerInput) => apiRequest<Learner>('/learners', post(input)),
    update: (id, input) =>
      apiRequest<Learner>(`/learners/${encode(id)}`, patch(input)),
  },
  assessments: {
    list: () => apiRequest<AbilityAssessment[]>('/assessments'),
    listByLearner: (learnerId) =>
      apiRequest<AbilityAssessment[]>(`/learners/${encode(learnerId)}/assessments`),
    save: (input: { learnerId: string; scores: AbilityScores; generalNotes: string; author?: string }) =>
      apiRequest<AbilityAssessment>(
        `/learners/${encode(input.learnerId)}/assessments`,
        post({
          scores: input.scores,
          generalNotes: input.generalNotes,
          author: input.author,
        }),
      ),
  },
  profiles: {
    list: () => apiRequest<AbilityProfile[]>('/profiles?pageSize=200'),
    listByLearner: (learnerId) =>
      apiRequest<AbilityProfile[]>(`/learners/${encode(learnerId)}/profiles`),
    generate: (input) =>
      apiRequest<AbilityProfile>(
        `/learners/${encode(input.learnerId)}/profiles`,
        post({ assessmentId: input.assessmentId, extraNotes: input.extraNotes }),
      ),
    update: (id, input) =>
      apiRequest<AbilityProfile>(`/profiles/${encode(id)}`, patch(input)),
    confirm: (id) =>
      apiRequest<AbilityProfile>(`/profiles/${encode(id)}/confirm`, { method: 'POST' }),
  },
  goals: {
    list: () => apiRequest<TrainingGoal[]>('/training-goals?pageSize=200'),
    get: (id) => apiRequestOrNull<TrainingGoal>(`/training-goals/${encode(id)}`),
    create: (input: TrainingGoalInput) =>
      apiRequest<TrainingGoal>('/training-goals', post(input)),
    update: (id, input) =>
      apiRequest<TrainingGoal>(`/training-goals/${encode(id)}`, patch(input)),
  },
  scripts: {
    list: () => apiRequest<TrainingScript[]>('/training-scripts?pageSize=200'),
    get: (id) => apiRequestOrNull<TrainingScript>(`/training-scripts/${encode(id)}`),
    generate: (input: ScriptGenerationInput) =>
      apiRequest<TrainingScript>('/training-scripts/generate', post(input)),
    update: (id, input, versionNote) => {
      const query = versionNote ? `?versionNote=${encode(versionNote)}` : ''
      return apiRequest<TrainingScript>(
        `/training-scripts/${encode(id)}${query}`,
        patch(input),
      )
    },
    confirm: (id) =>
      apiRequest<TrainingScript>(`/training-scripts/${encode(id)}/confirm`, {
        method: 'POST',
      }),
    regenerate: (id, overrides?: Partial<SceneConfigInput>) =>
      apiRequest<TrainingScript>(
        `/training-scripts/${encode(id)}/regenerate`,
        post(overrides ?? {}),
      ),
    duplicate: (id) =>
      apiRequest<TrainingScript>(`/training-scripts/${encode(id)}/duplicate`, {
        method: 'POST',
      }),
  },
  tasks: {
    list: () => apiRequest<SceneTask[]>('/scene-tasks?pageSize=200'),
    get: (id) => apiRequestOrNull<SceneTask>(`/scene-tasks/${encode(id)}`),
    create: (input: SceneGenerationInput, options: SceneTaskSubmitOptions) =>
      apiRequest<SceneTask>('/scene-tasks', post({ ...input, submit: options.submit })),
    submit: (id) =>
      apiRequest<SceneTask>(`/scene-tasks/${encode(id)}/submit`, { method: 'POST' }),
    retry: (id) =>
      apiRequest<SceneTask>(`/scene-tasks/${encode(id)}/retry`, { method: 'POST' }),
    sync: async () => {
      await apiRequest<SceneTask[]>('/scene-tasks?pageSize=200')
    },
  },
  assets: {
    list: () => apiRequest<SceneAsset[]>('/scene-assets?pageSize=200'),
    get: (id) => apiRequestOrNull<SceneAsset>(`/scene-assets/${encode(id)}`),
    update: (id, input) =>
      apiRequest<SceneAsset>(`/scene-assets/${encode(id)}`, patch(input)),
  },
  activities: {
    list: () => apiRequest<Activity[]>('/activities'),
  },
  uploads: {
    async uploadImage(file, onProgress) {
      const payload = await apiUpload<ImageReference & { url?: string }>(file, onProgress)
      return {
        id: payload.id,
        name: payload.name,
        size: payload.size,
        type: payload.type,
        previewUrl: payload.previewUrl ?? payload.url,
      }
    },
  },
  settings: {
    get(): AppSettings {
      return getSettings()
    },
    save(patchValue) {
      return saveSettings(patchValue)
    },
    reset() {
      return resetSettings()
    },
    async resetDemoData() {
      throw new Error('演示数据重置仅在演示模式下可用')
    },
  },
}
