export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'LOGIN_LOCKED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INVALID_STATUS_TRANSITION'
  | 'SCRIPT_NOT_CONFIRMED'
  | 'UPLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_INVALID_RESPONSE'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export const authRequired = () =>
  new AppError(401, 'AUTH_REQUIRED', '请先登录后再访问该资源')

export const sessionExpired = () =>
  new AppError(401, 'SESSION_EXPIRED', '登录状态已失效，请重新登录')

export const forbidden = (message = '当前账号没有执行该操作的权限') =>
  new AppError(403, 'FORBIDDEN', message)

export const notFound = (message = '未找到对应的资源') =>
  new AppError(404, 'NOT_FOUND', message)

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details)

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details)

export const invalidTransition = (message: string) =>
  new AppError(409, 'INVALID_STATUS_TRANSITION', message)

export const providerNotConfigured = (service: string) =>
  new AppError(
    503,
    'PROVIDER_NOT_CONFIGURED',
    `${service}尚未配置真实服务地址或鉴权信息，请联系管理员完成配置后再试`,
  )

export const providerError = (service: string, detail?: string) =>
  new AppError(
    502,
    'PROVIDER_ERROR',
    `${service}暂时不可用${detail ? `：${detail}` : '，请稍后重试'}`,
  )

export const providerInvalidResponse = (service: string) =>
  new AppError(502, 'PROVIDER_INVALID_RESPONSE', `${service}返回了无法识别的数据结构`)
