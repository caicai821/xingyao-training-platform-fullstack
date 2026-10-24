import { rm } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config/env.js'
import { createProviders, type Providers } from '../src/providers/index.js'
import { runTaskTick } from '../src/services/taskRunner.js'
import { createSignedContentUrl } from '../src/services/uploads.js'
import { signUploadContent } from '../src/utils/signing.js'
import {
  authHeaders,
  createApp,
  createPrisma,
  login,
  testConfig,
  multipart,
  resetDatabase,
  seedUsers,
  silentLogger,
  tinyPng,
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
      description: `${key} 观察`,
      strengths: '愿意尝试',
      concerns: '需要提示',
      observation: '记录',
    },
  ]),
)

const sceneConfig = {
  theme: '课堂请求帮助',
  sceneType: '小学课堂',
  complexity: '适中',
  stepCount: 4,
  duration: 20,
  promptStyle: '视觉提示卡',
  environmentPrefs: ['减少视觉干扰'],
  avoidElements: ['突发噪音'],
}

describe('core training workflow', () => {
  let prisma: PrismaClient
  let app: FastifyInstance
  let config: AppConfig
  let providers: Providers
  let cookie: string

  async function createLearner() {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/learners',
      headers: authHeaders(cookie),
      payload: {
        name: '流程测试学员',
        nickname: '小澄',
        ageGroup: '6-8 岁',
        status: 'active',
        traits: ['喜欢结构化任务'],
        interests: ['积木'],
        communicationStyle: '短句表达',
        promptPreference: '视觉提示卡',
        environmentNotes: '安静环境',
        currentGoalText: '',
        notes: '自动化测试',
      },
    })
    expect(response.statusCode).toBe(201)
    return response.json().data
  }

  beforeAll(async () => {
    prisma = createPrisma()
    const created = await createApp(prisma)
    app = created.app
    config = created.config
    providers = created.providers
  })

  beforeEach(async () => {
    await resetDatabase(prisma)
    await seedUsers(prisma)
    cookie = await login(app)
  })

  afterAll(async () => {
    await app.close()
    await prisma.$disconnect()
    await rm(path.resolve(process.cwd(), '.test-uploads'), { recursive: true, force: true })
  })

  it('runs learner → profile → goal → script → scene task → asset and survives a restart', async () => {
    const learner = await createLearner()

    const search = await app.inject({
      method: 'GET',
      url: '/api/v1/learners?q=流程&page=1&pageSize=10',
      headers: authHeaders(cookie),
    })
    expect(search.statusCode).toBe(200)
    expect(search.json().meta.total).toBe(1)

    const assessment = await app.inject({
      method: 'POST',
      url: `/api/v1/learners/${learner.id}/assessments`,
      headers: authHeaders(cookie),
      payload: { scores, generalNotes: '首次记录' },
    })
    expect(assessment.statusCode).toBe(201)
    const assessmentId = assessment.json().data.id

    const profile = await app.inject({
      method: 'POST',
      url: `/api/v1/learners/${learner.id}/profiles`,
      headers: authHeaders(cookie),
      payload: { assessmentId, extraNotes: '补充观察' },
    })
    expect(profile.statusCode).toBe(201)
    const profileData = profile.json().data
    expect(profileData.status).toBe('unconfirmed')
    expect(profileData.isDemo).toBe(true)
    expect(profileData.generatedBy).toBe('mock')
    expect(Object.keys(profileData.dimensionInsights)).toHaveLength(8)

    const updatedProfile = await app.inject({
      method: 'PATCH',
      url: `/api/v1/profiles/${profileData.id}`,
      headers: authHeaders(cookie),
      payload: { summary: '修改后的摘要' },
    })
    expect(updatedProfile.statusCode).toBe(200)
    expect(updatedProfile.json().data.status).toBe('unconfirmed')

    const confirmedProfile = await app.inject({
      method: 'POST',
      url: `/api/v1/profiles/${profileData.id}/confirm`,
      headers: authHeaders(cookie),
    })
    expect(confirmedProfile.statusCode).toBe(200)
    expect(confirmedProfile.json().data.status).toBe('confirmed')

    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/profiles/${profileData.id}/history`,
      headers: authHeaders(cookie),
    })
    expect(history.statusCode).toBe(200)
    expect(history.json().data.length).toBeGreaterThanOrEqual(3)

    const goal = await app.inject({
      method: 'POST',
      url: '/api/v1/training-goals',
      headers: authHeaders(cookie),
      payload: {
        learnerId: learner.id,
        title: '在课堂中主动请求帮助',
        category: '沟通表达',
        description: '练习用短句请求帮助',
        successCriteria: '一次活动中主动请求 1 次',
        relatedDimensions: ['communication', 'social'],
        priority: 'high',
        status: 'planning',
        targetDate: '2026-12-31',
      },
    })
    expect(goal.statusCode).toBe(201)
    const goalId = goal.json().data.id
    expect(goal.json().data.profileId).toBe(profileData.id)

    const goalStatus = await app.inject({
      method: 'POST',
      url: `/api/v1/training-goals/${goalId}/status`,
      headers: authHeaders(cookie),
      payload: { status: 'in_progress' },
    })
    expect(goalStatus.statusCode).toBe(200)
    expect(goalStatus.json().data.status).toBe('in_progress')

    const script = await app.inject({
      method: 'POST',
      url: '/api/v1/training-scripts/generate',
      headers: authHeaders(cookie),
      payload: {
        learnerId: learner.id,
        goalId,
        goalTitle: '在课堂中主动请求帮助',
        sceneConfig,
        expectedBehavior: '举手示意',
        completionStandard: '完成一次请求',
        observationPoints: ['提示次数'],
      },
    })
    expect(script.statusCode).toBe(201)
    const scriptId = script.json().data.id
    expect(script.json().data.status).toBe('generated')
    expect(script.json().data.isDemo).toBe(true)
    expect(script.json().data.steps.length).toBe(4)

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'script',
        sceneName: '未确认脚本任务',
        prompt: '测试',
        scriptId,
        sceneConfig: { sceneType: '小学课堂' },
        submit: true,
      },
    })
    expect(blocked.statusCode).toBe(409)
    expect(blocked.json().error.code).toBe('SCRIPT_NOT_CONFIRMED')

    const editedScript = await app.inject({
      method: 'PATCH',
      url: `/api/v1/training-scripts/${scriptId}?versionNote=调整步骤`,
      headers: authHeaders(cookie),
      payload: { objective: '修改后的目标' },
    })
    expect(editedScript.statusCode).toBe(200)
    expect(editedScript.json().data.version).toBe(2)
    expect(editedScript.json().data.history.length).toBe(2)

    const confirmedScript = await app.inject({
      method: 'POST',
      url: `/api/v1/training-scripts/${scriptId}/confirm`,
      headers: authHeaders(cookie),
    })
    expect(confirmedScript.statusCode).toBe(200)
    expect(confirmedScript.json().data.status).toBe('confirmed')

    const task = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'script',
        sceneName: '课堂请求帮助场景',
        scenePurpose: '练习请求帮助',
        prompt: '在小学课堂中练习主动请求帮助',
        scriptId,
        sceneConfig: { sceneType: '小学课堂', complexity: '适中' },
        submit: true,
      },
    })
    expect(task.statusCode).toBe(201)
    const taskId = task.json().data.id
    expect(task.json().data.status).toBe('pending')
    expect(task.json().data.providerMode).toBe('mock')

    await runTaskTick(prisma, config, providers, silentLogger)
    await runTaskTick(prisma, config, providers, silentLogger)

    const finished = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${taskId}`,
      headers: authHeaders(cookie),
    })
    expect(finished.statusCode).toBe(200)
    expect(finished.json().data.status).toBe('succeeded')
    expect(finished.json().data.progress).toBe(100)
    expect(finished.json().data.result.isDemo).toBe(true)

    const assetResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${taskId}/asset`,
      headers: authHeaders(cookie),
    })
    expect(assetResponse.statusCode).toBe(200)
    const asset = assetResponse.json().data
    expect(asset.taskId).toBe(taskId)
    expect(asset.isDemo).toBe(true)

    await runTaskTick(prisma, config, providers, silentLogger)
    expect(await prisma.sceneAsset.count({ where: { taskId } })).toBe(1)

    const retrySucceeded = await app.inject({
      method: 'POST',
      url: `/api/v1/scene-tasks/${taskId}/retry`,
      headers: authHeaders(cookie),
    })
    expect(retrySucceeded.statusCode).toBe(409)
    expect(retrySucceeded.json().error.code).toBe('INVALID_STATUS_TRANSITION')

    const assetUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/scene-assets/${asset.id}`,
      headers: authHeaders(cookie),
      payload: { name: '课堂请求帮助场景（已整理）', tags: ['小学课堂', '已整理'] },
    })
    expect(assetUpdate.statusCode).toBe(200)
    expect(assetUpdate.json().data.name).toContain('已整理')

    const listAssets = await app.inject({
      method: 'GET',
      url: '/api/v1/scene-assets?q=已整理',
      headers: authHeaders(cookie),
    })
    expect(listAssets.statusCode).toBe(200)
    expect(listAssets.json().data.length).toBe(1)

    // restart backend and confirm persisted data survives
    await app.close()
    const restarted = await createApp(prisma)
    app = restarted.app
    const newCookie = await login(app)
    const persistedLearner = await app.inject({
      method: 'GET',
      url: `/api/v1/learners/${learner.id}`,
      headers: authHeaders(newCookie),
    })
    expect(persistedLearner.statusCode).toBe(200)
    expect(persistedLearner.json().data.name).toBe('流程测试学员')
    const persistedTask = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${taskId}`,
      headers: authHeaders(newCookie),
    })
    expect(persistedTask.statusCode).toBe(200)
    expect(persistedTask.json().data.status).toBe('succeeded')

    const activities = await app.inject({
      method: 'GET',
      url: '/api/v1/activities?limit=50',
      headers: authHeaders(newCookie),
    })
    expect(activities.statusCode).toBe(200)
    expect(activities.json().data.length).toBeGreaterThan(5)
  })

  it('marks tasks failed when the provider mode changes, then allows retry', async () => {
    const realConfig = testConfig({
      SCENE_PROVIDER: 'real',
      SCENE_PROVIDER_URL: '',
      SCENE_PROVIDER_TOKEN: '',
    })
    const realProviders = createProviders(realConfig)

    const task = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'text',
        sceneName: '切换模式失败任务',
        prompt: '用于验证失败与重试',
        sceneConfig: { sceneType: '安静休息区' },
        submit: true,
      },
    })
    expect(task.statusCode).toBe(201)
    const taskId = task.json().data.id

    await runTaskTick(prisma, realConfig, realProviders, silentLogger)

    const failed = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${taskId}`,
      headers: authHeaders(cookie),
    })
    expect(failed.json().data.status).toBe('failed')
    expect(failed.json().data.error.code).toBe('PROVIDER_ERROR')

    const retry = await app.inject({
      method: 'POST',
      url: `/api/v1/scene-tasks/${taskId}/retry`,
      headers: authHeaders(cookie),
    })
    expect(retry.statusCode).toBe(200)
    expect(retry.json().data.status).toBe('pending')

    await runTaskTick(prisma, config, providers, silentLogger)
    const recovered = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${taskId}`,
      headers: authHeaders(cookie),
    })
    expect(recovered.json().data.status).toBe('succeeded')
  })

  it('resumes pending tasks after a backend restart', async () => {
    const task = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'text',
        sceneName: '重启恢复任务',
        prompt: '用于验证后端重启后的任务恢复',
        sceneConfig: { sceneType: '安静休息区' },
        submit: true,
      },
    })
    expect(task.statusCode).toBe(201)
    const taskId = task.json().data.id

    await app.close()
    const restarted = await createApp(prisma)
    app = restarted.app
    config = restarted.config
    providers = restarted.providers
    const newCookie = await login(app)

    const beforeTick = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${taskId}`,
      headers: authHeaders(newCookie),
    })
    expect(beforeTick.json().data.status).toBe('pending')

    await runTaskTick(prisma, config, providers, silentLogger)
    const afterTick = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${taskId}`,
      headers: authHeaders(newCookie),
    })
    expect(afterTick.json().data.status).toBe('succeeded')
  })

  it('uploads images and creates an image-based task with a server reference', async () => {
    const form = multipart(tinyPng)
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/uploads',
      headers: {
        ...authHeaders(cookie),
        'content-type': form.contentType,
      },
      payload: form.payload,
    })
    expect(upload.statusCode).toBe(201)
    const file = upload.json().data
    expect(file.type).toBe('image/png')
    expect(file.previewUrl).toContain(`/api/v1/uploads/${file.id}/content`)

    const content = await app.inject({
      method: 'GET',
      url: `/api/v1/uploads/${file.id}/content`,
      headers: authHeaders(cookie),
    })
    expect(content.statusCode).toBe(200)
    expect(content.headers['content-type']).toContain('image/png')

    const signed = createSignedContentUrl(config, file.id)
    const signedUrl = new URL(signed)
    expect(signedUrl.searchParams.get('signature')).toBeTruthy()
    const signedResponse = await app.inject({
      method: 'GET',
      url: signedUrl.pathname + signedUrl.search,
    })
    expect(signedResponse.statusCode).toBe(200)
    expect(signedResponse.headers['content-type']).toContain('image/png')

    const tamperedUrl = new URL(signed)
    tamperedUrl.searchParams.set('signature', 'invalid-signature')
    const tamperedResponse = await app.inject({
      method: 'GET',
      url: tamperedUrl.pathname + tamperedUrl.search,
    })
    expect(tamperedResponse.statusCode).toBe(401)

    const expiredAt = Date.now() - 1000
    const expiredSignature = signUploadContent(config.uploadSigningSecret, file.id, expiredAt)
    const expiredResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/uploads/${file.id}/content?expires=${expiredAt}&signature=${expiredSignature}`,
    })
    expect(expiredResponse.statusCode).toBe(401)

    const bad = multipart(Buffer.from('not really an image'), 'fake.png', 'image/png')
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/uploads',
      headers: { ...authHeaders(cookie), 'content-type': bad.contentType },
      payload: bad.payload,
    })
    expect(rejected.statusCode).toBe(415)
    expect(rejected.json().error.code).toBe('UNSUPPORTED_FILE_TYPE')

    const oversized = multipart(Buffer.alloc(2 * 1024 * 1024 + 64, 0x89), 'too-large.png', 'image/png')
    const oversizedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/uploads',
      headers: { ...authHeaders(cookie), 'content-type': oversized.contentType },
      payload: oversized.payload,
    })
    expect(oversizedResponse.statusCode).toBe(413)

    const unsupported = multipart(Buffer.from('plain text'), 'note.txt', 'text/plain')
    const unsupportedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/uploads',
      headers: { ...authHeaders(cookie), 'content-type': unsupported.contentType },
      payload: unsupported.payload,
    })
    expect(unsupportedResponse.statusCode).toBe(415)

    const task = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'image',
        sceneName: '图像参考场景',
        scenePurpose: '根据参考图创建',
        prompt: '根据上传图片生成场景',
        imageReferences: [{ id: file.id, name: 'ignored.png', size: 1, type: 'text/plain' }],
        sceneConfig: { sceneType: '家庭客厅', complexity: '适中' },
        submit: true,
      },
    })
    expect(task.statusCode).toBe(201)
    const imageRef = task.json().data.imageReferences[0]
    expect(imageRef.id).toBe(file.id)
    expect(imageRef.type).toBe('image/png')
    expect(imageRef.previewUrl).toContain(file.id)

    await runTaskTick(prisma, config, providers, silentLogger)
    const finished = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${task.json().data.id}`,
      headers: authHeaders(cookie),
    })
    expect(finished.json().data.status).toBe('succeeded')

    const asset = await app.inject({
      method: 'GET',
      url: `/api/v1/scene-tasks/${task.json().data.id}/asset`,
      headers: authHeaders(cookie),
    })
    expect(asset.statusCode).toBe(200)
    expect(asset.json().data.previewUrl).toContain(file.id)
  })

  it('validates input and returns structured errors', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/learners',
      headers: authHeaders(cookie),
      payload: { name: '', ageGroup: '' },
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json().error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(invalid.json().error.details)).toBe(true)

    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/learners/does-not-exist',
      headers: authHeaders(cookie),
    })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().error.code).toBe('NOT_FOUND')

    const imageWithoutFile = await app.inject({
      method: 'POST',
      url: '/api/v1/scene-tasks',
      headers: authHeaders(cookie),
      payload: {
        sourceType: 'image',
        sceneName: '缺图任务',
        sceneConfig: { sceneType: '家庭客厅' },
        submit: true,
      },
    })
    expect(imageWithoutFile.statusCode).toBe(400)
    expect(imageWithoutFile.json().error.code).toBe('VALIDATION_ERROR')
  })
})
