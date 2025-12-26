import { describe, it, expect } from 'vitest'
import {
  checkContent,
  checkMultipleFields,
  getCategoryLabel,
  type ContentViolation,
} from '../../server/utils/contentModeration'

describe('Content Moderation', () => {
  describe('checkContent', () => {
    it('should return empty array for clean text', () => {
      const result = checkContent('This is a friendly adventure about heroes.', 'title')
      expect(result).toEqual([])
    })

    it('should return empty array for null/empty text', () => {
      expect(checkContent('', 'title')).toEqual([])
      expect(checkContent(null as unknown as string, 'title')).toEqual([])
    })

    it('should detect racism category violations', () => {
      const result = checkContent('A story with racist content neger', 'description')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('racism')
      expect(result[0].field).toBe('description')
    })

    it('should detect abuse category violations', () => {
      const result = checkContent('A story about vergewaltigung', 'description')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('abuse')
    })

    it('should detect child exploitation category violations', () => {
      const result = checkContent('Contains kindesmissbrauch content', 'title')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('child')
    })

    it('should detect extreme violence category violations', () => {
      const result = checkContent('Torture porn adventure', 'description')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('violence_extreme')
    })

    it('should be case insensitive', () => {
      const result = checkContent('NEGER content', 'title')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('racism')
    })

    it('should match German compound words', () => {
      // "vergewaltigung" should match in compound words
      const result = checkContent('Eine Vergewaltigungsgeschichte', 'description')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('abuse')
    })

    it('should not false-positive on similar but innocent words', () => {
      // "grape" should not match "rape"
      const result = checkContent('I love grapefruit and grapes', 'description')
      expect(result).toEqual([])
    })

    it('should report only first violation per category', () => {
      // Multiple abuse terms, should only report once
      const result = checkContent('rape and vergewaltigung', 'description')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('abuse')
    })
  })

  describe('checkMultipleFields', () => {
    it('should check all provided fields', () => {
      const result = checkMultipleFields({
        title: 'Clean title',
        description: 'Contains neger content',
      })
      expect(result).toHaveLength(1)
      expect(result[0].field).toBe('description')
    })

    it('should report violations from multiple fields', () => {
      const result = checkMultipleFields({
        title: 'neger title',
        description: 'vergewaltigung description',
      })
      expect(result).toHaveLength(2)
      expect(result.map(v => v.field)).toContain('title')
      expect(result.map(v => v.field)).toContain('description')
    })

    it('should skip null/undefined fields', () => {
      const result = checkMultipleFields({
        title: 'Clean title',
        description: null,
        notes: undefined,
      })
      expect(result).toEqual([])
    })

    it('should return empty for all clean fields', () => {
      const result = checkMultipleFields({
        title: 'A grand adventure',
        description: 'Heroes fight dragons',
        summary: 'Epic fantasy story',
      })
      expect(result).toEqual([])
    })
  })

  describe('getCategoryLabel', () => {
    it('should return English labels by default', () => {
      expect(getCategoryLabel('racism')).toBe('Racist content')
      expect(getCategoryLabel('abuse')).toBe('Abuse-related content')
      expect(getCategoryLabel('child')).toBe('Child exploitation')
      expect(getCategoryLabel('violence_extreme')).toBe('Extreme violence')
    })

    it('should return German labels when requested', () => {
      expect(getCategoryLabel('racism', 'de')).toBe('Rassistischer Inhalt')
      expect(getCategoryLabel('abuse', 'de')).toBe('Missbrauchsbezogener Inhalt')
      expect(getCategoryLabel('child', 'de')).toBe('Kindesmissbrauch')
      expect(getCategoryLabel('violence_extreme', 'de')).toBe('Extreme Gewalt')
    })

    it('should fallback to English for unknown locale', () => {
      expect(getCategoryLabel('racism', 'fr')).toBe('Racist content')
    })
  })
})
