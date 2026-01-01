import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, maskApiKey } from '../../server/utils/encryption'

/**
 * Tests for encryption utilities.
 * Critical for API key security.
 */

describe('encrypt/decrypt', () => {
  it('should encrypt and decrypt a simple string', () => {
    const original = 'Hello, World!'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)

    expect(decrypted).toBe(original)
  })

  it('should encrypt and decrypt an API key', () => {
    const apiKey = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz'
    const encrypted = encrypt(apiKey)
    const decrypted = decrypt(encrypted)

    expect(decrypted).toBe(apiKey)
  })

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const original = 'same-text'
    const encrypted1 = encrypt(original)
    const encrypted2 = encrypt(original)

    // Ciphertexts should be different due to random IV
    expect(encrypted1).not.toBe(encrypted2)

    // But both should decrypt to the same value
    expect(decrypt(encrypted1)).toBe(original)
    expect(decrypt(encrypted2)).toBe(original)
  })

  it('should handle empty string', () => {
    const original = ''
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)

    expect(decrypted).toBe(original)
  })

  it('should handle unicode characters', () => {
    const original = 'Hëllö Wörld! 日本語 🎲'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)

    expect(decrypted).toBe(original)
  })

  it('should handle long strings', () => {
    const original = 'A'.repeat(10000)
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)

    expect(decrypted).toBe(original)
  })

  it('should produce encrypted format with 3 parts (iv:authTag:data)', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')

    expect(parts).toHaveLength(3)
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32)
    // AuthTag is 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32)
    // Data length varies
    expect(parts[2]!.length).toBeGreaterThan(0)
  })
})

describe('decrypt - Error Handling', () => {
  it('should throw error for invalid format (missing parts)', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted data format')
    expect(() => decrypt('part1:part2')).toThrow('Invalid encrypted data format')
  })

  it('should throw error for tampered ciphertext', () => {
    const encrypted = encrypt('secret')
    const parts = encrypted.split(':')
    // Tamper with the encrypted data
    const tampered = `${parts[0]}:${parts[1]}:ffffffff${parts[2]!.slice(8)}`

    expect(() => decrypt(tampered)).toThrow()
  })

  it('should throw error for tampered authTag', () => {
    const encrypted = encrypt('secret')
    const parts = encrypted.split(':')
    // Tamper with the auth tag
    const tampered = `${parts[0]}:${'ff'.repeat(16)}:${parts[2]}`

    expect(() => decrypt(tampered)).toThrow()
  })
})

describe('maskApiKey', () => {
  it('should mask a standard OpenAI API key', () => {
    const apiKey = 'sk-proj-abc123def456ghi789jkl012mno345pqr678'
    const masked = maskApiKey(apiKey)

    expect(masked).toBe('sk-proj...r678')
    expect(masked).toContain('sk-proj')
    expect(masked).toContain('...')
    expect(masked).not.toContain('abc123')
  })

  it('should show first 7 and last 4 characters', () => {
    const apiKey = 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'
    const masked = maskApiKey(apiKey)

    expect(masked.startsWith('sk-proj')).toBe(true)
    expect(masked.endsWith('1234')).toBe(true)
  })

  it('should return *** for short keys', () => {
    expect(maskApiKey('')).toBe('***')
    expect(maskApiKey('short')).toBe('***')
    expect(maskApiKey('less-12char')).toBe('***')
  })

  it('should handle null/undefined', () => {
    expect(maskApiKey(null as unknown as string)).toBe('***')
    expect(maskApiKey(undefined as unknown as string)).toBe('***')
  })

  it('should work with minimum length keys', () => {
    // 12 chars is the minimum
    const apiKey = '123456789012'
    const masked = maskApiKey(apiKey)

    expect(masked).toBe('1234567...9012')
  })
})
