import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Items CRUD Tests
// Tests the Item entity operations

let db: Database.Database
let testCampaignId: number
let itemTypeId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get type IDs
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number }
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  itemTypeId = itemType.id
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Items', 'Test description')
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

// Helper to create an Item
function createItem(name: string, options?: {
  description?: string
  imageUrl?: string
  metadata?: Record<string, unknown>
}): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description, image_url, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      itemTypeId,
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

describe('Items - Basic CRUD', () => {
  it('should create an item', () => {
    const itemId = createItem('Excalibur')

    const item = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(itemId) as { id: number; name: string; type_id: number }

    expect(item).toBeDefined()
    expect(item.name).toBe('Excalibur')
    expect(item.type_id).toBe(itemTypeId)
  })

  it('should create an item with all fields', () => {
    const itemId = createItem('Staff of Power', {
      description: 'A legendary staff imbued with arcane energy',
      imageUrl: 'staff.jpg',
      metadata: {
        type: 'weapon',
        rarity: 'legendary',
        attunement: true,
        value: 50000
      }
    })

    const item = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(itemId) as {
        name: string
        description: string
        image_url: string
        metadata: string
      }

    expect(item.name).toBe('Staff of Power')
    expect(item.description).toBe('A legendary staff imbued with arcane energy')
    expect(item.image_url).toBe('staff.jpg')

    const metadata = JSON.parse(item.metadata)
    expect(metadata.type).toBe('weapon')
    expect(metadata.rarity).toBe('legendary')
    expect(metadata.attunement).toBe(true)
  })

  it('should update an item', () => {
    const itemId = createItem('Old Sword')

    db.prepare('UPDATE entities SET name = ?, description = ? WHERE id = ?')
      .run('New Sword', 'Updated description', itemId)

    const item = db
      .prepare('SELECT name, description FROM entities WHERE id = ?')
      .get(itemId) as { name: string; description: string }

    expect(item.name).toBe('New Sword')
    expect(item.description).toBe('Updated description')
  })

  it('should soft-delete an item', () => {
    const itemId = createItem('To Delete')

    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(itemId)

    const item = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(itemId) as { deleted_at: string | null }

    expect(item.deleted_at).not.toBeNull()
  })
})

describe('Items - Metadata', () => {
  it('should store item type in metadata', () => {
    const itemId = createItem('Longsword', { metadata: { type: 'weapon' } })

    const item = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(itemId) as { metadata: string }

    const metadata = JSON.parse(item.metadata)
    expect(metadata.type).toBe('weapon')
  })

  it('should store rarity in metadata', () => {
    const itemId = createItem('Rare Item', { metadata: { rarity: 'rare' } })

    const item = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(itemId) as { metadata: string }

    const metadata = JSON.parse(item.metadata)
    expect(metadata.rarity).toBe('rare')
  })

  it('should query items by type using json_extract', () => {
    createItem('Sword', { metadata: { type: 'weapon' } })
    createItem('Axe', { metadata: { type: 'weapon' } })
    createItem('Ring', { metadata: { type: 'accessory' } })

    const weapons = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$.type') = ?
      `)
      .all(itemTypeId, testCampaignId, 'weapon')

    expect(weapons).toHaveLength(2)
  })

  it('should query items by rarity using json_extract', () => {
    createItem('Common Sword', { metadata: { rarity: 'common' } })
    createItem('Rare Sword', { metadata: { rarity: 'rare' } })
    createItem('Legendary Sword', { metadata: { rarity: 'legendary' } })

    const legendary = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$.rarity') = ?
      `)
      .all(itemTypeId, testCampaignId, 'legendary')

    expect(legendary).toHaveLength(1)
  })
})

describe('Items - Ownership Relations', () => {
  it('should link item to owner (NPC)', () => {
    const itemId = createItem('Magic Ring')
    const npcId = createNpc('Ring Owner')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(npcId, itemId, 'owns')

    const relation = db
      .prepare(`
        SELECT e.name as owner_name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
      `)
      .get(itemId) as { owner_name: string; relation_type: string }

    expect(relation.owner_name).toBe('Ring Owner')
    expect(relation.relation_type).toBe('owns')
  })

  it('should find all items owned by an NPC', () => {
    const npcId = createNpc('Item Hoarder')
    const item1 = createItem('Item 1')
    const item2 = createItem('Item 2')
    const item3 = createItem('Item 3')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npcId, item1, 'owns')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npcId, item2, 'carries')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npcId, item3, 'wields')

    const items = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(npcId, itemTypeId)

    expect(items).toHaveLength(3)
  })
})

describe('Items - FTS5 Search', () => {
  it('should find item by name', () => {
    createItem('Flaming Sword')
    createItem('Ice Shield')

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
      .all('flaming*', itemTypeId, testCampaignId)

    expect(results).toHaveLength(1)
    expect((results[0] as { name: string }).name).toBe('Flaming Sword')
  })

  it('should find item by description', () => {
    const itemId = createItem('Mystery Item')
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run('A cursed artifact from ancient times', itemId)

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
      .all('cursed*', itemTypeId, testCampaignId)

    expect(results).toHaveLength(1)
  })
})

describe('Items - Campaign Isolation', () => {
  it('should only return items from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create items in both campaigns
    createItem('Item in Test Campaign')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, campaign2Id, 'Item in Campaign 2')

    const testCampaignItems = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(itemTypeId, testCampaignId)

    const campaign2Items = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(itemTypeId, campaign2Id)

    expect(testCampaignItems).toHaveLength(1)
    expect(campaign2Items).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})
