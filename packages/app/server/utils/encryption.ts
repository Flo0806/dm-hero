import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * Encryption key derivation
 * Uses machine-specific data to generate a consistent encryption key
 * This is NOT maximum security, but good enough for local-only storage
 */
function getEncryptionKey(): Buffer {
  // Use a combination of environment-specific data
  // In production, you'd use a proper key management system
  const secret = process.env.ENCRYPTION_SECRET || 'dm-hero-local-encryption-key-2025'
  const salt = 'dm-hero-salt-v1' // Static salt for consistency

  // Derive a 32-byte key using scrypt
  return scryptSync(secret, salt, 32)
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: iv:authTag:encryptedData (all hex-encoded)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(16) // Initialization vector

  const cipher = createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt a string encrypted with encrypt()
 * Expects format: iv:authTag:encryptedData (all hex-encoded)
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()

  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivHex, authTagHex, encrypted] = parts as [string, string, string]

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Mask an API key for display (show first 7 and last 4 chars)
 * Example: sk-proj-abc...xyz123
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '***'
  }

  const prefix = apiKey.substring(0, 7)
  const suffix = apiKey.substring(apiKey.length - 4)

  return `${prefix}...${suffix}`
}
