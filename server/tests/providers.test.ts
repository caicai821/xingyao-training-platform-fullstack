import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  authHeaders,
  createApp,
  createPrisma,
  login,
  resetDatabase,
  seedUsers,
} from './helpers.js'

const scores = Object.fromEntries(
  [
    'communication',
    'social',
    'attention',
    'emotion',
    'adaptation',
    'dailyLiving',
    'cognition',
    'learning',
  ].map((key) => [
    key,
    {
      score: 3,
      description: '',
      strengths: '',
      concerns: '',
      observation: '',
    },
  ]),
)

describe('real provider mode without configuration', () => {
  let prisma: PrismaClient
  let app: FastifyInstance
  let cookie: string

  beforeAll(async () => {
    prisma = createPrisma()
    const created = await createApp(prisma, {
      SCRIPT_PROVIDER: 'real',
      SCRIPT_PROVIDER_URL: '',
      SCRIPT_PROVIDER_TOKEN: '',
      PROFILE_PROVIDER: 'real',
      PROFILE_PROVIDER_URL: '',
      PROFILE_PROVIDER_TOKEN: '',
      SCENE_PROVIDER: 'real',
      SCENE_PROVIDER_URL: '',
      SCENE_PROVIDER_TOKEN: '',
    })
    app = created.app
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    await seedUsers(prisma)
    cookie = await login(app)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
  })

  it('reports unconfigured providers in health', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(response.statusCode).toBe(200)
    const generation = response.json().data.generation
    expect(generation.scene.mode).toBe('real')
    expect(generation.scene.configured).toBe(false)
    expect(generation.script.configured).toBe(false)
    expect(generation.profile.configured).toBe(false)
  })

  it('never fakes success when real providers are missing', async () => {
    const learner = await app.inject({
      method: 'POST',
      url: '/api/v1/learners',
      headers: authHeaders(cookie),
      payload: {
        name: 'Provider 测试学员',
        ageGroup: '6-8 岁',
        status: 'active',
        traits: [],
        interests: [],
        communicationStyle: '',
        promptPreference: '',
        environmentNotes: '',
        currentGoalText: '',
        notes: '',
      },
    })
    expect(learner.statusCode).toBe(201)
    const learnerId = learner.json().data.id

    const assessment = await app.inject({
      method: 'POST',
      url: `/api/v1/learners/${learnerId}/assessments`,
      headers: authHeaders(cookie),
      payload: { scores, generalNotes: '' },
    })
    expect(assessment.statusCode).toBe(201)

    const profile = await app.inject({
      method: 'POST',
      url: `/api/v1/learners/${learnerId}/profiles`,
      headers: authHeaders(cookie),
      payload: { assessmentId: assessment.json().data.id },
    })
    expect(profile.statusCode).toBe(503)
    expect(profile.json().error.code).toBe('PROVIDER_NOT_CONFIGURED')

    const goal = await app.inject({
      method: 'POST',
      url: '/api/v1/training-goals',
      headers: authHeaders(cookie),
      payload: {
        learnerId,
        title: 'Provider 目标',
        category: '',
        description: '',
        successCriteria: '',
        relatedDimensions: [],
        priority: 'medium',
        status: 'planning',
      },
    })
    expect(goal.statusCode).toBe(201)
    const goalId = goal.json().data.id

    const script = await app.inject({
      method: 'POST',
      url: '/api/v1/training-scripts/generate',
      headers: authHeaders(cookie),
      payload: {
        learnerId,
        goalId,
        goalTitle: 'Provider 目标',
        sceneConfig: {
          theme: '测试',
          sceneType: '小学课堂',
          complexity: '适中',
          stepCount: 3,
          duration: 15,
          promptStyle: '口头提示',
          environmentPrefs: [],
          avoidElements: [],
        },
      },
    })
    expect(script.statusCode).toBe(503)
    expect(script.json().error.code).toBe('PROVIDER_NOT_CONFIGURED')

    const draft = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'text',
        sceneName: '真实模式草稿',
        prompt: '测试',
        sceneConfig: { sceneType: '小学课堂' },
        submit: false,
      },
    })
    expect(draft.statusCode).toBe(201)
    expect(draft.json().data.status).toBe('draft')
    expect(draft.json().data.providerMode).toBe('real')
    expect(draft.json().data.isDemo).toBe(false)

    const submitDraft = await app.inject({
      method: 'POST',
      url: `/api/v1/scene-tasks/${draft.json().data.id}/submit`,
      headers: authHeaders(cookie),
    })
    expect(submitDraft.statusCode).toBe(503)
    expect(submitDraft.json().error.code).toBe('PROVIDER_NOT_CONFIGURED')

    const stillDraft = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${draft.json().data.id}`,
      headers: authHeaders(cookie),
    })
    expect(stillDraft.json().data.status).toBe('draft')

    const directSubmit = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'text',
        sceneName: '真实模式提交',
        prompt: '测试',
        sceneConfig: { sceneType: '小学课堂' },
        submit: true,
      },
    })
    expect(directSubmit.statusCode).toBe(503)
    expect(directSubmit.json().error.code).toBe('PROVIDER_NOT_CONFIGURED')

    const tasks = await app.inject({
      method: 'GET',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
    })
    expect(tasks.json().meta.total).toBe(1)
  })
})
