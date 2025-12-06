import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// NPCs CRUD Tests
// Tests the NPC entity operations

let db: Database.Database
let testCampaignId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get NPC type ID
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign NPCs', 'Test description')
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

// Helper to create an NPC
function createNpc(name: string, options?: {
  description?: string
  imageUrl?: string
  metadata?: Record<string, unknown>
}): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description, image_url, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      npcTypeId,
      testCampaignId,
      name,
      options?.description || null,
      options?.imageUrl || null,
      options?.metadata ? JSON.stringify(options.metadata) : null
    )
  return Number(result.lastInsertRowid)
}

describe('NPCs - Basic CRUD', () => {
  it('should create an NPC', () => {
    const npcId = createNpc('Gandalf the Grey')

    const npc = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(npcId) as { id: number; name: string; type_id: number }

    expect(npc).toBeDefined()
    expect(npc.name).toBe('Gandalf the Grey')
    expect(npc.type_id).toBe(npcTypeId)
  })

  it('should create an NPC with all fields', () => {
    const npcId = createNpc('Elminster Aumar', {
      description: 'A powerful wizard of Faerûn',
      imageUrl: 'elminster.jpg',
      metadata: {
        race: 'human',
        class: 'wizard',
        alignment: 'chaoticGood',
        age: 1200,
        occupation: 'Sage'
      }
    })

    const npc = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(npcId) as {
        name: string
        description: string
        image_url: string
        metadata: string
      }

    expect(npc.name).toBe('Elminster Aumar')
    expect(npc.description).toBe('A powerful wizard of Faerûn')
    expect(npc.image_url).toBe('elminster.jpg')

    const metadata = JSON.parse(npc.metadata)
    expect(metadata.race).toBe('human')
    expect(metadata.class).toBe('wizard')
    expect(metadata.alignment).toBe('chaoticGood')
  })

  it('should update an NPC', () => {
    const npcId = createNpc('Old Name')

    db.prepare('UPDATE entities SET name = ?, description = ? WHERE id = ?')
      .run('New Name', 'Updated description', npcId)

    const npc = db
      .prepare('SELECT name, description FROM entities WHERE id = ?')
      .get(npcId) as { name: string; description: string }

    expect(npc.name).toBe('New Name')
    expect(npc.description).toBe('Updated description')
  })

  it('should soft-delete an NPC', () => {
    const npcId = createNpc('To Delete')

    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(npcId)

    const npc = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(npcId) as { deleted_at: string | null }

    expect(npc.deleted_at).not.toBeNull()
  })

  it('should not return soft-deleted NPCs in normal queries', () => {
    const npcId = createNpc('Deleted NPC')
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(npcId)

    const npcs = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, testCampaignId)

    expect(npcs).toHaveLength(0)
  })
})

describe('NPCs - Metadata', () => {
  it('should store race in metadata', () => {
    const npcId = createNpc('Drizzt', { metadata: { race: 'elf' } })

    const npc = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(npcId) as { metadata: string }

    const metadata = JSON.parse(npc.metadata)
    expect(metadata.race).toBe('elf')
  })

  it('should store class in metadata', () => {
    const npcId = createNpc('Fighter NPC', { metadata: { class: 'fighter' } })

    const npc = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(npcId) as { metadata: string }

    const metadata = JSON.parse(npc.metadata)
    expect(metadata.class).toBe('fighter')
  })

  it('should store alignment in metadata', () => {
    const npcId = createNpc('Paladin', { metadata: { alignment: 'lawfulGood' } })

    const npc = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(npcId) as { metadata: string }

    const metadata = JSON.parse(npc.metadata)
    expect(metadata.alignment).toBe('lawfulGood')
  })

  it('should query NPCs by race using json_extract', () => {
    createNpc('Human 1', { metadata: { race: 'human' } })
    createNpc('Human 2', { metadata: { race: 'human' } })
    createNpc('Elf 1', { metadata: { race: 'elf' } })

    const humans = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$.race') = ?
      `)
      .all(npcTypeId, testCampaignId, 'human')

    expect(humans).toHaveLength(2)
  })

  it('should store custom metadata fields', () => {
    const npcId = createNpc('Custom NPC', {
      metadata: {
        race: 'human',
        customField1: 'value1',
        customField2: 42,
        nested: { key: 'value' }
      }
    })

    const npc = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(npcId) as { metadata: string }

    const metadata = JSON.parse(npc.metadata)
    expect(metadata.customField1).toBe('value1')
    expect(metadata.customField2).toBe(42)
    expect(metadata.nested.key).toBe('value')
  })
})

describe('NPCs - FTS5 Search', () => {
  it('should find NPC by name', () => {
    createNpc('Shadowheart')
    createNpc('Astarion')

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
      .all('shadow*', npcTypeId, testCampaignId)

    expect(results).toHaveLength(1)
    expect((results[0] as { name: string }).name).toBe('Shadowheart')
  })

  it('should find NPC by description', () => {
    const npcId = createNpc('Mystery NPC')
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run('A mysterious rogue from the shadows', npcId)

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
      .all('mysterious*', npcTypeId, testCampaignId)

    expect(results).toHaveLength(1)
  })
})

describe('NPCs - Campaign Isolation', () => {
  it('should only return NPCs from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create NPCs in both campaigns
    createNpc('NPC in Test Campaign')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaign2Id, 'NPC in Campaign 2')

    const testCampaignNpcs = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, testCampaignId)

    const campaign2Npcs = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, campaign2Id)

    expect(testCampaignNpcs).toHaveLength(1)
    expect(campaign2Npcs).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('NPCs - Timestamps', () => {
  it('should set created_at on creation', () => {
    const npcId = createNpc('Timestamped NPC')

    const npc = db
      .prepare('SELECT created_at FROM entities WHERE id = ?')
      .get(npcId) as { created_at: string }

    expect(npc.created_at).toBeDefined()
    expect(new Date(npc.created_at)).toBeInstanceOf(Date)
  })

  it('should update updated_at on modification', () => {
    const npcId = createNpc('Update Test NPC')

    const before = db
      .prepare('SELECT updated_at FROM entities WHERE id = ?')
      .get(npcId) as { updated_at: string }

    // Wait a bit to ensure timestamp difference
    db.prepare('UPDATE entities SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Modified NPC', npcId)

    const after = db
      .prepare('SELECT updated_at FROM entities WHERE id = ?')
      .get(npcId) as { updated_at: string }

    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before.updated_at).getTime())
  })
})
