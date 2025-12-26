import { describe, it, expect } from 'vitest'
import { CURRENT_TOS_VERSION, hasAcceptedCurrentTos } from '../../server/utils/tos'

describe('Terms of Service', () => {
  describe('CURRENT_TOS_VERSION', () => {
    it('should be defined and follow semver format', () => {
      expect(CURRENT_TOS_VERSION).toBeDefined()
      expect(CURRENT_TOS_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('hasAcceptedCurrentTos', () => {
    it('should return false for null version', () => {
      expect(hasAcceptedCurrentTos(null)).toBe(false)
    })

    it('should return false for undefined version', () => {
      expect(hasAcceptedCurrentTos(undefined as unknown as string | null)).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(hasAcceptedCurrentTos('')).toBe(false)
    })

    it('should return true when version matches current', () => {
      expect(hasAcceptedCurrentTos(CURRENT_TOS_VERSION)).toBe(true)
    })

    it('should return false for older version', () => {
      expect(hasAcceptedCurrentTos('0.9.0')).toBe(false)
    })

    it('should return false for different version', () => {
      expect(hasAcceptedCurrentTos('2.0.0')).toBe(false)
    })

    it('should return false for invalid version format', () => {
      expect(hasAcceptedCurrentTos('invalid')).toBe(false)
    })

    it('should be case-sensitive (exact match required)', () => {
      // If version is '1.0.0', then '1.0.0 ' (with space) should not match
      expect(hasAcceptedCurrentTos(CURRENT_TOS_VERSION + ' ')).toBe(false)
      expect(hasAcceptedCurrentTos(' ' + CURRENT_TOS_VERSION)).toBe(false)
    })
  })
})
