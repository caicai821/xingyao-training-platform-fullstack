import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { PrismaClient } from '@prisma/client'
import type { MultipartFile } from '@fastify/multipart'
import type { AppConfig } from '../config/env.js'
import { AppError, notFound } from '../utils/errors.js'
import { signUploadContent } from '../utils/signing.js'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const MAGIC_MIME = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  {
    mime: 'image/png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
] as const

function detectMime(buffer: Buffer): string | null {
  for (const signature of MAGIC_MIME) {
    if (signature.bytes.every((byte, index) => buffer[index] === byte)) {
      return signature.mime
    }
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function resolveStoragePath(config: AppConfig, storageKey: string): string {
  const root = path.resolve(config.uploadDir)
  const absolute = path.resolve(root, storageKey)
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw notFound('未找到对应的文件')
  }
  return absolute
}

function safeOriginalName(filename: string | undefined): string {
  const base = path.basename(filename ?? '').replace(/[\u0000-\u001f]/g, '').trim()
  return (base || 'upload').slice(0, 260)
}

export async function saveUpload(
  prisma: PrismaClient,
  config: AppConfig,
  actorId: string,
  part: MultipartFile,
) {
  const declaredMime = part.mimetype === 'image/jpg' ? 'image/jpeg' : part.mimetype
  if (!ALLOWED_MIME[part.mimetype]) {
    part.file.resume()
    throw new AppError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      '仅支持 JPG、PNG 或 WebP 格式的图片',
    )
  }

  const now = new Date()
  const storageKey = path.posix.join(
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    `${randomUUID()}${ALLOWED_MIME[part.mimetype]}`,
  )
  const absolutePath = resolveStoragePath(config, storageKey)
  await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o750 })

  try {
    await pipeline(part.file, createWriteStream(absolutePath, { flags: 'wx' }))
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined)
    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      throw new AppError(413, 'UPLOAD_TOO_LARGE', '图片大小超过上传限制')
    }
    throw error
  }

  if (part.file.truncated) {
    await unlink(absolutePath).catch(() => undefined)
    throw new AppError(413, 'UPLOAD_TOO_LARGE', '图片大小超过上传限制')
  }

  const fileStat = await stat(absolutePath)
  if (fileStat.size === 0) {
    await unlink(absolutePath).catch(() => undefined)
    throw new AppError(400, 'VALIDATION_ERROR', '上传的文件为空')
  }
  if (fileStat.size > config.maxUploadBytes) {
    await unlink(absolutePath).catch(() => undefined)
    throw new AppError(413, 'UPLOAD_TOO_LARGE', '图片大小超过上传限制')
  }

  const content = await readFile(absolutePath)
  const actualMime = detectMime(content)
  if (!actualMime || actualMime !== declaredMime) {
    await unlink(absolutePath).catch(() => undefined)
    throw new AppError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      '文件内容与声明的图片格式不一致，已拒绝上传',
    )
  }

  const checksum = createHash('sha256').update(content).digest('hex')
  try {
    return await prisma.uploadFile.create({
      data: {
        originalName: safeOriginalName(part.filename),
        storageName: path.posix.basename(storageKey),
        mimeType: declaredMime,
        size: fileStat.size,
        storageKey,
        checksum,
        uploadedById: actorId,
      },
    })
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined)
    throw error
  }
}

export function createSignedContentUrl(config: AppConfig, fileId: string): string {
  const expiresAt = Date.now() + config.uploadSignedUrlTtlMs
  const signature = signUploadContent(config.uploadSigningSecret, fileId, expiresAt)
  return `${config.publicBaseUrl}/api/v1/uploads/${fileId}/content?expires=${expiresAt}&signature=${signature}`
}

export async function getUpload(prisma: PrismaClient, id: string) {
  const file = await prisma.uploadFile.findUnique({ where: { id } })
  if (!file) throw notFound('未找到对应的文件')
  return file
}

export async function getUploadContent(
  prisma: PrismaClient,
  config: AppConfig,
  id: string,
) {
  const file = await getUpload(prisma, id)
  const absolutePath = resolveStoragePath(config, file.storageKey)
  try {
    const fileStat = await stat(absolutePath)
    if (!fileStat.isFile()) throw new Error('not a file')
  } catch {
    throw notFound('文件内容已丢失')
  }
  return { file, absolutePath }
}

export function createUploadReadStream(absolutePath: string) {
  return createReadStream(absolutePath)
}
