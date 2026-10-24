import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error)
      else resolve(derived)
    })
  })
}

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts
  const n = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false
  const salt = Buffer.from(saltRaw, 'base64')
  const expected = Buffer.from(hashRaw, 'base64')
  if (salt.length === 0 || expected.length === 0) return false
  const derived = await scrypt(password, salt, expected.length, { N: n, r, p })
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
