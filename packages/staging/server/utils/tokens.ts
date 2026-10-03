import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function sameHash(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

// No look-alike characters (0/O, 1/I/L) - codes are read aloud at the table
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function randomGameCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/** Public keys are base64url (spki) - nothing else is accepted */
export const isPublicKey = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{40,400}$/.test(value)

/** Same formula DM Hero uses, so plain PINs never leave the DM's machine */
export const pinHash = (gameId: string, pin: string) => sha256(`${gameId}:${pin}`)
