import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Pinboard Tests
// Tests pinning entities, removing pins, reordering, and fetching pins

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let locationTypeId: number
let itemTypeId: number

interface PinRow {
  id: number
  campaign_id: number
  entity_id: number
  display_order: number
  created_at: string
}

interface EntityRow {
  id: number
  name: string
}

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number }
  npcTypeId = npcType.id
  locationTypeId = locationType.id
  itemTypeId = itemType.id

  // Create test campaign
  const result = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Pinboard Test Campaign', 'Campaign for pinboard tests')
  testCampaignId = Number(result.lastInsertRowid)
})

afterAll(() => {
  // Clean up test data
  db.prepare('DELETE FROM pinboard WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
})

beforeEach(() => {
  // Clean up pins before each test
  db.prepare('DELETE FROM pinboard WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create an entity
function createEntity(name: string, typeId: number): number {
  const result = db
    .prepare('INSERT INTO entities (name, campaign_id, type_id) VALUES (?, ?, ?)')
    .run(name, testCampaignId, typeId)
  return Number(result.lastInsertRowid)
}

// Helper to create a pin
function createPin(entityId: number, displayOrder: number = 0): number {
  const result = db
    .prepare('INSERT INTO pinboard (campaign_id, entity_id, display_order) VALUES (?, ?, ?)')
    .run(testCampaignId, entityId, displayOrder)
  return Number(result.lastInsertRowid)
}

// Helper to get all pins for the test campaign
function getPins(): PinRow[] {
  return db
    .prepare('SELECT * FROM pinboard WHERE campaign_id = ? ORDER BY display_order ASC')
    .all(testCampaignId) as PinRow[]
}

describe('Pinboard - Basic Operations', () => {
  it('should create a pin for an entity', () => {
    const entityId = createEntity('Test NPC for Pin', npcTypeId)
    const pinId = createPin(entityId)

    const pin = db.prepare('SELECT * FROM pinboard WHERE id = ?').get(pinId) as PinRow

    expect(pin).toBeDefined()
    expect(pin.campaign_id).toBe(testCampaignId)
    expect(pin.entity_id).toBe(entityId)
    expect(pin.display_order).toBe(0)
  })

  it('should not allow duplicate pins for same entity in same campaign', () => {
    const entityId = createEntity('Unique NPC', npcTypeId)
    createPin(entityId)

    // Try to create duplicate pin
    expect(() => createPin(entityId)).toThrow()
  })

  it('should delete a pin', () => {
    const entityId = createEntity('NPC to Unpin', npcTypeId)
    const pinId = createPin(entityId)

    // Verify pin exists
    let pin = db.prepare('SELECT * FROM pinboard WHERE id = ?').get(pinId)
    expect(pin).toBeDefined()

    // Delete pin
    db.prepare('DELETE FROM pinboard WHERE id = ?').run(pinId)

    // Verify pin is gone
    pin = db.prepare('SELECT * FROM pinboard WHERE id = ?').get(pinId)
    expect(pin).toBeUndefined()
  })

  it('should allow pinning same entity in different campaigns', () => {
    // Create another campaign
    const result = db
      .prepare('INSERT INTO campaigns (name) VALUES (?)')
      .run('Second Pinboard Campaign')
    const secondCampaignId = Number(result.lastInsertRowid)

    try {
      const entityId = createEntity('Multi-Campaign NPC', npcTypeId)

      // Pin in first campaign
      createPin(entityId)

      // Pin in second campaign (should work)
      const result2 = db
        .prepare('INSERT INTO pinboard (campaign_id, entity_id, display_order) VALUES (?, ?, ?)')
        .run(secondCampaignId, entityId, 0)

      expect(result2.lastInsertRowid).toBeGreaterThan(0)
    } finally {
      // Clean up
      db.prepare('DELETE FROM pinboard WHERE campaign_id = ?').run(secondCampaignId)
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(secondCampaignId)
    }
  })
})

describe('Pinboard - Multiple Entity Types', () => {
  it('should pin entities of different types', () => {
    const npcId = createEntity('Pinned NPC', npcTypeId)
    const locationId = createEntity('Pinned Location', locationTypeId)
    const itemId = createEntity('Pinned Item', itemTypeId)

    createPin(npcId, 0)
    createPin(locationId, 1)
    createPin(itemId, 2)

    const pins = getPins()

    expect(pins).toHaveLength(3)
    expect(pins[0]?.entity_id).toBe(npcId)
    expect(pins[1]?.entity_id).toBe(locationId)
    expect(pins[2]?.entity_id).toBe(itemId)
  })

  it('should return pins with entity details via JOIN', () => {
    const npcId = createEntity('Detailed NPC', npcTypeId)
    createPin(npcId)

    const pinWithDetails = db
      .prepare(`
        SELECT p.id as pin_id, p.display_order, e.name, et.name as type
        FROM pinboard p
        JOIN entities e ON p.entity_id = e.id
        JOIN entity_types et ON e.type_id = et.id
        WHERE p.campaign_id = ?
      `)
      .get(testCampaignId) as { pin_id: number; display_order: number; name: string; type: string }

    expect(pinWithDetails).toBeDefined()
    expect(pinWithDetails.name).toBe('Detailed NPC')
    expect(pinWithDetails.type).toBe('NPC')
  })
})

describe('Pinboard - Ordering', () => {
  it('should maintain display order', () => {
    const npc1 = createEntity('First NPC', npcTypeId)
    const npc2 = createEntity('Second NPC', npcTypeId)
    const npc3 = createEntity('Third NPC', npcTypeId)

    createPin(npc1, 0)
    createPin(npc2, 1)
    createPin(npc3, 2)

    const pins = getPins()

    expect(pins[0]?.entity_id).toBe(npc1)
    expect(pins[1]?.entity_id).toBe(npc2)
    expect(pins[2]?.entity_id).toBe(npc3)
  })

  it('should allow reordering pins', () => {
    const npc1 = createEntity('Reorder NPC 1', npcTypeId)
    const npc2 = createEntity('Reorder NPC 2', npcTypeId)
    const npc3 = createEntity('Reorder NPC 3', npcTypeId)

    const pin1 = createPin(npc1, 0)
    const pin2 = createPin(npc2, 1)
    const pin3 = createPin(npc3, 2)

    // Reorder: move npc3 to first position
    db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?').run(0, pin3)
    db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?').run(1, pin1)
    db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?').run(2, pin2)

    const pins = getPins()

    expect(pins[0]?.entity_id).toBe(npc3)
    expect(pins[1]?.entity_id).toBe(npc1)
    expect(pins[2]?.entity_id).toBe(npc2)
  })

  it('should handle batch reorder via transaction', () => {
    const entities = [
      createEntity('Batch NPC A', npcTypeId),
      createEntity('Batch NPC B', npcTypeId),
      createEntity('Batch NPC C', npcTypeId),
      createEntity('Batch NPC D', npcTypeId),
    ]

    const pinIds = entities.map((entityId, index) => createPin(entityId, index))

    // New order: D, B, A, C (indices 3, 1, 0, 2)
    const newOrder = [pinIds[3], pinIds[1], pinIds[0], pinIds[2]]

    const updateStmt = db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?')
    const transaction = db.transaction((pinIds: (number | undefined)[]) => {
      pinIds.forEach((pinId, index) => {
        if (pinId !== undefined) {
          updateStmt.run(index, pinId)
        }
      })
    })

    transaction(newOrder)

    const pins = getPins()

    expect(pins[0]?.entity_id).toBe(entities[3]) // D
    expect(pins[1]?.entity_id).toBe(entities[1]) // B
    expect(pins[2]?.entity_id).toBe(entities[0]) // A
    expect(pins[3]?.entity_id).toBe(entities[2]) // C
  })
})

describe('Pinboard - Soft Delete Handling', () => {
  it('should not return pins for soft-deleted entities', () => {
    const entityId = createEntity('Soon Deleted NPC', npcTypeId)
    createPin(entityId)

    // Verify pin is returned
    let pins = db
      .prepare(`
        SELECT p.* FROM pinboard p
        JOIN entities e ON p.entity_id = e.id
        WHERE p.campaign_id = ? AND e.deleted_at IS NULL
      `)
      .all(testCampaignId) as PinRow[]

    expect(pins).toHaveLength(1)

    // Soft delete the entity
    db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?").run(entityId)

    // Verify pin is not returned (entity is soft-deleted)
    pins = db
      .prepare(`
        SELECT p.* FROM pinboard p
        JOIN entities e ON p.entity_id = e.id
        WHERE p.campaign_id = ? AND e.deleted_at IS NULL
      `)
      .all(testCampaignId) as PinRow[]

    expect(pins).toHaveLength(0)
  })

  it('should keep pin in database when entity is soft-deleted', () => {
    const entityId = createEntity('Soft Delete Test NPC', npcTypeId)
    const pinId = createPin(entityId)

    // Soft delete the entity
    db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?").run(entityId)

    // Pin should still exist in database
    const pin = db.prepare('SELECT * FROM pinboard WHERE id = ?').get(pinId) as PinRow

    expect(pin).toBeDefined()
    expect(pin.entity_id).toBe(entityId)
  })
})

describe('Pinboard - Campaign Isolation', () => {
  it('should only return pins for the specified campaign', () => {
    // Create second campaign
    const result = db
      .prepare('INSERT INTO campaigns (name) VALUES (?)')
      .run('Isolation Test Campaign')
    const secondCampaignId = Number(result.lastInsertRowid)

    try {
      // Create entities and pins in both campaigns
      const npc1 = createEntity('Campaign 1 NPC', npcTypeId)
      createPin(npc1)

      const npc2Result = db
        .prepare('INSERT INTO entities (name, campaign_id, type_id) VALUES (?, ?, ?)')
        .run('Campaign 2 NPC', secondCampaignId, npcTypeId)
      const npc2 = Number(npc2Result.lastInsertRowid)

      db.prepare('INSERT INTO pinboard (campaign_id, entity_id, display_order) VALUES (?, ?, ?)')
        .run(secondCampaignId, npc2, 0)

      // Get pins for first campaign
      const campaign1Pins = getPins()
      expect(campaign1Pins).toHaveLength(1)
      expect(campaign1Pins[0]?.entity_id).toBe(npc1)

      // Get pins for second campaign
      const campaign2Pins = db
        .prepare('SELECT * FROM pinboard WHERE campaign_id = ?')
        .all(secondCampaignId) as PinRow[]
      expect(campaign2Pins).toHaveLength(1)
      expect(campaign2Pins[0]?.entity_id).toBe(npc2)
    } finally {
      // Clean up
      db.prepare('DELETE FROM pinboard WHERE campaign_id = ?').run(secondCampaignId)
      db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(secondCampaignId)
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(secondCampaignId)
    }
  })
})

describe('Pinboard - Edge Cases', () => {
  it('should handle pinning entity with metadata', () => {
    const result = db
      .prepare('INSERT INTO entities (name, campaign_id, type_id, metadata) VALUES (?, ?, ?, ?)')
      .run('NPC with Metadata', testCampaignId, npcTypeId, JSON.stringify({ race: 'elf', class: 'wizard' }))
    const entityId = Number(result.lastInsertRowid)

    createPin(entityId)

    const pinWithMetadata = db
      .prepare(`
        SELECT p.id, e.name, e.metadata
        FROM pinboard p
        JOIN entities e ON p.entity_id = e.id
        WHERE p.campaign_id = ?
      `)
      .get(testCampaignId) as { id: number; name: string; metadata: string }

    expect(pinWithMetadata).toBeDefined()
    expect(pinWithMetadata.name).toBe('NPC with Metadata')

    const metadata = JSON.parse(pinWithMetadata.metadata)
    expect(metadata.race).toBe('elf')
    expect(metadata.class).toBe('wizard')
  })

  it('should handle empty pinboard', () => {
    const pins = getPins()
    expect(pins).toHaveLength(0)
  })

  it('should auto-increment display_order correctly', () => {
    const npc1 = createEntity('Auto Order 1', npcTypeId)
    const npc2 = createEntity('Auto Order 2', npcTypeId)

    // Get max order and increment
    const getMaxOrder = () => {
      const result = db
        .prepare('SELECT MAX(display_order) as max_order FROM pinboard WHERE campaign_id = ?')
        .get(testCampaignId) as { max_order: number | null }
      return result.max_order ?? -1
    }

    const order1 = getMaxOrder() + 1
    createPin(npc1, order1)

    const order2 = getMaxOrder() + 1
    createPin(npc2, order2)

    expect(order1).toBe(0)
    expect(order2).toBe(1)

    const pins = getPins()
    expect(pins[0]?.display_order).toBe(0)
    expect(pins[1]?.display_order).toBe(1)
  })
})
