import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Lore CRUD Tests
// Tests the Lore entity operations

let db: Database.Database
let testCampaignId: number
let loreTypeId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get type IDs
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number }
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  loreTypeId = loreType.id
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Lore', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create a Lore entry
function createLore(name: string, options?: {
  description?: string
  imageUrl?: string
  metadata?: Record<string, unknown>
}): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description, image_url, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      loreTypeId,
      testCampaignId,
      name,
      options?.description || null,
      options?.imageUrl || null,
      options?.metadata ? JSON.stringify(options.metadata) : null
    )
  return Number(result.lastInsertRowid)
}

// Helper to create an NPC
function createNpc(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

describe('Lore - Basic CRUD', () => {
  it('should create a lore entry', () => {
    const loreId = createLore('The Great Cataclysm')

    const lore = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(loreId) as { id: number; name: string; type_id: number }

    expect(lore).toBeDefined()
    expect(lore.name).toBe('The Great Cataclysm')
    expect(lore.type_id).toBe(loreTypeId)
  })

  it('should create a lore entry with all fields', () => {
    const loreId = createLore('The Spellplague', {
      description: 'A catastrophic event that changed the nature of magic',
      imageUrl: 'spellplague.jpg',
      metadata: {
        type: 'event',
        era: 'Second Sundering',
        year: 1385,
        isSecret: false
      }
    })

    const lore = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(loreId) as {
        name: string
        description: string
        image_url: string
        metadata: string
      }

    expect(lore.name).toBe('The Spellplague')
    expect(lore.description).toBe('A catastrophic event that changed the nature of magic')
    expect(lore.image_url).toBe('spellplague.jpg')

    const metadata = JSON.parse(lore.metadata)
    expect(metadata.type).toBe('event')
    expect(metadata.year).toBe(1385)
  })

  it('should update a lore entry', () => {
    const loreId = createLore('Old Legend')

    db.prepare('UPDATE entities SET name = ?, description = ? WHERE id = ?')
      .run('New Legend', 'Updated description', loreId)

    const lore = db
      .prepare('SELECT name, description FROM entities WHERE id = ?')
      .get(loreId) as { name: string; description: string }

    expect(lore.name).toBe('New Legend')
    expect(lore.description).toBe('Updated description')
  })

  it('should soft-delete a lore entry', () => {
    const loreId = createLore('To Delete')

    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(loreId)

    const lore = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(loreId) as { deleted_at: string | null }

    expect(lore.deleted_at).not.toBeNull()
  })
})

describe('Lore - Metadata', () => {
  it('should store lore type in metadata', () => {
    const loreId = createLore('Ancient Prophecy', { metadata: { type: 'prophecy' } })

    const lore = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(loreId) as { metadata: string }

    const metadata = JSON.parse(lore.metadata)
    expect(metadata.type).toBe('prophecy')
  })

  it('should store era in metadata', () => {
    const loreId = createLore('Historical Event', { metadata: { era: 'First Age' } })

    const lore = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(loreId) as { metadata: string }

    const metadata = JSON.parse(lore.metadata)
    expect(metadata.era).toBe('First Age')
  })

  it('should store isSecret flag in metadata', () => {
    const loreId = createLore('Secret Knowledge', { metadata: { isSecret: true } })

    const lore = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(loreId) as { metadata: string }

    const metadata = JSON.parse(lore.metadata)
    expect(metadata.isSecret).toBe(true)
  })

  it('should query lore by type using json_extract', () => {
    createLore('Prophecy 1', { metadata: { type: 'prophecy' } })
    createLore('Prophecy 2', { metadata: { type: 'prophecy' } })
    createLore('Legend 1', { metadata: { type: 'legend' } })

    const prophecies = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$.type') = ?
      `)
      .all(loreTypeId, testCampaignId, 'prophecy')

    expect(prophecies).toHaveLength(2)
  })

  it('should query secret lore', () => {
    createLore('Public Knowledge', { metadata: { isSecret: false } })
    createLore('Secret 1', { metadata: { isSecret: true } })
    createLore('Secret 2', { metadata: { isSecret: true } })

    const secrets = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$.isSecret') = 1
      `)
      .all(loreTypeId, testCampaignId)

    expect(secrets).toHaveLength(2)
  })
})

describe('Lore - NPC Knowledge Relations', () => {
  it('should link NPC to lore (knows)', () => {
    const loreId = createLore('Ancient Secret')
    const npcId = createNpc('Scholar')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(npcId, loreId, 'knows')

    const knowers = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(loreId, npcTypeId)

    expect(knowers).toHaveLength(1)
    expect((knowers[0] as { name: string }).name).toBe('Scholar')
  })

  it('should find all lore known by an NPC', () => {
    const npcId = createNpc('Wise Sage')
    const lore1 = createLore('Knowledge 1')
    const lore2 = createLore('Knowledge 2')
    const lore3 = createLore('Knowledge 3')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npcId, lore1, 'knows')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npcId, lore2, 'knows')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npcId, lore3, 'knows')

    const knownLore = db
      .prepare(`
        SELECT e.name
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(npcId, loreTypeId)

    expect(knownLore).toHaveLength(3)
  })

  it('should support different knowledge relation types', () => {
    const loreId = createLore('Complex Knowledge')
    const npc1 = createNpc('Creator')
    const npc2 = createNpc('Seeker')
    const npc3 = createNpc('Guardian')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npc1, loreId, 'created')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npc2, loreId, 'seeks')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npc3, loreId, 'guards')

    const relations = db
      .prepare(`
        SELECT er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
      `)
      .all(loreId, npcTypeId) as Array<{ relation_type: string }>

    expect(relations).toHaveLength(3)
    expect(relations.map(r => r.relation_type)).toContain('created')
    expect(relations.map(r => r.relation_type)).toContain('seeks')
    expect(relations.map(r => r.relation_type)).toContain('guards')
  })
})

describe('Lore - FTS5 Search', () => {
  it('should find lore by name', () => {
    createLore('Dragon Prophecy')
    createLore('Elven History')

    const results = db
      .prepare(`
        SELECT e.id, e.name
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `)
      .all('dragon*', loreTypeId, testCampaignId)

    expect(results).toHaveLength(1)
    expect((results[0] as { name: string }).name).toBe('Dragon Prophecy')
  })

  it('should find lore by description', () => {
    const loreId = createLore('Mystery Lore')
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run('An ancient prophecy foretelling the return of darkness', loreId)

    const results = db
      .prepare(`
        SELECT e.id, e.name
        FROM entities_fts fts
        INNER JOIN entities e ON fts.rowid = e.id
        WHERE entities_fts MATCH ?
          AND e.type_id = ?
          AND e.campaign_id = ?
          AND e.deleted_at IS NULL
      `)
      .all('darkness*', loreTypeId, testCampaignId)

    expect(results).toHaveLength(1)
  })
})

describe('Lore - Campaign Isolation', () => {
  it('should only return lore from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create lore in both campaigns
    createLore('Lore in Test Campaign')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, campaign2Id, 'Lore in Campaign 2')

    const testCampaignLore = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(loreTypeId, testCampaignId)

    const campaign2Lore = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(loreTypeId, campaign2Id)

    expect(testCampaignLore).toHaveLength(1)
    expect(campaign2Lore).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})
