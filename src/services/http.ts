import { getSettings } from './settingsStore'

export const UNAUTHORIZED_EVENT = 'qicheng:unauthorized'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

function resolveUrl(url: string, base: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const normalizedBase = base.replace(/\/$/, '')
  return `${normalizedBase}${url.startsWith('/') ? '' : '/'}${url}`
}

function parseErrorBody(body: unknown, status: number): ApiError {
  const payload = body as ApiErrorBody | undefined
  return new ApiError(
    payload?.error?.message || `请求失败（HTTP ${status}）`,
    status,
    payload?.error?.code || 'HTTP_ERROR',
    payload?.error?.details,
  )
}

async function readBody(response: Response): Promise<unknown> {
  const type = response.headers.get('content-type') ?? ''
  if (response.status === 204) return undefined
  if (type.includes('application/json')) {
    try {
      return await response.json()
    } catch {
      return undefined
    }
  }
  try {
    return await response.text()
  } catch {
    return undefined
  }
}

async function performFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查服务地址或稍后重试', 0, 'REQUEST_TIMEOUT')
    }
    throw new ApiError(
      '无法连接后端服务，请检查网络连接与服务地址',
      0,
      'NETWORK_ERROR',
    )
  } finally {
    clearTimeout(timer)
  }
}

function notifyUnauthorized(error: ApiError, path: string) {
  if (
    error.status === 401 &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/me')
  ) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: error }))
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const settings = getSettings()
  const url = resolveUrl(path, settings.apiBaseUrl)
  const isFormData = init.body instanceof FormData
  const response = await performFetch(
    url,
    {
      ...init,
      headers: {
        ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    },
    settings.requestTimeout,
  )
  const body = await readBody(response)
  if (!response.ok) {
    const error = parseErrorBody(body, response.status)
    notifyUnauthorized(error, path)
    throw error
  }
  const envelope = body as { data?: T } | undefined
  return (envelope && typeof envelope === 'object' && 'data' in envelope
    ? (envelope.data as T)
    : (body as T))
}

export async function apiUpload<T>(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<T> {
  const settings = getSettings()
  const url = resolveUrl(settings.uploadUrl, settings.apiBaseUrl)
  const form = new FormData()
  form.append('file', file)
  onProgress?.(12)
  const response = await performFetch(
    url,
    { method: 'POST', body: form },
    settings.requestTimeout,
  )
  onProgress?.(82)
  const body = await readBody(response)
  if (!response.ok) {
    const error = parseErrorBody(body, response.status)
    notifyUnauthorized(error, '/uploads')
    throw error
  }
  onProgress?.(100)
  const envelope = body as { data?: T } | undefined
  return (envelope && typeof envelope === 'object' && 'data' in envelope
    ? (envelope.data as T)
    : (body as T))
}

export function errorMessageOf(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}

export async function apiRequestOrNull<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    return await apiRequest<T>(path, init)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
