import { describe, it, expect } from 'vitest'
import {
  STANDARD_RACE_KEYS,
  STANDARD_CLASS_KEYS,
  createI18nLookup,
} from '../../server/utils/i18n-lookup'

/**
 * Tests for i18n lookup and standard race/class definitions.
 * These ensure the single source of truth is correctly maintained.
 */

describe('Standard Race Keys', () => {
  it('should contain core D&D 5e races', () => {
    const coreRaces = ['human', 'elf', 'dwarf', 'halfling', 'gnome', 'halfelf', 'halforc', 'tiefling', 'dragonborn']
    for (const race of coreRaces) {
      expect(STANDARD_RACE_KEYS.has(race), `Missing core race: ${race}`).toBe(true)
    }
  })

  it('should contain D&D 5e subraces', () => {
    const subraces = ['drow', 'woodelf', 'highelf', 'mountaindwarf', 'hilldwarf', 'lightfoothalfling', 'stouthalfling']
    for (const race of subraces) {
      expect(STANDARD_RACE_KEYS.has(race), `Missing subrace: ${race}`).toBe(true)
    }
  })

  it('should contain D&D 2024/supplement races', () => {
    const supplementRaces = ['aasimar', 'goliath', 'orc', 'tabaxi', 'kenku', 'firbolg', 'warforged']
    for (const race of supplementRaces) {
      expect(STANDARD_RACE_KEYS.has(race), `Missing supplement race: ${race}`).toBe(true)
    }
  })

  it('should contain monster races', () => {
    const monsterRaces = ['goblin', 'kobold', 'hobgoblin', 'bugbear', 'lizardfolk']
    for (const race of monsterRaces) {
      expect(STANDARD_RACE_KEYS.has(race), `Missing monster race: ${race}`).toBe(true)
    }
  })

  it('should have at least 40 standard races', () => {
    expect(STANDARD_RACE_KEYS.size).toBeGreaterThanOrEqual(40)
  })

  it('should only contain lowercase keys without spaces', () => {
    for (const key of STANDARD_RACE_KEYS) {
      expect(key).toBe(key.toLowerCase())
      expect(key).not.toContain(' ')
    }
  })
})

describe('Standard Class Keys', () => {
  it('should contain core D&D 5e classes', () => {
    const coreClasses = [
      'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
      'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
    ]
    for (const cls of coreClasses) {
      expect(STANDARD_CLASS_KEYS.has(cls), `Missing core class: ${cls}`).toBe(true)
    }
  })

  it('should contain D&D supplement classes', () => {
    const supplementClasses = ['artificer', 'bloodhunter']
    for (const cls of supplementClasses) {
      expect(STANDARD_CLASS_KEYS.has(cls), `Missing supplement class: ${cls}`).toBe(true)
    }
  })

  it('should contain NPC/profession classes', () => {
    const npcClasses = ['knight', 'assassin', 'priest', 'merchant', 'noble', 'guard', 'soldier']
    for (const cls of npcClasses) {
      expect(STANDARD_CLASS_KEYS.has(cls), `Missing NPC class: ${cls}`).toBe(true)
    }
  })

  it('should have at least 25 standard classes', () => {
    expect(STANDARD_CLASS_KEYS.size).toBeGreaterThanOrEqual(25)
  })

  it('should only contain lowercase keys without spaces', () => {
    for (const key of STANDARD_CLASS_KEYS) {
      expect(key).toBe(key.toLowerCase())
      expect(key).not.toContain(' ')
    }
  })
})

describe('createI18nLookup - German', () => {
  const lookup = createI18nLookup('de')

  it('should return German race names mapping to keys', () => {
    expect(lookup.races['mensch']).toBe('human')
    expect(lookup.races['elf']).toBe('elf')
    expect(lookup.races['zwerg']).toBe('dwarf')
    expect(lookup.races['halbling']).toBe('halfling')
    expect(lookup.races['drachenblütiger']).toBe('dragonborn')
  })

  it('should return German class names mapping to keys', () => {
    expect(lookup.classes['barbar']).toBe('barbarian')
    expect(lookup.classes['magier']).toBe('wizard')
    expect(lookup.classes['schurke']).toBe('rogue')
    expect(lookup.classes['kämpfer']).toBe('fighter')
    expect(lookup.classes['kleriker']).toBe('cleric')
  })

  it('should handle race aliases', () => {
    // Drow has multiple aliases in German
    expect(lookup.races['drow']).toBe('drow')
    expect(lookup.races['dunkelelf']).toBe('drow')
    expect(lookup.races['zwergelf (drow)']).toBe('drow')
  })
})

describe('createI18nLookup - English', () => {
  const lookup = createI18nLookup('en')

  it('should return English race names mapping to keys', () => {
    expect(lookup.races['human']).toBe('human')
    expect(lookup.races['elf']).toBe('elf')
    expect(lookup.races['dwarf']).toBe('dwarf')
    expect(lookup.races['halfling']).toBe('halfling')
    expect(lookup.races['dragonborn']).toBe('dragonborn')
  })

  it('should return English class names mapping to keys', () => {
    expect(lookup.classes['barbarian']).toBe('barbarian')
    expect(lookup.classes['wizard']).toBe('wizard')
    expect(lookup.classes['rogue']).toBe('rogue')
    expect(lookup.classes['fighter']).toBe('fighter')
    expect(lookup.classes['cleric']).toBe('cleric')
  })

  it('should handle race aliases with spaces', () => {
    // Half-Elf has multiple aliases
    expect(lookup.races['half-elf']).toBe('halfelf')
    expect(lookup.races['half elf']).toBe('halfelf')
    expect(lookup.races['halfelf']).toBe('halfelf')
  })

  it('should handle class aliases', () => {
    expect(lookup.classes['blood hunter']).toBe('bloodhunter')
    expect(lookup.classes['bloodhunter']).toBe('bloodhunter')
  })
})

describe('Lookup Consistency', () => {
  const lookupDE = createI18nLookup('de')
  const lookupEN = createI18nLookup('en')

  it('should have matching key sets in DE and EN lookups', () => {
    const deRaceKeys = new Set(Object.values(lookupDE.races))
    const enRaceKeys = new Set(Object.values(lookupEN.races))

    // All keys in DE should also exist in EN
    for (const key of deRaceKeys) {
      expect(enRaceKeys.has(key), `DE race key "${key}" not in EN lookup`).toBe(true)
    }

    // All keys in EN should also exist in DE
    for (const key of enRaceKeys) {
      expect(deRaceKeys.has(key), `EN race key "${key}" not in DE lookup`).toBe(true)
    }
  })

  it('should have all lookup keys in STANDARD_RACE_KEYS', () => {
    const allLookupKeys = new Set([
      ...Object.values(lookupDE.races),
      ...Object.values(lookupEN.races),
    ])

    for (const key of allLookupKeys) {
      expect(STANDARD_RACE_KEYS.has(key), `Lookup race key "${key}" not in STANDARD_RACE_KEYS`).toBe(true)
    }
  })

  it('should have all lookup class keys in STANDARD_CLASS_KEYS', () => {
    const allLookupKeys = new Set([
      ...Object.values(lookupDE.classes),
      ...Object.values(lookupEN.classes),
    ])

    for (const key of allLookupKeys) {
      expect(STANDARD_CLASS_KEYS.has(key), `Lookup class key "${key}" not in STANDARD_CLASS_KEYS`).toBe(true)
    }
  })
})

describe('Custom Race/Class Detection', () => {
  it('should correctly identify standard races', () => {
    expect(STANDARD_RACE_KEYS.has('human')).toBe(true)
    expect(STANDARD_RACE_KEYS.has('elf')).toBe(true)
    expect(STANDARD_RACE_KEYS.has('goblin')).toBe(true)
  })

  it('should correctly identify custom races as NOT standard', () => {
    expect(STANDARD_RACE_KEYS.has('halfdragon')).toBe(false)
    expect(STANDARD_RACE_KEYS.has('myspecialrace')).toBe(false)
    expect(STANDARD_RACE_KEYS.has('customelf')).toBe(false)
  })

  it('should correctly identify standard classes', () => {
    expect(STANDARD_CLASS_KEYS.has('wizard')).toBe(true)
    expect(STANDARD_CLASS_KEYS.has('fighter')).toBe(true)
    expect(STANDARD_CLASS_KEYS.has('artificer')).toBe(true)
  })

  it('should correctly identify custom classes as NOT standard', () => {
    expect(STANDARD_CLASS_KEYS.has('shadowdancer')).toBe(false)
    expect(STANDARD_CLASS_KEYS.has('myclass')).toBe(false)
    expect(STANDARD_CLASS_KEYS.has('battlemage')).toBe(false)
  })
})
