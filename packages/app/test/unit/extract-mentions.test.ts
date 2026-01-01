import { describe, it, expect } from 'vitest'
import { extractMentionsFromMarkdown } from '../../server/utils/extract-mentions'

/**
 * Tests for entity mention extraction from markdown notes.
 * Critical for session notes entity linking.
 */

describe('extractMentionsFromMarkdown - New Format {{type:id}}', () => {
  it('should extract single mention', () => {
    const notes = 'The party met {{npc:123}} at the tavern.'
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toEqual({ entityId: 123, type: 'npc' })
  })

  it('should extract multiple mentions of different types', () => {
    const notes = `
      The party met {{npc:1}} at {{location:2}}.
      They found {{item:3}} and learned about {{lore:4}}.
    `
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(4)
    expect(mentions).toContainEqual({ entityId: 1, type: 'npc' })
    expect(mentions).toContainEqual({ entityId: 2, type: 'location' })
    expect(mentions).toContainEqual({ entityId: 3, type: 'item' })
    expect(mentions).toContainEqual({ entityId: 4, type: 'lore' })
  })

  it('should deduplicate same entity mentioned multiple times', () => {
    const notes = '{{npc:42}} said hello. Later {{npc:42}} said goodbye.'
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toEqual({ entityId: 42, type: 'npc' })
  })

  it('should handle all entity types', () => {
    const notes = `
      {{npc:1}} {{location:2}} {{item:3}} {{faction:4}} {{lore:5}} {{player:6}}
    `
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(6)
    expect(mentions.map((m) => m.type)).toContain('npc')
    expect(mentions.map((m) => m.type)).toContain('location')
    expect(mentions.map((m) => m.type)).toContain('item')
    expect(mentions.map((m) => m.type)).toContain('faction')
    expect(mentions.map((m) => m.type)).toContain('lore')
    expect(mentions.map((m) => m.type)).toContain('player')
  })
})

describe('extractMentionsFromMarkdown - Legacy Format [Name](type:id)', () => {
  it('should extract legacy format mentions', () => {
    const notes = 'The party met [Gandalf](npc:123) at the tavern.'
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toEqual({ entityId: 123, type: 'npc' })
  })

  it('should extract multiple legacy mentions', () => {
    const notes = '[Hero](npc:1) went to [Castle](location:2) and found [Sword](item:3).'
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(3)
  })

  it('should handle names with spaces', () => {
    const notes = '[Old Man Willow](npc:99) guards the forest.'
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toEqual({ entityId: 99, type: 'npc' })
  })
})

describe('extractMentionsFromMarkdown - Mixed Formats', () => {
  it('should extract both new and legacy formats', () => {
    const notes = `
      Met {{npc:1}} and [Old Friend](npc:2) at {{location:3}}.
      Found [Magic Sword](item:4) nearby.
    `
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(4)
    expect(mentions).toContainEqual({ entityId: 1, type: 'npc' })
    expect(mentions).toContainEqual({ entityId: 2, type: 'npc' })
    expect(mentions).toContainEqual({ entityId: 3, type: 'location' })
    expect(mentions).toContainEqual({ entityId: 4, type: 'item' })
  })

  it('should deduplicate across formats', () => {
    const notes = '{{npc:42}} is the same as [Hero](npc:42).'
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(1)
    expect(mentions[0]).toEqual({ entityId: 42, type: 'npc' })
  })
})

describe('extractMentionsFromMarkdown - Edge Cases', () => {
  it('should return empty array for null/undefined', () => {
    expect(extractMentionsFromMarkdown(null)).toEqual([])
    expect(extractMentionsFromMarkdown(undefined)).toEqual([])
  })

  it('should return empty array for empty string', () => {
    expect(extractMentionsFromMarkdown('')).toEqual([])
  })

  it('should return empty array for text without mentions', () => {
    const notes = 'The party rested at the inn. Nothing special happened.'
    expect(extractMentionsFromMarkdown(notes)).toEqual([])
  })

  it('should not match malformed mentions', () => {
    const notes = `
      {npc:1} - missing brace
      {{npc:}} - missing id
      {{:123}} - missing type
      [](npc:1) - empty name
    `
    // Only empty name might be valid, let's check
    const mentions = extractMentionsFromMarkdown(notes)
    // All should be invalid except maybe empty name
    expect(mentions.filter((m) => m.type === 'npc' && m.entityId === 1)).toHaveLength(0)
  })

  it('should handle large entity IDs', () => {
    const notes = '{{npc:999999999}}'
    const mentions = extractMentionsFromMarkdown(notes)

    expect(mentions).toHaveLength(1)
    expect(mentions[0]!.entityId).toBe(999999999)
  })

  it('should handle mentions in markdown context', () => {
    const notes = `
      # Session Notes

      ## Encounters
      - Met {{npc:1}} in the forest
      - Fought at {{location:2}}

      > "Hello," said {{npc:3}}

      **Important:** Found {{item:4}}
    `
    const mentions = extractMentionsFromMarkdown(notes)
    expect(mentions).toHaveLength(4)
  })
})
