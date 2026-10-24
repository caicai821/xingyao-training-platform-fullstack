import { randomUUID } from 'node:crypto'
import type {
  DimensionEntryContent,
  GeneratedProfileContent,
  GeneratedScriptContent,
  LearnerContext,
  ScriptGenerationRequest,
  ScriptStepContent,
} from './types.js'

const DIMENSIONS: { key: string; name: string }[] = [
  { key: 'communication', name: '语言与沟通能力' },
  { key: 'social', name: '社交互动能力' },
  { key: 'attention', name: '注意力与任务参与度' },
  { key: 'emotion', name: '情绪识别与表达' },
  { key: 'adaptation', name: '环境适应能力' },
  { key: 'dailyLiving', name: '日常生活技能' },
  { key: 'cognition', name: '认知与指令理解能力' },
  { key: 'learning', name: '学习方式与兴趣偏好' },
]

const dimensionRecommendations: Record<string, string> = {
  communication: '从 3–5 秒等待与简短句式提示开始，鼓励在熟悉情境中主动表达。',
  social: '先安排两人一组的结构化互动，再逐步增加同伴数量与轮次。',
  attention: '减少桌面与背景干扰，将任务拆分为 5–8 分钟的小段。',
  emotion: '在情绪出现后使用表情卡帮助命名，避免对情绪作对错评价。',
  adaptation: '活动变化前提前预告，并保留固定的过渡信号与缓冲时间。',
  dailyLiving: '使用视觉流程卡呈现步骤，并在完成后一起检查结果。',
  cognition: '将多步指令拆分为单步或两步，并配合具体图示说明。',
  learning: '优先使用视觉材料与动手活动，并与学员现有兴趣建立联系。',
}

function scoreSentence(score: number) {
  if (score >= 5) return '该维度当前表现稳定且主动，可作为训练中的优势资源。'
  if (score >= 4) return '该维度在多数情境中表现良好，可在此基础上逐步增加难度。'
  if (score >= 3) return '该维度在提示与结构化支持下基本可以完成。'
  if (score >= 2) return '该维度目前需要较多提示与支持。'
  return '该维度目前需要持续支持，建议拆分目标逐步练习。'
}

export function buildMockProfile(
  learner: LearnerContext,
  scores: Record<string, DimensionEntryContent>,
  assessmentNotes: string,
  extraNotes?: string,
): GeneratedProfileContent {
  const entries = DIMENSIONS.map((dimension) => ({
    ...dimension,
    entry: scores[dimension.key] ?? {
      score: 3,
      description: '',
      strengths: '',
      concerns: '',
      observation: '',
    },
  }))
  const strongest = [...entries].sort((a, b) => b.entry.score - a.entry.score).slice(0, 2)
  const focus = [...entries].sort((a, b) => a.entry.score - b.entry.score).slice(0, 2)

  const summary = `从本次能力信息与补充观察看，${learner.name}在${strongest[0].name}、${strongest[1].name}方面表现相对稳定，${focus[0].name}、${focus[1].name}仍有进一步练习空间。${
    learner.traits.length ? `结合“${learner.traits.slice(0, 2).join('、')}”等个人特点，` : ''
  }建议先从结构清晰、干扰较少的情境开始练习，并将本结果作为辅助参考，经使用者确认后再用于训练方案。`

  const strengths = Array.from(
    new Set([
      ...strongest.map((item) => item.entry.strengths).filter(Boolean),
      learner.interests.length
        ? `对${learner.interests.slice(0, 2).join('、')}等活动有兴趣，可作为练习切入点`
        : '',
    ]),
  )
    .filter(Boolean)
    .slice(0, 4)

  const developmentAreas = Array.from(
    new Set(focus.map((item) => item.entry.concerns).filter(Boolean)),
  ).slice(0, 4)

  const recommendations = Array.from(
    new Set([
      ...focus.map((item) => dimensionRecommendations[item.key]),
      learner.promptPreference ? `提示方式建议：${learner.promptPreference}` : '',
      '记录每次练习中的提示次数与回应方式，按周回顾变化。',
    ]),
  )
    .filter(Boolean)
    .slice(0, 5)

  const dimensionInsights: Record<string, string> = {}
  for (const item of entries) {
    dimensionInsights[item.key] = `${scoreSentence(item.entry.score)}${item.entry.description}`
  }

  return {
    summary,
    strengths,
    developmentAreas,
    recommendations,
    dimensionInsights,
    observationSnapshot:
      extraNotes?.trim() ||
      assessmentNotes ||
      '本次分析基于能力信息录入记录生成，可作为进一步观察的参考。',
  }
}

const sceneTypeElements: Record<string, string[]> = {
  幼儿园教室: ['活动桌', '教师角色', '视觉提示卡', '收纳架'],
  小学课堂: ['独立课桌', '黑板', '流程卡', '材料托盘'],
  家庭客厅: ['沙发', '茶几', '情绪表情卡', '柔和照明'],
  活动游戏区: ['圆形地垫', '软球', '轮次图卡', '同伴角色'],
  社区超市: ['货架', '收银台', '购物篮', '店员角色'],
  户外公园: ['长椅', '树木', '步道', '开阔草地'],
  安静休息区: ['柔软座椅', '绿植', '书架', '柔和照明'],
}

const practiceTitles = ['引导练习', '等待与提示', '回应与强化', '情境迁移']

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function buildMockScript(
  input: ScriptGenerationRequest,
): GeneratedScriptContent {
  const { learner, goalTitle, sceneConfig } = input
  const stepCount = clamp(sceneConfig.stepCount, 2, 8)
  const { sceneType, theme, complexity, duration, promptStyle, environmentPrefs, avoidElements } =
    sceneConfig
  const steps: ScriptStepContent[] = []
  const displayName = learner.nickname || learner.name

  for (let index = 0; index < stepCount; index += 1) {
    const isFirst = index === 0
    const isLast = index === stepCount - 1
    const title = isFirst ? '进入情境' : isLast ? '回顾与结束' : practiceTitles[(index - 1) % practiceTitles.length]

    const promptByStyle: Record<string, string> = {
      视觉提示卡: `出示第 ${index + 1} 步提示卡，并指向当前需要关注的位置。`,
      示范引导: `教师先完成一次示范，再邀请${displayName}尝试。`,
      情境化语言: `“现在我们在${theme}里，接下来可以试着${goalTitle}。”`,
      等待与提示结合: `等待 3–5 秒，如未回应，再用简短语句提示：“${goalTitle}”。`,
      口头提示: `“${displayName}，我们试着${goalTitle}，一次做一步。”`,
    }

    const observationPool =
      input.observationPoints.length > 0
        ? input.observationPoints
        : ['参与度与停留时间', '需要的提示次数', '回应时的情绪状态']

    let trigger = isFirst ? '学员进入场景并安定下来后' : '上一步完成或得到提示后'
    let prompt = isFirst
      ? `“${displayName}，我们今天在这个场景里练习${goalTitle}。先看看周围有什么。”`
      : (promptByStyle[promptStyle] ?? promptByStyle['口头提示'])
    let expectedBehavior = isFirst
      ? '学员观察场景并保持停留，愿意跟随引导'
      : input.expectedBehavior || '学员在提示下完成当前步骤，并保持情绪平稳'
    let completion = isLast
      ? '完成一次简单回顾，能够指出自己完成的步骤'
      : input.completionStandard || '完成当前步骤，并在 5 秒内回应提示'
    let observationPoints = [
      observationPool[index % observationPool.length],
      index === 0 ? '进入场景的表现' : '提示次数与回应方式',
    ]

    if (title === '引导练习' && !isFirst) {
      trigger = '学员进入情境并安定后'
      expectedBehavior =
        input.expectedBehavior || `在提示下尝试${goalTitle}，出现可观察的目标行为`
      completion = input.completionStandard || '完成一次目标行为的尝试'
      observationPoints = [
        observationPool[index % observationPool.length],
        '目标行为出现的次数',
      ]
    } else if (title === '等待与提示') {
      trigger = '学员出现尝试动作或表达意愿后'
      prompt = `等待 3–5 秒，观察${displayName}的反应；如未回应，再用简短语句提示当前步骤。`
      expectedBehavior = '在等待时间内保持当前活动，并在提示后开始下一步'
      completion = '完成一次 3–5 秒的等待并回应提示'
      observationPoints = ['等待时长', '提示次数与回应方式']
    } else if (title === '回应与强化') {
      trigger = '学员完成一次尝试后'
      prompt = '“你刚才完成了这一步，我们一起看看做到了哪里。要不要再试一次？”'
      expectedBehavior = '接受反馈，并愿意再次尝试当前步骤'
      completion = '完成一次重复练习，情绪保持平稳'
      observationPoints = ['接受反馈的表现', '重复练习的主动性']
    } else if (title === '情境迁移') {
      trigger = '基本步骤完成后'
      prompt = `在场景中稍作调整，再次邀请${displayName}练习${goalTitle}。`
      expectedBehavior = '在新的位置或材料条件下重复目标行为'
      completion = '在新情境中完成一次目标行为'
      observationPoints = ['新情境中的迁移表现', '需要的提示次数']
    } else if (title === '回顾与结束') {
      trigger = '完成前一步练习后'
      prompt = `“${displayName}，今天我们练习了${goalTitle}。你觉得自己做到了哪一步？”`
      expectedBehavior = '与教师一起回顾流程，指出至少一个完成的步骤'
      completion = '完成一次简单回顾并指出完成的步骤'
      observationPoints = ['回顾时的参与度', '能否指出完成的步骤']
    }

    steps.push({
      id: `step_${randomUUID()}`,
      title,
      trigger,
      prompt,
      expectedBehavior,
      completion,
      observationPoints,
    })
  }

  const environmentElements = sceneTypeElements[sceneType] ?? ['活动桌', '提示卡', '教师角色']
  const prefsText = environmentPrefs.length ? environmentPrefs.join('、') : '简洁清晰的空间布局'
  const avoidText = avoidElements.length
    ? `避免出现${avoidElements.join('、')}。`
    : '避免无关装饰与突发噪音。'

  return {
    name: `${goalTitle} · ${sceneType}情境`,
    objective: `在${sceneType}情境中，围绕“${goalTitle}”完成 ${stepCount} 个连续步骤的练习。`,
    scenarioSummary: `以“${theme}”为主题布置${sceneType}，复杂程度为“${complexity}”，空间保持${prefsText}，重点支持“${goalTitle}”的练习。`,
    preparation: [
      `提前向学员展示本次流程与训练目标：${goalTitle}`,
      '检查场景中的关键对象、提示材料与角色位置',
      `预留约 ${duration} 分钟训练时间，并安排结束后的过渡时间`,
    ],
    environmentElements,
    steps,
    sceneAdaptation: `${sceneType}内保持${prefsText}，主要对象围绕训练步骤布置。${avoidText}建议训练时长控制在 ${duration} 分钟左右。`,
    cautions: [
      avoidElements.length ? `避免出现${avoidElements.join('、')}等干扰元素` : '避免无关装饰与突发噪音',
      '当学员出现明显不适或持续回避时，暂停练习并给予缓冲时间',
      '提示语保持简短，一次只呈现一个步骤',
    ],
  }
}
