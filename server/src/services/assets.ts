import { Prisma, type PrismaClient } from '@prisma/client'
import type { AssetUpdateInput } from '../schemas/index.js'
import { notFound } from '../utils/errors.js'
import { addActivity } from './activities.js'

export interface AssetListParams {
  q?: string
  learnerId?: string
  scriptId?: string
  taskId?: string
  includeArchived?: boolean
  page: number
  pageSize: number
}

export async function listAssets(prisma: PrismaClient, params: AssetListParams) {
  const where: Prisma.SceneAssetWhereInput = {}
  if (!params.includeArchived) where.archivedAt = null
  if (params.learnerId) where.learnerId = params.learnerId
  if (params.scriptId) where.scriptId = params.scriptId
  if (params.taskId) where.taskId = params.taskId
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { sceneType: { contains: params.q, mode: 'insensitive' } },
      { description: { contains: params.q, mode: 'insensitive' } },
    ]
  }
  const [total, items] = await prisma.$transaction([
    prisma.sceneAsset.count({ where }),
    prisma.sceneAsset.findMany({
      where,
      include: { previewFile: true },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ])
  return { items, total }
}

export async function getAsset(prisma: PrismaClient, id: string) {
  const asset = await prisma.sceneAsset.findUnique({
    where: { id },
    include: { previewFile: true },
  })
  if (!asset) throw notFound('未找到对应的场景资产')
  return asset
}

export async function getAssetByTask(prisma: PrismaClient, taskId: string) {
  const asset = await prisma.sceneAsset.findUnique({
    where: { taskId },
    include: { previewFile: true },
  })
  if (!asset) throw notFound('该任务尚未生成场景资产')
  return asset
}

export async function updateAsset(
  prisma: PrismaClient,
  id: string,
  input: AssetUpdateInput,
  actorId: string,
) {
  await getAsset(prisma, id)
  return prisma.$transaction(async (tx) => {
    const asset = await tx.sceneAsset.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      include: { previewFile: true },
    })
    await addActivity(tx, {
      type: 'ASSET',
      title: '场景资产已更新',
      detail: asset.name,
      link: `/assets/${asset.id}`,
      actorId,
    })
    return asset
  })
}

export async function archiveAsset(
  prisma: PrismaClient,
  id: string,
  actorId: string,
) {
  const existing = await getAsset(prisma, id)
  if (existing.archivedAt) return existing
  return prisma.$transaction(async (tx) => {
    const asset = await tx.sceneAsset.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: { previewFile: true },
    })
    await addActivity(tx, {
      type: 'ASSET',
      title: '场景资产已归档',
      detail: asset.name,
      link: `/assets/${asset.id}`,
      actorId,
    })
    return asset
  })
}
