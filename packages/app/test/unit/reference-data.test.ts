import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Reference Data Tests
// Tests for races, classes, and other reference tables

let db: Database.Database

beforeAll(() => {
  db = getDb()
})

afterAll(() => {
  // Cleanup any test data
  db.prepare("DELETE FROM races WHERE name LIKE 'test_%'").run()
  db.prepare("DELETE FROM classes WHERE name LIKE 'test_%'").run()
})

beforeEach(() => {
  db.prepare("DELETE FROM races WHERE name LIKE 'test_%'").run()
  db.prepare("DELETE FROM classes WHERE name LIKE 'test_%'").run()
})

describe('Races - Basic Operations', () => {
  it('should have default races seeded', () => {
    const races = db
      .prepare('SELECT * FROM races ORDER BY name')
      .all() as Array<{ name: string; name_de: string; name_en: string }>

    expect(races.length).toBeGreaterThan(0)

    // Check for common D&D races
    const raceNames = races.map(r => r.name)
    expect(raceNames).toContain('human')
    expect(raceNames).toContain('elf')
    expect(raceNames).toContain('dwarf')
  })

  it('should have German and English translations', () => {
    const human = db
      .prepare('SELECT * FROM races WHERE name = ?')
      .get('human') as { name: string; name_de: string; name_en: string }

    expect(human).toBeDefined()
    expect(human.name_de).toBe('Mensch')
    expect(human.name_en).toBe('Human')
  })

  it('should create a custom race', () => {
    const result = db
      .prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_custom_race', 'Test Rasse', 'Test Race')

    expect(result.changes).toBe(1)

    const race = db
      .prepare('SELECT * FROM races WHERE name = ?')
      .get('test_custom_race') as { name: string; name_de: string; name_en: string }

    expect(race.name_de).toBe('Test Rasse')
    expect(race.name_en).toBe('Test Race')
  })

  it('should find race by key', () => {
    const race = db
      .prepare('SELECT * FROM races WHERE name = ?')
      .get('elf') as { name: string; name_de: string }

    expect(race).toBeDefined()
    expect(race.name_de).toBe('Elf')
  })

  it('should find race by German name', () => {
    const race = db
      .prepare('SELECT * FROM races WHERE name_de = ?')
      .get('Zwerg') as { name: string; name_en: string }

    expect(race).toBeDefined()
    expect(race.name).toBe('dwarf')
    expect(race.name_en).toBe('Dwarf')
  })

  it('should find race by English name', () => {
    const race = db
      .prepare('SELECT * FROM races WHERE name_en = ?')
      .get('Halfling') as { name: string; name_de: string }

    expect(race).toBeDefined()
    expect(race.name).toBe('halfling')
    expect(race.name_de).toBe('Halbling')
  })
})

describe('Classes - Basic Operations', () => {
  it('should have default classes seeded', () => {
    const classes = db
      .prepare('SELECT * FROM classes ORDER BY name')
      .all() as Array<{ name: string; name_de: string; name_en: string }>

    expect(classes.length).toBeGreaterThan(0)

    // Check for common D&D classes
    const classNames = classes.map(c => c.name)
    expect(classNames).toContain('fighter')
    expect(classNames).toContain('wizard')
    expect(classNames).toContain('rogue')
  })

  it('should have German and English translations', () => {
    const wizard = db
      .prepare('SELECT * FROM classes WHERE name = ?')
      .get('wizard') as { name: string; name_de: string; name_en: string }

    expect(wizard).toBeDefined()
    expect(wizard.name_de).toBe('Magier')
    expect(wizard.name_en).toBe('Wizard')
  })

  it('should create a custom class', () => {
    const result = db
      .prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_custom_class', 'Test Klasse', 'Test Class')

    expect(result.changes).toBe(1)

    const cls = db
      .prepare('SELECT * FROM classes WHERE name = ?')
      .get('test_custom_class') as { name: string; name_de: string; name_en: string }

    expect(cls.name_de).toBe('Test Klasse')
    expect(cls.name_en).toBe('Test Class')
  })

  it('should find class by key', () => {
    const cls = db
      .prepare('SELECT * FROM classes WHERE name = ?')
      .get('paladin') as { name: string; name_de: string }

    expect(cls).toBeDefined()
    expect(cls.name_de).toBe('Paladin')
  })

  it('should find class by German name', () => {
    const cls = db
      .prepare('SELECT * FROM classes WHERE name_de = ?')
      .get('Schurke') as { name: string; name_en: string }

    expect(cls).toBeDefined()
    expect(cls.name).toBe('rogue')
    expect(cls.name_en).toBe('Rogue')
  })
})

describe('Entity Types - Seeded Data', () => {
  it('should have all entity types seeded', () => {
    const types = db
      .prepare('SELECT * FROM entity_types ORDER BY name')
      .all() as Array<{ name: string; icon: string; color: string }>

    const typeNames = types.map(t => t.name)

    expect(typeNames).toContain('NPC')
    expect(typeNames).toContain('Item')
    expect(typeNames).toContain('Location')
    expect(typeNames).toContain('Faction')
    expect(typeNames).toContain('Lore')
    expect(typeNames).toContain('Player')
  })

  it('should have icons for each entity type', () => {
    const npc = db
      .prepare('SELECT * FROM entity_types WHERE name = ?')
      .get('NPC') as { icon: string; color: string }

    expect(npc.icon).toBeDefined()
    expect(npc.icon.length).toBeGreaterThan(0)
  })

  it('should have colors for each entity type', () => {
    const item = db
      .prepare('SELECT * FROM entity_types WHERE name = ?')
      .get('Item') as { icon: string; color: string }

    expect(item.color).toBeDefined()
    expect(item.color.length).toBeGreaterThan(0)
  })
})

describe('Item Types - Seeded Data', () => {
  it('should have item types seeded', () => {
    const itemTypes = db
      .prepare('SELECT * FROM item_types ORDER BY name')
      .all() as Array<{ name: string; name_de: string; name_en: string }>

    expect(itemTypes.length).toBeGreaterThan(0)
  })
})

describe('Item Rarities - Seeded Data', () => {
  it('should have item rarities seeded', () => {
    const rarities = db
      .prepare('SELECT * FROM item_rarities ORDER BY name')
      .all() as Array<{ name: string; name_de: string; name_en: string }>

    expect(rarities.length).toBeGreaterThan(0)

    // Check common D&D rarities
    const rarityNames = rarities.map(r => r.name)
    expect(rarityNames).toContain('common')
    expect(rarityNames).toContain('rare')
    expect(rarityNames).toContain('legendary')
  })

  it('should have German and English translations for rarities', () => {
    const common = db
      .prepare('SELECT * FROM item_rarities WHERE name = ?')
      .get('common') as { name: string; name_de: string; name_en: string }

    expect(common).toBeDefined()
    expect(common.name_de).toBeDefined()
    expect(common.name_en).toBeDefined()
  })
})

describe('Currencies - Campaign Specific', () => {
  let currencyTestCampaignId: number

  beforeAll(() => {
    // Create a test campaign for currency tests
    const campaign = db
      .prepare('INSERT INTO campaigns (name) VALUES (?)')
      .run('Currency Test Campaign')
    currencyTestCampaignId = Number(campaign.lastInsertRowid)

    // Add test currencies
    db.prepare('INSERT INTO currencies (campaign_id, code, name, symbol) VALUES (?, ?, ?, ?)')
      .run(currencyTestCampaignId, 'gp', 'Gold', 'G')
    db.prepare('INSERT INTO currencies (campaign_id, code, name, symbol) VALUES (?, ?, ?, ?)')
      .run(currencyTestCampaignId, 'sp', 'Silver', 'S')
  })

  afterAll(() => {
    db.prepare('DELETE FROM currencies WHERE campaign_id = ?').run(currencyTestCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(currencyTestCampaignId)
  })

  it('should have currencies for the test campaign', () => {
    const currencies = db
      .prepare('SELECT * FROM currencies WHERE campaign_id = ? ORDER BY code')
      .all(currencyTestCampaignId) as Array<{ name: string; code: string }>

    expect(currencies.length).toBe(2)
  })

  it('should find currency by code', () => {
    const gold = db
      .prepare('SELECT * FROM currencies WHERE campaign_id = ? AND code = ?')
      .get(currencyTestCampaignId, 'gp') as { name: string; code: string; symbol: string }

    expect(gold).toBeDefined()
    expect(gold.name).toBe('Gold')
    expect(gold.symbol).toBe('G')
  })
})

describe('Reference Data - Case Insensitive Lookup', () => {
  it('should find race regardless of case', () => {
    const byLower = db
      .prepare('SELECT * FROM races WHERE LOWER(name_en) = LOWER(?)')
      .get('HUMAN') as { name: string }

    const byNormal = db
      .prepare('SELECT * FROM races WHERE LOWER(name_en) = LOWER(?)')
      .get('Human') as { name: string }

    expect(byLower).toBeDefined()
    expect(byNormal).toBeDefined()
    expect(byLower.name).toBe(byNormal.name)
  })

  it('should find class regardless of case', () => {
    const byLower = db
      .prepare('SELECT * FROM classes WHERE LOWER(name_en) = LOWER(?)')
      .get('WIZARD') as { name: string }

    const byNormal = db
      .prepare('SELECT * FROM classes WHERE LOWER(name_en) = LOWER(?)')
      .get('Wizard') as { name: string }

    expect(byLower).toBeDefined()
    expect(byNormal).toBeDefined()
    expect(byLower.name).toBe(byNormal.name)
  })
})
