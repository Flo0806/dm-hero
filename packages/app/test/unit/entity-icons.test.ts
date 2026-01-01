import { describe, it, expect } from 'vitest'
import { getItemTypeIcon, getLocationTypeIcon } from '../../server/utils/entity-icons'

/**
 * Tests for entity icon mapping utilities.
 * Used for consistent icons across the app.
 */

describe('getItemTypeIcon', () => {
  it('should return correct icons for common item types', () => {
    expect(getItemTypeIcon('weapon')).toBe('mdi-sword')
    expect(getItemTypeIcon('armor')).toBe('mdi-shield')
    expect(getItemTypeIcon('potion')).toBe('mdi-bottle-tonic')
    expect(getItemTypeIcon('scroll')).toBe('mdi-script-text')
  })

  it('should be case-insensitive', () => {
    expect(getItemTypeIcon('Weapon')).toBe('mdi-sword')
    expect(getItemTypeIcon('ARMOR')).toBe('mdi-shield')
    expect(getItemTypeIcon('PoTiOn')).toBe('mdi-bottle-tonic')
  })

  it('should return fallback for unknown types', () => {
    expect(getItemTypeIcon('unknown-type')).toBe('mdi-sword')
    expect(getItemTypeIcon('laser-gun')).toBe('mdi-sword')
  })

  it('should return custom fallback when provided', () => {
    expect(getItemTypeIcon('unknown', 'mdi-help')).toBe('mdi-help')
    expect(getItemTypeIcon('', 'mdi-package')).toBe('mdi-package')
  })

  it('should return fallback for null/undefined', () => {
    expect(getItemTypeIcon(null)).toBe('mdi-sword')
    expect(getItemTypeIcon(undefined)).toBe('mdi-sword')
    expect(getItemTypeIcon(null, 'mdi-help')).toBe('mdi-help')
  })

  it('should have icons for all common D&D item types', () => {
    // Weapons and armor
    expect(getItemTypeIcon('weapon')).toBeDefined()
    expect(getItemTypeIcon('armor')).toBeDefined()
    expect(getItemTypeIcon('ammunition')).toBeDefined()

    // Magical items
    expect(getItemTypeIcon('potion')).toBeDefined()
    expect(getItemTypeIcon('scroll')).toBeDefined()
    expect(getItemTypeIcon('artifact')).toBeDefined()
    expect(getItemTypeIcon('magical')).toBeDefined()

    // Quest/adventure items
    expect(getItemTypeIcon('quest_item')).toBeDefined()
    expect(getItemTypeIcon('key')).toBeDefined()
    expect(getItemTypeIcon('map')).toBeDefined()

    // Consumables
    expect(getItemTypeIcon('consumable')).toBeDefined()
    expect(getItemTypeIcon('food')).toBeDefined()
    expect(getItemTypeIcon('drink')).toBeDefined()
    expect(getItemTypeIcon('poison')).toBeDefined()

    // Tools and containers
    expect(getItemTypeIcon('tool')).toBeDefined()
    expect(getItemTypeIcon('container')).toBeDefined()
    expect(getItemTypeIcon('bag')).toBeDefined()

    // Valuables
    expect(getItemTypeIcon('treasure')).toBeDefined()
    expect(getItemTypeIcon('gem')).toBeDefined()
    expect(getItemTypeIcon('jewelry')).toBeDefined()
    expect(getItemTypeIcon('currency')).toBeDefined()
  })
})

describe('getLocationTypeIcon', () => {
  it('should return correct icons for common location types', () => {
    expect(getLocationTypeIcon('city')).toBe('mdi-city')
    expect(getLocationTypeIcon('castle')).toBe('mdi-castle')
    expect(getLocationTypeIcon('dungeon')).toBe('mdi-gate')
    expect(getLocationTypeIcon('forest')).toBe('mdi-pine-tree')
    expect(getLocationTypeIcon('tavern')).toBe('mdi-glass-mug-variant')
  })

  it('should be case-insensitive', () => {
    expect(getLocationTypeIcon('City')).toBe('mdi-city')
    expect(getLocationTypeIcon('CASTLE')).toBe('mdi-castle')
    expect(getLocationTypeIcon('DuNgEoN')).toBe('mdi-gate')
  })

  it('should return fallback for unknown types', () => {
    expect(getLocationTypeIcon('unknown-place')).toBe('mdi-map-marker')
    expect(getLocationTypeIcon('spaceship')).toBe('mdi-map-marker')
  })

  it('should return custom fallback when provided', () => {
    expect(getLocationTypeIcon('unknown', 'mdi-help')).toBe('mdi-help')
    expect(getLocationTypeIcon('', 'mdi-earth')).toBe('mdi-earth')
  })

  it('should return fallback for null/undefined', () => {
    expect(getLocationTypeIcon(null)).toBe('mdi-map-marker')
    expect(getLocationTypeIcon(undefined)).toBe('mdi-map-marker')
    expect(getLocationTypeIcon(null, 'mdi-help')).toBe('mdi-help')
  })

  it('should have icons for settlements', () => {
    expect(getLocationTypeIcon('city')).toBeDefined()
    expect(getLocationTypeIcon('town')).toBeDefined()
    expect(getLocationTypeIcon('village')).toBeDefined()
  })

  it('should have icons for fortifications', () => {
    expect(getLocationTypeIcon('castle')).toBeDefined()
    expect(getLocationTypeIcon('fortress')).toBeDefined()
    expect(getLocationTypeIcon('tower')).toBeDefined()
  })

  it('should have icons for dungeons and underground', () => {
    expect(getLocationTypeIcon('dungeon')).toBeDefined()
    expect(getLocationTypeIcon('cave')).toBeDefined()
    expect(getLocationTypeIcon('mine')).toBeDefined()
    expect(getLocationTypeIcon('crypt')).toBeDefined()
  })

  it('should have icons for natural locations', () => {
    expect(getLocationTypeIcon('forest')).toBeDefined()
    expect(getLocationTypeIcon('mountain')).toBeDefined()
    expect(getLocationTypeIcon('river')).toBeDefined()
    expect(getLocationTypeIcon('lake')).toBeDefined()
    expect(getLocationTypeIcon('swamp')).toBeDefined()
    expect(getLocationTypeIcon('desert')).toBeDefined()
    expect(getLocationTypeIcon('island')).toBeDefined()
  })

  it('should have icons for religious/cultural locations', () => {
    expect(getLocationTypeIcon('temple')).toBeDefined()
    expect(getLocationTypeIcon('shrine')).toBeDefined()
    expect(getLocationTypeIcon('monastery')).toBeDefined()
    expect(getLocationTypeIcon('ruins')).toBeDefined()
    expect(getLocationTypeIcon('graveyard')).toBeDefined()
  })

  it('should have icons for civilization locations', () => {
    expect(getLocationTypeIcon('tavern')).toBeDefined()
    expect(getLocationTypeIcon('shop')).toBeDefined()
    expect(getLocationTypeIcon('guild')).toBeDefined()
    expect(getLocationTypeIcon('bridge')).toBeDefined()
    expect(getLocationTypeIcon('road')).toBeDefined()
  })
})
