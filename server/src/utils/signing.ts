import { createHmac, timingSafeEqual } from 'node:crypto'

function signatureFor(secret: string, fileId: string, expiresAt: number): string {
  return createHmac('sha256', secret)
    .update(`${fileId}:${expiresAt}`)
    .digest('base64url')
}

export function signUploadContent(
  secret: string,
  fileId: string,
  expiresAt: number,
): string {
  return signatureFor(secret, fileId, expiresAt)
}

export function verifyUploadSignature(
  secret: string,
  fileId: string,
  expiresAt: number,
  signature: string,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false
  const expected = Buffer.from(signatureFor(secret, fileId, expiresAt))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}
