import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { copyFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const prisma = new PrismaClient()

type DemoData = {
  learners: Prisma.LearnerCreateManyInput[]
  assessments: Prisma.AbilityAssessmentCreateManyInput[]
  profiles: Prisma.AbilityProfileCreateManyInput[]
  revisions: Prisma.AbilityProfileRevisionCreateManyInput[]
  goals: Prisma.TrainingGoalCreateManyInput[]
  scripts: Prisma.TrainingScriptCreateManyInput[]
  scriptVersions: Prisma.ScriptVersionCreateManyInput[]
  tasks: Prisma.SceneTaskCreateManyInput[]
  uploadFiles: Prisma.UploadFileCreateManyInput[]
  taskFiles: Prisma.SceneTaskFileCreateManyInput[]
  assets: Prisma.SceneAssetCreateManyInput[]
  activities: Prisma.ActivityCreateManyInput[]
}

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL('./demo-data.json', import.meta.url)), 'utf8'),
) as DemoData

const results: { table: string; created: number; skipped: number }[] = []

async function insert(
  table: string,
  total: number,
  run: () => Promise<{ count: number }>,
) {
  const { count } = await run()
  results.push({ table, created: count, skipped: total - count })
}

async function copyFixtures() {
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads')
  let copied = 0
  let missing = 0

  for (const file of data.uploadFiles) {
    const target = path.resolve(uploadDir, file.storageKey)
    if (!target.startsWith(uploadDir + path.sep)) {
      throw new Error(`非法的存储路径：${file.storageKey}`)
    }
    try {
      await stat(target)
      continue
    } catch {
      // 目标不存在时从 fixture 复制
    }
    try {
      const source = fileURLToPath(
        new URL(`./demo-files/${file.storageKey}`, import.meta.url),
      )
      await mkdir(path.dirname(target), { recursive: true })
      await copyFile(source, target)
      copied += 1
    } catch {
      missing += 1
      console.warn(`[seed] 缺少示例图片，已跳过：${file.storageKey}`)
    }
  }

  console.log(`[seed] 示例图片：复制 ${copied} 个，缺失 ${missing} 个`)
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { username: true },
  })
  if (admin) {
    console.log(`[seed] 检测到管理员账号：${admin.username}`)
  } else {
    console.warn('[seed] 未找到管理员账号，演示数据的创建人留空；建议先执行 npm run create-admin')
  }

  await copyFixtures()

  await prisma.$transaction(
    async (tx) => {
      await insert('learners', data.learners.length, () =>
        tx.learner.createMany({ data: data.learners, skipDuplicates: true }),
      )
      await insert('assessments', data.assessments.length, () =>
        tx.abilityAssessment.createMany({ data: data.assessments, skipDuplicates: true }),
      )
      await insert('profiles', data.profiles.length, () =>
        tx.abilityProfile.createMany({ data: data.profiles, skipDuplicates: true }),
      )
      await insert('revisions', data.revisions.length, () =>
        tx.abilityProfileRevision.createMany({ data: data.revisions, skipDuplicates: true }),
      )
      await insert('goals', data.goals.length, () =>
        tx.trainingGoal.createMany({ data: data.goals, skipDuplicates: true }),
      )
      await insert('scripts', data.scripts.length, () =>
        tx.trainingScript.createMany({ data: data.scripts, skipDuplicates: true }),
      )
      await insert('scriptVersions', data.scriptVersions.length, () =>
        tx.scriptVersion.createMany({ data: data.scriptVersions, skipDuplicates: true }),
      )
      await insert('tasks', data.tasks.length, () =>
        tx.sceneTask.createMany({ data: data.tasks, skipDuplicates: true }),
      )
      await insert('uploadFiles', data.uploadFiles.length, () =>
        tx.uploadFile.createMany({ data: data.uploadFiles, skipDuplicates: true }),
      )
      await insert('taskFiles', data.taskFiles.length, () =>
        tx.sceneTaskFile.createMany({ data: data.taskFiles, skipDuplicates: true }),
      )
      await insert('assets', data.assets.length, () =>
        tx.sceneAsset.createMany({ data: data.assets, skipDuplicates: true }),
      )
      await insert('activities', data.activities.length, () =>
        tx.activity.createMany({ data: data.activities, skipDuplicates: true }),
      )
    },
    { timeout: 60000 },
  )

  console.log('[seed] 完成（已存在的记录会跳过，不覆盖手工修改）：')
  for (const result of results) {
    console.log(
      `  ${result.table.padEnd(14)} 新增 ${String(result.created).padStart(2)} / 跳过 ${String(result.skipped).padStart(2)}`,
    )
  }
}

main()
  .catch((error) => {
    console.error('[seed] 失败：', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
