import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Factions CRUD Tests
// Tests the Faction entity operations

let db: Database.Database
let testCampaignId: number
let factionTypeId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get type IDs
  const factionType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as { id: number }
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  factionTypeId = factionType.id
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Factions', 'Test description')
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

// Helper to create a Faction
function createFaction(name: string, options?: {
  description?: string
  imageUrl?: string
  metadata?: Record<string, unknown>
}): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description, image_url, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      factionTypeId,
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

describe('Factions - Basic CRUD', () => {
  it('should create a faction', () => {
    const factionId = createFaction('Harpers')

    const faction = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(factionId) as { id: number; name: string; type_id: number }

    expect(faction).toBeDefined()
    expect(faction.name).toBe('Harpers')
    expect(faction.type_id).toBe(factionTypeId)
  })

  it('should create a faction with all fields', () => {
    const factionId = createFaction('Zhentarim', {
      description: 'The Black Network, a shadowy organization',
      imageUrl: 'zhentarim.jpg',
      metadata: {
        type: 'criminal',
        alignment: 'lawfulEvil',
        headquarters: 'Darkhold'
      }
    })

    const faction = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(factionId) as {
        name: string
        description: string
        image_url: string
        metadata: string
      }

    expect(faction.name).toBe('Zhentarim')
    expect(faction.description).toBe('The Black Network, a shadowy organization')
    expect(faction.image_url).toBe('zhentarim.jpg')

    const metadata = JSON.parse(faction.metadata)
    expect(metadata.type).toBe('criminal')
    expect(metadata.alignment).toBe('lawfulEvil')
  })

  it('should update a faction', () => {
    const factionId = createFaction('Old Name')

    db.prepare('UPDATE entities SET name = ?, description = ? WHERE id = ?')
      .run('New Name', 'Updated description', factionId)

    const faction = db
      .prepare('SELECT name, description FROM entities WHERE id = ?')
      .get(factionId) as { name: string; description: string }

    expect(faction.name).toBe('New Name')
    expect(faction.description).toBe('Updated description')
  })

  it('should soft-delete a faction', () => {
    const factionId = createFaction('To Delete')

    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(factionId)

    const faction = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(factionId) as { deleted_at: string | null }

    expect(faction.deleted_at).not.toBeNull()
  })
})

describe('Factions - Metadata', () => {
  it('should store faction type in metadata', () => {
    const factionId = createFaction('Trade Guild', { metadata: { type: 'guild' } })

    const faction = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(factionId) as { metadata: string }

    const metadata = JSON.parse(faction.metadata)
    expect(metadata.type).toBe('guild')
  })

  it('should store alignment in metadata', () => {
    const factionId = createFaction('Good Faction', { metadata: { alignment: 'lawfulGood' } })

    const faction = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(factionId) as { metadata: string }

    const metadata = JSON.parse(faction.metadata)
    expect(metadata.alignment).toBe('lawfulGood')
  })

  it('should query factions by type using json_extract', () => {
    createFaction('Guild 1', { metadata: { type: 'guild' } })
    createFaction('Guild 2', { metadata: { type: 'guild' } })
    createFaction('Crime Syndicate', { metadata: { type: 'criminal' } })

    const guilds = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$.type') = ?
      `)
      .all(factionTypeId, testCampaignId, 'guild')

    expect(guilds).toHaveLength(2)
  })
})

describe('Factions - Membership Relations', () => {
  it('should link NPC to faction as member', () => {
    const factionId = createFaction('Adventurers Guild')
    const npcId = createNpc('Guild Member')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(npcId, factionId, 'member')

    const members = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(factionId, npcTypeId)

    expect(members).toHaveLength(1)
    expect((members[0] as { name: string }).name).toBe('Guild Member')
  })

  it('should count faction members', () => {
    const factionId = createFaction('Large Faction')

    for (let i = 0; i < 5; i++) {
      const npcId = createNpc(`Member ${i}`)
      db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
        .run(npcId, factionId, 'member')
    }

    const memberCount = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .get(factionId, npcTypeId) as { count: number }

    expect(memberCount.count).toBe(5)
  })

  it('should support different membership roles', () => {
    const factionId = createFaction('Structured Faction')
    const leader = createNpc('Leader')
    const officer = createNpc('Officer')
    const member = createNpc('Member')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(leader, factionId, 'leader')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(officer, factionId, 'officer')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(member, factionId, 'member')

    const roles = db
      .prepare(`
        SELECT er.relation_type, COUNT(*) as count
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
        GROUP BY er.relation_type
      `)
      .all(factionId, npcTypeId) as Array<{ relation_type: string; count: number }>

    expect(roles).toHaveLength(3)
    const leaderRole = roles.find(r => r.relation_type === 'leader')
    expect(leaderRole?.count).toBe(1)
  })
})

describe('Factions - Faction Relations', () => {
  it('should link factions to each other (ally)', () => {
    const faction1 = createFaction('Faction A')
    const faction2 = createFaction('Faction B')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(faction1, faction2, 'ally')

    const allies = db
      .prepare(`
        SELECT e.name
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND er.relation_type = ?
      `)
      .all(faction1, 'ally')

    expect(allies).toHaveLength(1)
    expect((allies[0] as { name: string }).name).toBe('Faction B')
  })

  it('should link factions as enemies', () => {
    const faction1 = createFaction('Good Faction')
    const faction2 = createFaction('Evil Faction')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(faction1, faction2, 'enemy')

    const enemies = db
      .prepare(`
        SELECT e.name
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND er.relation_type = ?
      `)
      .all(faction1, 'enemy')

    expect(enemies).toHaveLength(1)
  })
})

describe('Factions - FTS5 Search', () => {
  it('should find faction by name', () => {
    createFaction('Order of the Gauntlet')
    createFaction('Lords Alliance')

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
      .all('gauntlet*', factionTypeId, testCampaignId)

    expect(results).toHaveLength(1)
    expect((results[0] as { name: string }).name).toBe('Order of the Gauntlet')
  })

  it('should find faction by description', () => {
    const factionId = createFaction('Secret Society')
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run('An underground network of spies and assassins', factionId)

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
      .all('spies*', factionTypeId, testCampaignId)

    expect(results).toHaveLength(1)
  })
})

describe('Factions - Campaign Isolation', () => {
  it('should only return factions from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create factions in both campaigns
    createFaction('Faction in Test Campaign')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, campaign2Id, 'Faction in Campaign 2')

    const testCampaignFactions = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(factionTypeId, testCampaignId)

    const campaign2Factions = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(factionTypeId, campaign2Id)

    expect(testCampaignFactions).toHaveLength(1)
    expect(campaign2Factions).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})
