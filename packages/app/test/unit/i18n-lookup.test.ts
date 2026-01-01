import { describe, it, expect } from 'vitest'
import {
  STANDARD_RACE_KEYS,
  STANDARD_CLASS_KEYS,
  createI18nLookup,
  createItemLookup,
  getItemTypeKey,
  getItemRarityKey,
  convertMetadataToKeys,
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

// ============================================================================
// Item Lookup Tests (critical for item search and save)
// ============================================================================

describe('createItemLookup - German', () => {
  const lookup = createItemLookup('de')

  it('should return German item type names mapping to keys', () => {
    expect(lookup.types['waffe']).toBe('weapon')
    expect(lookup.types['rüstung']).toBe('armor')
    expect(lookup.types['trank']).toBe('potion')
    expect(lookup.types['schriftrolle']).toBe('scroll')
    expect(lookup.types['ring']).toBe('ring')
    expect(lookup.types['amulett']).toBe('amulet')
    expect(lookup.types['stab']).toBe('staff')
    expect(lookup.types['zauberstab']).toBe('wand')
    expect(lookup.types['wundersamer gegenstand']).toBe('wondrous_item')
    expect(lookup.types['werkzeug']).toBe('tool')
    expect(lookup.types['ausrüstung']).toBe('equipment')
  })

  it('should return German rarity names mapping to keys', () => {
    expect(lookup.rarities['gewöhnlich']).toBe('common')
    expect(lookup.rarities['ungewöhnlich']).toBe('uncommon')
    expect(lookup.rarities['selten']).toBe('rare')
    expect(lookup.rarities['sehr selten']).toBe('very_rare')
    expect(lookup.rarities['sehr_selten']).toBe('very_rare')
    expect(lookup.rarities['legendär']).toBe('legendary')
    expect(lookup.rarities['artefakt']).toBe('artifact')
  })
})

describe('createItemLookup - English', () => {
  const lookup = createItemLookup('en')

  it('should return English item type names mapping to keys', () => {
    expect(lookup.types['weapon']).toBe('weapon')
    expect(lookup.types['armor']).toBe('armor')
    expect(lookup.types['potion']).toBe('potion')
    expect(lookup.types['scroll']).toBe('scroll')
    expect(lookup.types['wondrous item']).toBe('wondrous_item')
    expect(lookup.types['wondrous_item']).toBe('wondrous_item')
  })

  it('should return English rarity names mapping to keys', () => {
    expect(lookup.rarities['common']).toBe('common')
    expect(lookup.rarities['uncommon']).toBe('uncommon')
    expect(lookup.rarities['rare']).toBe('rare')
    expect(lookup.rarities['very rare']).toBe('very_rare')
    expect(lookup.rarities['very_rare']).toBe('very_rare')
    expect(lookup.rarities['legendary']).toBe('legendary')
    expect(lookup.rarities['artifact']).toBe('artifact')
  })
})

describe('getItemTypeKey', () => {
  it('should return key for exact German match', async () => {
    expect(await getItemTypeKey('Waffe', false, 'de')).toBe('weapon')
    expect(await getItemTypeKey('Rüstung', false, 'de')).toBe('armor')
    expect(await getItemTypeKey('Trank', false, 'de')).toBe('potion')
  })

  it('should return key for exact English match', async () => {
    expect(await getItemTypeKey('weapon', false, 'en')).toBe('weapon')
    expect(await getItemTypeKey('armor', false, 'en')).toBe('armor')
    expect(await getItemTypeKey('potion', false, 'en')).toBe('potion')
  })

  it('should return null for non-matching type', async () => {
    expect(await getItemTypeKey('blaster', false, 'en')).toBeNull()
    expect(await getItemTypeKey('Laser', false, 'de')).toBeNull()
  })

  it('should return null for null/undefined input', async () => {
    expect(await getItemTypeKey(null)).toBeNull()
    expect(await getItemTypeKey(undefined)).toBeNull()
  })

  it('should find type with fuzzy matching for typos', async () => {
    // "Wafee" is close to "Waffe" (1 character difference)
    expect(await getItemTypeKey('wafee', true, 'de')).toBe('weapon')
    // "potoin" is close to "potion"
    expect(await getItemTypeKey('potoin', true, 'en')).toBe('potion')
  })

  it('should NOT find type without fuzzy matching for typos', async () => {
    expect(await getItemTypeKey('wafee', false, 'de')).toBeNull()
    expect(await getItemTypeKey('potoin', false, 'en')).toBeNull()
  })
})

describe('getItemRarityKey', () => {
  it('should return key for exact German match', async () => {
    expect(await getItemRarityKey('Gewöhnlich', false, 'de')).toBe('common')
    expect(await getItemRarityKey('Selten', false, 'de')).toBe('rare')
    expect(await getItemRarityKey('Legendär', false, 'de')).toBe('legendary')
  })

  it('should return key for exact English match', async () => {
    expect(await getItemRarityKey('common', false, 'en')).toBe('common')
    expect(await getItemRarityKey('rare', false, 'en')).toBe('rare')
    expect(await getItemRarityKey('legendary', false, 'en')).toBe('legendary')
  })

  it('should return null for non-matching rarity', async () => {
    expect(await getItemRarityKey('mythic', false, 'en')).toBeNull()
    expect(await getItemRarityKey('Göttlich', false, 'de')).toBeNull()
  })

  it('should return null for null/undefined input', async () => {
    expect(await getItemRarityKey(null)).toBeNull()
    expect(await getItemRarityKey(undefined)).toBeNull()
  })

  it('should find rarity with fuzzy matching for typos', async () => {
    // "seltn" is close to "selten" (1 character difference)
    expect(await getItemRarityKey('seltn', true, 'de')).toBe('rare')
    // "comman" is close to "common"
    expect(await getItemRarityKey('comman', true, 'en')).toBe('common')
  })
})

describe('convertMetadataToKeys - Item Type', () => {
  it('should convert German item type to key', async () => {
    const metadata = { type: 'Waffe', rarity: 'common' }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.type).toBe('weapon')
  })

  it('should convert English item type with EN locale', async () => {
    const metadata = { type: 'Armor', rarity: 'rare' }
    const result = await convertMetadataToKeys(metadata, 'item', 'en')
    expect(result?.type).toBe('armor')
  })

  it('should NOT convert English type when using German locale (default)', async () => {
    // convertMetadataToKeys uses 'de' locale by default
    // English words like "Armor" are not in German lookup, so they stay unchanged
    const metadata = { type: 'Armor', rarity: 'rare' }
    const result = await convertMetadataToKeys(metadata, 'item')
    // This is correct behavior - unknown types are preserved as-is
    expect(result?.type).toBe('Armor')
  })

  it('should keep already-converted type keys unchanged', async () => {
    const metadata = { type: 'weapon', rarity: 'rare' }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.type).toBe('weapon')
  })

  it('should handle v-combobox object format for type', async () => {
    const metadata = { type: { value: 'weapon', title: 'Weapon' } }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.type).toBe('weapon')
  })
})

describe('convertMetadataToKeys - Item Rarity', () => {
  it('should convert German rarity to key', async () => {
    const metadata = { type: 'weapon', rarity: 'Legendär' }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.rarity).toBe('legendary')
  })

  it('should convert English rarity with EN locale', async () => {
    const metadata = { type: 'armor', rarity: 'Very Rare' }
    const result = await convertMetadataToKeys(metadata, 'item', 'en')
    expect(result?.rarity).toBe('very_rare')
  })

  it('should NOT convert English rarity when using German locale (default)', async () => {
    // convertMetadataToKeys uses 'de' locale by default
    // English words like "Very Rare" are not in German lookup
    const metadata = { type: 'armor', rarity: 'Very Rare' }
    const result = await convertMetadataToKeys(metadata, 'item')
    // Unknown rarities are preserved as-is
    expect(result?.rarity).toBe('Very Rare')
  })

  it('should keep already-converted rarity keys unchanged', async () => {
    const metadata = { type: 'weapon', rarity: 'legendary' }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.rarity).toBe('legendary')
  })

  it('should handle v-combobox object format for rarity', async () => {
    const metadata = { rarity: { value: 'rare', title: 'Rare' } }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.rarity).toBe('rare')
  })
})

describe('convertMetadataToKeys - Edge Cases', () => {
  it('should return null/undefined metadata unchanged', async () => {
    expect(await convertMetadataToKeys(null, 'item')).toBeNull()
    expect(await convertMetadataToKeys(undefined, 'item')).toBeUndefined()
  })

  it('should handle empty metadata object', async () => {
    const result = await convertMetadataToKeys({}, 'item')
    expect(result).toEqual({})
  })

  it('should convert both type and rarity together', async () => {
    const metadata = { type: 'Trank', rarity: 'Ungewöhnlich', customField: 'preserved' }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.type).toBe('potion')
    expect(result?.rarity).toBe('uncommon')
    expect(result?.customField).toBe('preserved')
  })

  it('should use fuzzy matching for typos in type/rarity', async () => {
    // "Wafe" close to "Waffe" (1 char diff) - uses fuzzy
    // "Legndär" (with capital L) triggers conversion, fuzzy finds "legendär"
    // Note: lowercase-only typos like "legndär" are treated as already-converted keys
    const metadata = { type: 'Wafe', rarity: 'Legndär' }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.type).toBe('weapon')
    expect(result?.rarity).toBe('legendary')
  })

  it('should treat lowercase typos as already-converted keys (not fuzzy-match them)', async () => {
    // This is by design: lowercase + no spaces = treated as key
    // If user types "legndär" (all lowercase), it's preserved as-is
    const metadata = { type: 'weapon', rarity: 'legndär' }
    const result = await convertMetadataToKeys(metadata, 'item')
    expect(result?.rarity).toBe('legndär') // Preserved, not fuzzy-matched
  })
})
