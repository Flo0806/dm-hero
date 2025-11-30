import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// NPC Counts Reactivity Tests - Critical for tab count updates
let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let itemTypeId: number
let loreTypeId: number
let factionTypeId: number

beforeAll(() => {
  db = getDb()

  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as {
    id: number
  }
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as {
    id: number
  }
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as {
    id: number
  }
  const factionType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as {
    id: number
  }

  npcTypeId = npcType.id
  itemTypeId = itemType.id
  loreTypeId = loreType.id
  factionTypeId = factionType.id

  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign - NPC Counts', 'NPC counts reactivity tests')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  db.prepare(
    'DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)',
  ).run(testCampaignId)
  db.prepare(
    'DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)',
  ).run(testCampaignId)
  db.prepare('DELETE FROM entity_documents WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
})

describe('NPC Counts API - Items (Bidirectional)', () => {
  it('should count items owned by NPC', () => {
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    const item1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Staff')
    const item1Id = Number(item1.lastInsertRowid)

    const item2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Ring')
    const item2Id = Number(item2.lastInsertRowid)

    // NPC owns items (NPC → Item)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, item1Id, 'besitzt')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, item2Id, 'besitzt')

    // Count items bidirectionally (like /api/npcs/[id]/counts.get.ts)
    const result = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should update count after adding item', () => {
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    // Initial count = 0
    let result = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }
    expect(result.count).toBe(0)

    // Add item
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Staff')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, Number(item.lastInsertRowid), 'besitzt')

    // Count should update to 1
    result = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }
    expect(result.count).toBe(1)
  })

  it('should update count after removing item', () => {
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Staff')
    const itemId = Number(item.lastInsertRowid)

    const relation = db
      .prepare(
        'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
      )
      .run(npcId, itemId, 'besitzt')

    // Count = 1
    let result = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }
    expect(result.count).toBe(1)

    // Remove relation
    db.prepare('DELETE FROM entity_relations WHERE id = ?').run(Number(relation.lastInsertRowid))

    // Count should update to 0
    result = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }
    expect(result.count).toBe(0)
  })
})

describe('NPC Counts API - Lore', () => {
  it('should count lore entries linked to NPC', () => {
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    const lore1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Ring of Power')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(Number(lore1.lastInsertRowid), npcId, 'kennt')

    const lore2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Balrog')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(Number(lore2.lastInsertRowid), npcId, 'kennt')

    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `,
      )
      .get(npcId, loreTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('NPC Counts API - Memberships (Factions)', () => {
  it('should count faction memberships', () => {
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    const faction1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'White Council')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, Number(faction1.lastInsertRowid), 'Mitglied')

    const faction2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Fellowship')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, Number(faction2.lastInsertRowid), 'Anführer')

    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `,
      )
      .get(npcId, factionTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('NPC Counts API - Documents', () => {
  it('should count documents', () => {
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)').run(
      npcId,
      'Backstory',
      'Born in...',
      '2025-01-01',
    )
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)').run(
      npcId,
      'Secrets',
      'Knows about...',
      '2025-01-02',
    )

    const result = db
      .prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(npcId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('NPC Counts API - Images', () => {
  it('should count images', () => {
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)').run(
      npcId,
      'gandalf1.png',
      1,
    )
    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)').run(
      npcId,
      'gandalf2.png',
      0,
    )

    const result = db
      .prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(npcId) as { count: number }

    expect(result.count).toBe(2)
  })
})
