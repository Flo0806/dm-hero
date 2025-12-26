import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Mock useRuntimeConfig for JWT tests
const mockConfig = {
  jwtSecret: 'test-secret-key-for-testing-only',
  jwtRefreshSecret: 'test-refresh-secret-key',
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => mockConfig,
}))

// Import after mocking
import { hashPassword, verifyPassword } from '../../server/utils/auth'

describe('Auth Utilities', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'SecureP@ssw0rd!'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50) // bcrypt hashes are ~60 chars
    })

    it('should produce different hashes for same password', async () => {
      const password = 'SamePassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      // Hashes should be different due to different salts
      expect(hash1).not.toBe(hash2)
    })

    it('should verify correct password', async () => {
      const password = 'CorrectPassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'CorrectPassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword('WrongPassword123', hash)
      expect(isValid).toBe(false)
    })

    it('should handle empty password', async () => {
      const hash = await hashPassword('')
      expect(hash).toBeDefined()

      const isValid = await verifyPassword('', hash)
      expect(isValid).toBe(true)
    })

    it('should handle unicode passwords', async () => {
      const password = 'Пароль日本語🔒'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should handle very long passwords', async () => {
      const password = 'a'.repeat(1000)
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })
  })

  describe('JWT Token Generation', () => {
    // Direct JWT tests without Nuxt context
    const testSecret = 'test-jwt-secret'

    it('should create a valid JWT', () => {
      const payload = { userId: 1, email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, testSecret, { expiresIn: '15m' })

      expect(token).toBeDefined()
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should verify a valid JWT', () => {
      const payload = { userId: 42, email: 'user@test.com', role: 'creator' }
      const token = jwt.sign(payload, testSecret, { expiresIn: '1h' })

      const decoded = jwt.verify(token, testSecret) as typeof payload
      expect(decoded.userId).toBe(42)
      expect(decoded.email).toBe('user@test.com')
      expect(decoded.role).toBe('creator')
    })

    it('should reject token with wrong secret', () => {
      const payload = { userId: 1, email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, testSecret)

      expect(() => {
        jwt.verify(token, 'wrong-secret')
      }).toThrow()
    })

    it('should reject expired token', () => {
      const payload = { userId: 1, email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, testSecret, { expiresIn: '-1s' }) // Already expired

      expect(() => {
        jwt.verify(token, testSecret)
      }).toThrow()
    })

    it('should reject tampered token', () => {
      const payload = { userId: 1, email: 'test@example.com', role: 'user' }
      const token = jwt.sign(payload, testSecret)

      // Tamper with the token
      const parts = token.split('.')
      parts[1] = 'tampered-payload'
      const tamperedToken = parts.join('.')

      expect(() => {
        jwt.verify(tamperedToken, testSecret)
      }).toThrow()
    })
  })
})
