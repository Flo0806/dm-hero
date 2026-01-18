import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
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

describe('Pinboard - Group Pinning', () => {
  // Helper to create a group
  function createGroup(name: string, options?: { color?: string; icon?: string }): number {
    const result = db
      .prepare(`
        INSERT INTO entity_groups (campaign_id, name, color, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `)
      .run(testCampaignId, name, options?.color || null, options?.icon || null)
    return Number(result.lastInsertRowid)
  }

  // Helper to create a group pin
  function createGroupPin(groupId: number, displayOrder: number = 0): number {
    const result = db
      .prepare('INSERT INTO pinboard (campaign_id, group_id, display_order) VALUES (?, ?, ?)')
      .run(testCampaignId, groupId, displayOrder)
    return Number(result.lastInsertRowid)
  }

  // Cleanup groups after each test
  afterEach(() => {
    db.prepare('DELETE FROM entity_groups WHERE campaign_id = ?').run(testCampaignId)
  })

  it('should pin a group (entity_id is NULL)', () => {
    const groupId = createGroup('Test Group')
    const pinId = createGroupPin(groupId)

    const pin = db.prepare('SELECT * FROM pinboard WHERE id = ?').get(pinId) as {
      id: number
      campaign_id: number
      entity_id: number | null
      group_id: number | null
      display_order: number
    }

    expect(pin).toBeDefined()
    expect(pin.campaign_id).toBe(testCampaignId)
    expect(pin.entity_id).toBeNull()
    expect(pin.group_id).toBe(groupId)
    expect(pin.display_order).toBe(0)
  })

  it('should not allow duplicate group pins in same campaign', () => {
    const groupId = createGroup('Unique Group')
    createGroupPin(groupId)

    // Try to create duplicate pin
    expect(() => createGroupPin(groupId)).toThrow()
  })

  it('should allow pinning same group in different campaigns', () => {
    // Create another campaign
    const result = db
      .prepare('INSERT INTO campaigns (name) VALUES (?)')
      .run('Second Campaign for Group Pin')
    const secondCampaignId = Number(result.lastInsertRowid)

    try {
      const groupId = createGroup('Multi-Campaign Group')

      // Pin in first campaign
      createGroupPin(groupId)

      // Pin in second campaign (should work)
      const result2 = db
        .prepare('INSERT INTO pinboard (campaign_id, group_id, display_order) VALUES (?, ?, ?)')
        .run(secondCampaignId, groupId, 0)

      expect(result2.lastInsertRowid).toBeGreaterThan(0)
    } finally {
      // Clean up
      db.prepare('DELETE FROM pinboard WHERE campaign_id = ?').run(secondCampaignId)
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(secondCampaignId)
    }
  })

  it('should delete a group pin', () => {
    const groupId = createGroup('Group to Unpin')
    const pinId = createGroupPin(groupId)

    // Verify pin exists
    let pin = db.prepare('SELECT * FROM pinboard WHERE id = ?').get(pinId)
    expect(pin).toBeDefined()

    // Delete pin
    db.prepare('DELETE FROM pinboard WHERE id = ?').run(pinId)

    // Verify pin is gone
    pin = db.prepare('SELECT * FROM pinboard WHERE id = ?').get(pinId)
    expect(pin).toBeUndefined()
  })

  it('should return group pins with group details via JOIN', () => {
    const groupId = createGroup('Detailed Group', { color: '#D4A574', icon: 'mdi-castle' })
    createGroupPin(groupId)

    const pinWithDetails = db
      .prepare(`
        SELECT
          p.id as pin_id,
          p.display_order,
          g.name,
          g.color,
          g.icon,
          'group' as type
        FROM pinboard p
        JOIN entity_groups g ON p.group_id = g.id
        WHERE p.campaign_id = ? AND p.group_id IS NOT NULL
      `)
      .get(testCampaignId) as {
        pin_id: number
        display_order: number
        name: string
        color: string
        icon: string
        type: string
      }

    expect(pinWithDetails).toBeDefined()
    expect(pinWithDetails.name).toBe('Detailed Group')
    expect(pinWithDetails.color).toBe('#D4A574')
    expect(pinWithDetails.icon).toBe('mdi-castle')
    expect(pinWithDetails.type).toBe('group')
  })

  it('should not return pins for soft-deleted groups', () => {
    const groupId = createGroup('Soon Deleted Group')
    createGroupPin(groupId)

    // Verify pin is returned
    let pins = db
      .prepare(`
        SELECT p.* FROM pinboard p
        JOIN entity_groups g ON p.group_id = g.id
        WHERE p.campaign_id = ? AND g.deleted_at IS NULL AND p.group_id IS NOT NULL
      `)
      .all(testCampaignId)

    expect(pins).toHaveLength(1)

    // Soft delete the group
    db.prepare("UPDATE entity_groups SET deleted_at = datetime('now') WHERE id = ?").run(groupId)

    // Verify pin is not returned (group is soft-deleted)
    pins = db
      .prepare(`
        SELECT p.* FROM pinboard p
        JOIN entity_groups g ON p.group_id = g.id
        WHERE p.campaign_id = ? AND g.deleted_at IS NULL AND p.group_id IS NOT NULL
      `)
      .all(testCampaignId)

    expect(pins).toHaveLength(0)
  })

  it('should include member_count in group pin query', () => {
    const groupId = createGroup('Group with Members')

    // Add some entities to the group
    const npc1 = createEntity('Member NPC 1', npcTypeId)
    const npc2 = createEntity('Member NPC 2', npcTypeId)
    const location = createEntity('Member Location', locationTypeId)

    db.prepare('INSERT INTO entity_group_members (group_id, entity_id) VALUES (?, ?)').run(groupId, npc1)
    db.prepare('INSERT INTO entity_group_members (group_id, entity_id) VALUES (?, ?)').run(groupId, npc2)
    db.prepare('INSERT INTO entity_group_members (group_id, entity_id) VALUES (?, ?)').run(groupId, location)

    createGroupPin(groupId)

    const pinWithCount = db
      .prepare(`
        SELECT
          p.id as pin_id,
          g.name,
          (SELECT COUNT(*) FROM entity_group_members gm
           JOIN entities e ON e.id = gm.entity_id AND e.deleted_at IS NULL
           WHERE gm.group_id = g.id) as member_count
        FROM pinboard p
        JOIN entity_groups g ON p.group_id = g.id
        WHERE p.campaign_id = ? AND p.group_id IS NOT NULL
      `)
      .get(testCampaignId) as { pin_id: number; name: string; member_count: number }

    expect(pinWithCount).toBeDefined()
    expect(pinWithCount.name).toBe('Group with Members')
    expect(pinWithCount.member_count).toBe(3)
  })
})

describe('Pinboard - Mixed Entity and Group Pins', () => {
  // Helper to create a group
  function createGroup(name: string): number {
    const result = db
      .prepare(`
        INSERT INTO entity_groups (campaign_id, name, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
      `)
      .run(testCampaignId, name)
    return Number(result.lastInsertRowid)
  }

  // Helper to create a group pin
  function createGroupPin(groupId: number, displayOrder: number = 0): number {
    const result = db
      .prepare('INSERT INTO pinboard (campaign_id, group_id, display_order) VALUES (?, ?, ?)')
      .run(testCampaignId, groupId, displayOrder)
    return Number(result.lastInsertRowid)
  }

  // Cleanup groups after each test
  afterEach(() => {
    db.prepare('DELETE FROM entity_groups WHERE campaign_id = ?').run(testCampaignId)
  })

  it('should mix entity and group pins in the same pinboard', () => {
    const npcId = createEntity('Pinned NPC', npcTypeId)
    const groupId = createGroup('Pinned Group')
    const locationId = createEntity('Pinned Location', locationTypeId)

    createPin(npcId, 0)
    createGroupPin(groupId, 1)
    createPin(locationId, 2)

    const allPins = db
      .prepare('SELECT * FROM pinboard WHERE campaign_id = ? ORDER BY display_order ASC')
      .all(testCampaignId) as Array<{
        id: number
        entity_id: number | null
        group_id: number | null
        display_order: number
      }>

    expect(allPins).toHaveLength(3)
    expect(allPins[0]?.entity_id).toBe(npcId)
    expect(allPins[0]?.group_id).toBeNull()
    expect(allPins[1]?.entity_id).toBeNull()
    expect(allPins[1]?.group_id).toBe(groupId)
    expect(allPins[2]?.entity_id).toBe(locationId)
    expect(allPins[2]?.group_id).toBeNull()
  })

  it('should reorder mixed pins correctly', () => {
    const npcId = createEntity('Reorder NPC', npcTypeId)
    const groupId = createGroup('Reorder Group')
    const locationId = createEntity('Reorder Location', locationTypeId)

    const pin1 = createPin(npcId, 0)
    const pin2 = createGroupPin(groupId, 1)
    const pin3 = createPin(locationId, 2)

    // Reorder: move group to first, location to second, npc to third
    db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?').run(0, pin2)
    db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?').run(1, pin3)
    db.prepare('UPDATE pinboard SET display_order = ? WHERE id = ?').run(2, pin1)

    const pins = db
      .prepare('SELECT * FROM pinboard WHERE campaign_id = ? ORDER BY display_order ASC')
      .all(testCampaignId) as Array<{
        entity_id: number | null
        group_id: number | null
      }>

    expect(pins[0]?.group_id).toBe(groupId) // Group first
    expect(pins[1]?.entity_id).toBe(locationId) // Location second
    expect(pins[2]?.entity_id).toBe(npcId) // NPC third
  })

  it('should combine entity and group pins in unified query (like API does)', () => {
    const npcId = createEntity('API Test NPC', npcTypeId)
    const groupId = createGroup('API Test Group')

    createPin(npcId, 0)
    createGroupPin(groupId, 1)

    // Simulating the API query that combines both types
    const entityPins = db
      .prepare(`
        SELECT
          p.id as pin_id,
          p.display_order,
          e.id,
          e.name,
          et.name as type
        FROM pinboard p
        JOIN entities e ON p.entity_id = e.id
        JOIN entity_types et ON e.type_id = et.id
        WHERE p.campaign_id = ? AND e.deleted_at IS NULL AND p.entity_id IS NOT NULL
        ORDER BY p.display_order ASC
      `)
      .all(testCampaignId) as Array<{ pin_id: number; display_order: number; name: string; type: string }>

    const groupPins = db
      .prepare(`
        SELECT
          p.id as pin_id,
          p.display_order,
          g.id,
          g.name,
          'group' as type
        FROM pinboard p
        JOIN entity_groups g ON p.group_id = g.id
        WHERE p.campaign_id = ? AND g.deleted_at IS NULL AND p.group_id IS NOT NULL
        ORDER BY p.display_order ASC
      `)
      .all(testCampaignId) as Array<{ pin_id: number; display_order: number; name: string; type: string }>

    // Combine and sort
    const allPins = [...entityPins, ...groupPins].sort(
      (a, b) => a.display_order - b.display_order
    )

    expect(allPins).toHaveLength(2)
    expect(allPins[0]?.name).toBe('API Test NPC')
    expect(allPins[0]?.type).toBe('NPC')
    expect(allPins[1]?.name).toBe('API Test Group')
    expect(allPins[1]?.type).toBe('group')
  })

  it('should allow entity and group with same numeric ID to be pinned separately', () => {
    // This tests that entity_id and group_id are truly separate columns
    // An entity with id=5 and a group with id=5 should both be pinnable

    const entityId = createEntity('Entity Same ID', npcTypeId)
    const groupId = createGroup('Group Same ID')

    // It's unlikely they'll have the same ID, but we can verify the columns work independently
    createPin(entityId)
    createGroupPin(groupId)

    const entityPinCount = db
      .prepare('SELECT COUNT(*) as count FROM pinboard WHERE campaign_id = ? AND entity_id IS NOT NULL')
      .get(testCampaignId) as { count: number }

    const groupPinCount = db
      .prepare('SELECT COUNT(*) as count FROM pinboard WHERE campaign_id = ? AND group_id IS NOT NULL')
      .get(testCampaignId) as { count: number }

    expect(entityPinCount.count).toBe(1)
    expect(groupPinCount.count).toBe(1)
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
