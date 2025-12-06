import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Custom Races & Classes Tests
// Tests for adding custom races and classes

let db: Database.Database

beforeAll(() => {
  db = getDb()
})

afterAll(() => {
  if (db) {
    db.prepare("DELETE FROM races WHERE name LIKE 'test_%'").run()
    db.prepare("DELETE FROM classes WHERE name LIKE 'test_%'").run()
  }
})

beforeEach(() => {
  db.prepare("DELETE FROM races WHERE name LIKE 'test_%'").run()
  db.prepare("DELETE FROM classes WHERE name LIKE 'test_%'").run()
})

describe('Custom Races - CRUD', () => {
  it('should create a custom race', () => {
    const result = db
      .prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_dragonborn', 'Drachenblut', 'Dragonborn')

    expect(result.changes).toBe(1)

    const race = db
      .prepare('SELECT * FROM races WHERE name = ?')
      .get('test_dragonborn') as { name: string; name_de: string; name_en: string }

    expect(race.name_de).toBe('Drachenblut')
    expect(race.name_en).toBe('Dragonborn')
  })

  it('should update a custom race', () => {
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_update_race', 'Alt', 'Old')

    db.prepare('UPDATE races SET name_de = ?, name_en = ? WHERE name = ?')
      .run('Neu', 'New', 'test_update_race')

    const race = db
      .prepare('SELECT * FROM races WHERE name = ?')
      .get('test_update_race') as { name_de: string; name_en: string }

    expect(race.name_de).toBe('Neu')
    expect(race.name_en).toBe('New')
  })

  it('should delete a custom race', () => {
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_delete_race', 'Delete DE', 'Delete EN')

    db.prepare('DELETE FROM races WHERE name = ?').run('test_delete_race')

    const race = db
      .prepare('SELECT * FROM races WHERE name = ?')
      .get('test_delete_race')

    expect(race).toBeUndefined()
  })

  it('should prevent duplicate race names', () => {
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_unique_race', 'First DE', 'First EN')

    expect(() => {
      db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
        .run('test_unique_race', 'Second DE', 'Second EN')
    }).toThrow()
  })

  it('should find race by German name', () => {
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_find_de', 'Besondere Rasse', 'Special Race')

    const race = db
      .prepare('SELECT * FROM races WHERE name_de = ?')
      .get('Besondere Rasse') as { name: string }

    expect(race).toBeDefined()
    expect(race.name).toBe('test_find_de')
  })

  it('should find race by English name', () => {
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_find_en', 'Rasse DE', 'Special Race EN')

    const race = db
      .prepare('SELECT * FROM races WHERE name_en = ?')
      .get('Special Race EN') as { name: string }

    expect(race).toBeDefined()
    expect(race.name).toBe('test_find_en')
  })

  it('should list all races including custom ones', () => {
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_list_race', 'List DE', 'List EN')

    const races = db
      .prepare('SELECT * FROM races ORDER BY name')
      .all() as Array<{ name: string }>

    const raceNames = races.map(r => r.name)
    expect(raceNames).toContain('human')
    expect(raceNames).toContain('elf')
    expect(raceNames).toContain('test_list_race')
  })
})

describe('Custom Classes - CRUD', () => {
  it('should create a custom class', () => {
    const result = db
      .prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_artificer', 'Konstrukteur', 'Artificer')

    expect(result.changes).toBe(1)

    const cls = db
      .prepare('SELECT * FROM classes WHERE name = ?')
      .get('test_artificer') as { name: string; name_de: string; name_en: string }

    expect(cls.name_de).toBe('Konstrukteur')
    expect(cls.name_en).toBe('Artificer')
  })

  it('should update a custom class', () => {
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_update_class', 'Alt', 'Old')

    db.prepare('UPDATE classes SET name_de = ?, name_en = ? WHERE name = ?')
      .run('Neu', 'New', 'test_update_class')

    const cls = db
      .prepare('SELECT * FROM classes WHERE name = ?')
      .get('test_update_class') as { name_de: string; name_en: string }

    expect(cls.name_de).toBe('Neu')
    expect(cls.name_en).toBe('New')
  })

  it('should delete a custom class', () => {
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_delete_class', 'Delete DE', 'Delete EN')

    db.prepare('DELETE FROM classes WHERE name = ?').run('test_delete_class')

    const cls = db
      .prepare('SELECT * FROM classes WHERE name = ?')
      .get('test_delete_class')

    expect(cls).toBeUndefined()
  })

  it('should prevent duplicate class names', () => {
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_unique_class', 'First DE', 'First EN')

    expect(() => {
      db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
        .run('test_unique_class', 'Second DE', 'Second EN')
    }).toThrow()
  })

  it('should find class by German name', () => {
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_find_de_class', 'Besondere Klasse', 'Special Class')

    const cls = db
      .prepare('SELECT * FROM classes WHERE name_de = ?')
      .get('Besondere Klasse') as { name: string }

    expect(cls).toBeDefined()
    expect(cls.name).toBe('test_find_de_class')
  })

  it('should find class by English name', () => {
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_find_en_class', 'Klasse DE', 'Special Class EN')

    const cls = db
      .prepare('SELECT * FROM classes WHERE name_en = ?')
      .get('Special Class EN') as { name: string }

    expect(cls).toBeDefined()
    expect(cls.name).toBe('test_find_en_class')
  })

  it('should list all classes including custom ones', () => {
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_list_class', 'List DE', 'List EN')

    const classes = db
      .prepare('SELECT * FROM classes ORDER BY name')
      .all() as Array<{ name: string }>

    const classNames = classes.map(c => c.name)
    expect(classNames).toContain('fighter')
    expect(classNames).toContain('wizard')
    expect(classNames).toContain('test_list_class')
  })
})

describe('Races & Classes - Case Sensitivity', () => {
  it('should handle case-insensitive race lookup', () => {
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_case_race', 'Test Rasse', 'Test Race')

    const byLower = db
      .prepare('SELECT * FROM races WHERE LOWER(name) = LOWER(?)')
      .get('TEST_CASE_RACE') as { name: string }

    const byExact = db
      .prepare('SELECT * FROM races WHERE name = ?')
      .get('test_case_race') as { name: string }

    expect(byLower).toBeDefined()
    expect(byExact).toBeDefined()
    expect(byLower.name).toBe(byExact.name)
  })

  it('should handle case-insensitive class lookup', () => {
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_case_class', 'Test Klasse', 'Test Class')

    const byLower = db
      .prepare('SELECT * FROM classes WHERE LOWER(name) = LOWER(?)')
      .get('TEST_CASE_CLASS') as { name: string }

    const byExact = db
      .prepare('SELECT * FROM classes WHERE name = ?')
      .get('test_case_class') as { name: string }

    expect(byLower).toBeDefined()
    expect(byExact).toBeDefined()
    expect(byLower.name).toBe(byExact.name)
  })
})

describe('Races & Classes - Standard Data Protection', () => {
  it('should have standard races that cannot be accidentally deleted', () => {
    // Standard races should exist
    const human = db.prepare('SELECT * FROM races WHERE name = ?').get('human')
    const elf = db.prepare('SELECT * FROM races WHERE name = ?').get('elf')
    const dwarf = db.prepare('SELECT * FROM races WHERE name = ?').get('dwarf')

    expect(human).toBeDefined()
    expect(elf).toBeDefined()
    expect(dwarf).toBeDefined()
  })

  it('should have standard classes that cannot be accidentally deleted', () => {
    // Standard classes should exist
    const fighter = db.prepare('SELECT * FROM classes WHERE name = ?').get('fighter')
    const wizard = db.prepare('SELECT * FROM classes WHERE name = ?').get('wizard')
    const rogue = db.prepare('SELECT * FROM classes WHERE name = ?').get('rogue')

    expect(fighter).toBeDefined()
    expect(wizard).toBeDefined()
    expect(rogue).toBeDefined()
  })
})

describe('Races & Classes - Integration with NPCs', () => {
  let testCampaignId: number
  let npcTypeId: number

  beforeAll(() => {
    const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
    npcTypeId = npcType.id

    const campaign = db
      .prepare('INSERT INTO campaigns (name) VALUES (?)')
      .run('Races Classes Test Campaign')
    testCampaignId = Number(campaign.lastInsertRowid)
  })

  afterAll(() => {
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  })

  it('should allow NPC with custom race in metadata', () => {
    // Create custom race
    db.prepare('INSERT INTO races (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_npc_race', 'NPC Rasse', 'NPC Race')

    // Create NPC with that race
    const result = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name, metadata) VALUES (?, ?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Test NPC', JSON.stringify({ race: 'test_npc_race' }))

    const npc = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(result.lastInsertRowid) as { metadata: string }

    const metadata = JSON.parse(npc.metadata)
    expect(metadata.race).toBe('test_npc_race')
  })

  it('should allow NPC with custom class in metadata', () => {
    // Create custom class
    db.prepare('INSERT INTO classes (name, name_de, name_en) VALUES (?, ?, ?)')
      .run('test_npc_class', 'NPC Klasse', 'NPC Class')

    // Create NPC with that class
    const result = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name, metadata) VALUES (?, ?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Test NPC 2', JSON.stringify({ class: 'test_npc_class' }))

    const npc = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(result.lastInsertRowid) as { metadata: string }

    const metadata = JSON.parse(npc.metadata)
    expect(metadata.class).toBe('test_npc_class')
  })
})
