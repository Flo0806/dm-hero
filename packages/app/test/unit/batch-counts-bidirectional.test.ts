import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

/**
 * Bidirectional Batch Counts Tests
 *
 * Tests the bidirectional counting logic in batch-counts APIs:
 * - NPCs batch-counts: items, locations, lore (bidirectional)
 * - Factions batch-counts: members (NPC), lore (bidirectional)
 *
 * These tests ensure that entity relations are counted correctly
 * regardless of which direction they were created.
 */

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let itemTypeId: number
let locationTypeId: number
let factionTypeId: number
let loreTypeId: number

beforeAll(() => {
  db = getDb()

  const getTypeId = (name: string) => {
    const type = db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number }
    return type.id
  }

  npcTypeId = getTypeId('NPC')
  itemTypeId = getTypeId('Item')
  locationTypeId = getTypeId('Location')
  factionTypeId = getTypeId('Faction')
  loreTypeId = getTypeId('Lore')

  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign - Batch Counts Bidirectional', 'Bidirectional batch counts tests')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM entity_group_members WHERE group_id IN (SELECT id FROM entity_groups WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_groups WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM entity_group_members WHERE group_id IN (SELECT id FROM entity_groups WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_groups WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

function createEntity(typeId: number, name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(typeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

function createRelation(fromId: number, toId: number, relationType: string): void {
  db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
    .run(fromId, toId, relationType)
}

function softDelete(entityId: number): void {
  db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?").run(entityId)
}

// =============================================================================
// NPC BATCH-COUNTS - ITEMS (BIDIRECTIONAL)
// =============================================================================

describe('NPC Batch Counts - Items (Bidirectional)', () => {
  it('should count items when NPC owns item (NPC -> Item)', () => {
    const npcId = createEntity(npcTypeId, 'Item Owner')
    const item1 = createEntity(itemTypeId, 'Sword')
    const item2 = createEntity(itemTypeId, 'Shield')

    // NPC -> Item (owns)
    createRelation(npcId, item1, 'owns')
    createRelation(npcId, item2, 'owns')

    // Query like npcs/batch-counts does (bidirectional)
    const result = db.prepare(`
      SELECT COUNT(DISTINCT item_id) as count FROM (
        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should count items when Item references NPC (Item -> NPC)', () => {
    const npcId = createEntity(npcTypeId, 'Referenced NPC')
    const item1 = createEntity(itemTypeId, 'Magic Ring')
    const item2 = createEntity(itemTypeId, 'Cursed Amulet')

    // Item -> NPC (item references its creator/owner)
    createRelation(item1, npcId, 'created_by')
    createRelation(item2, npcId, 'cursed_by')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT item_id) as count FROM (
        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should count items from BOTH directions combined', () => {
    const npcId = createEntity(npcTypeId, 'Mixed Relations NPC')
    const ownedItem = createEntity(itemTypeId, 'Owned Sword')
    const creatorItem = createEntity(itemTypeId, 'Created Ring')

    // NPC -> Item (owns)
    createRelation(npcId, ownedItem, 'owns')
    // Item -> NPC (created by)
    createRelation(creatorItem, npcId, 'created_by')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT item_id) as count FROM (
        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should NOT double-count items with bidirectional relations', () => {
    const npcId = createEntity(npcTypeId, 'Bidirectional NPC')
    const itemId = createEntity(itemTypeId, 'Bidirectional Item')

    // Both directions
    createRelation(npcId, itemId, 'owns')
    createRelation(itemId, npcId, 'belongs_to')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT item_id) as count FROM (
        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }

    // Should be 1, not 2 (DISTINCT)
    expect(result.count).toBe(1)
  })

  it('should NOT count soft-deleted items', () => {
    const npcId = createEntity(npcTypeId, 'Active NPC')
    const activeItem = createEntity(itemTypeId, 'Active Item')
    const deletedItem = createEntity(itemTypeId, 'Deleted Item')

    createRelation(npcId, activeItem, 'owns')
    createRelation(npcId, deletedItem, 'owns')
    softDelete(deletedItem)

    const result = db.prepare(`
      SELECT COUNT(DISTINCT item_id) as count FROM (
        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, itemTypeId, npcId, itemTypeId) as { count: number }

    expect(result.count).toBe(1)
  })
})

// =============================================================================
// NPC BATCH-COUNTS - LOCATIONS (BIDIRECTIONAL)
// =============================================================================

describe('NPC Batch Counts - Locations (Bidirectional)', () => {
  it('should count locations when NPC lives at location (NPC -> Location)', () => {
    const npcId = createEntity(npcTypeId, 'Resident NPC')
    const location1 = createEntity(locationTypeId, 'Home')
    const location2 = createEntity(locationTypeId, 'Workplace')

    createRelation(npcId, location1, 'lives_at')
    createRelation(npcId, location2, 'works_at')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT location_id) as count FROM (
        SELECT e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, locationTypeId, npcId, locationTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should count locations when Location has NPC (Location -> NPC)', () => {
    const npcId = createEntity(npcTypeId, 'Guest NPC')
    const location = createEntity(locationTypeId, 'Tavern')

    // Location -> NPC (location has this NPC as resident)
    createRelation(location, npcId, 'has_resident')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT location_id) as count FROM (
        SELECT e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, locationTypeId, npcId, locationTypeId) as { count: number }

    expect(result.count).toBe(1)
  })

  it('should count locations from BOTH directions combined', () => {
    const npcId = createEntity(npcTypeId, 'Traveling NPC')
    const home = createEntity(locationTypeId, 'Home')
    const inn = createEntity(locationTypeId, 'Inn')

    // NPC -> Location
    createRelation(npcId, home, 'lives_at')
    // Location -> NPC
    createRelation(inn, npcId, 'has_guest')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT location_id) as count FROM (
        SELECT e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as location_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, locationTypeId, npcId, locationTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

// =============================================================================
// NPC BATCH-COUNTS - LORE (BIDIRECTIONAL)
// =============================================================================

describe('NPC Batch Counts - Lore (Bidirectional)', () => {
  it('should count lore when NPC knows lore (NPC -> Lore)', () => {
    const npcId = createEntity(npcTypeId, 'Scholar NPC')
    const lore1 = createEntity(loreTypeId, 'Ancient Legend')
    const lore2 = createEntity(loreTypeId, 'Secret History')

    createRelation(npcId, lore1, 'knows')
    createRelation(npcId, lore2, 'knows')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT lore_id) as count FROM (
        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, loreTypeId, npcId, loreTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should count lore when Lore mentions NPC (Lore -> NPC)', () => {
    const npcId = createEntity(npcTypeId, 'Legendary NPC')
    const lore = createEntity(loreTypeId, 'Tale of the Hero')

    // Lore -> NPC (lore mentions this NPC)
    createRelation(lore, npcId, 'mentions')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT lore_id) as count FROM (
        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(npcId, loreTypeId, npcId, loreTypeId) as { count: number }

    expect(result.count).toBe(1)
  })
})

// =============================================================================
// FACTION BATCH-COUNTS - MEMBERS (UNIDIRECTIONAL - NPC -> FACTION)
// =============================================================================

describe('Faction Batch Counts - Members (Bidirectional)', () => {
  it('should count members when NPC joins faction (NPC -> Faction)', () => {
    const factionId = createEntity(factionTypeId, 'Thieves Guild')
    const npc1 = createEntity(npcTypeId, 'Member 1')
    const npc2 = createEntity(npcTypeId, 'Member 2')

    // Traditional: NPC -> Faction
    createRelation(npc1, factionId, 'member')
    createRelation(npc2, factionId, 'member')

    // Bidirectional query for members
    const result = db.prepare(`
      SELECT COUNT(DISTINCT npc_id) as count FROM (
        SELECT e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(factionId, npcTypeId, factionId, npcTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should count members when Faction recruits NPC (Faction -> NPC)', () => {
    const factionId = createEntity(factionTypeId, 'Knights Order')
    const npc = createEntity(npcTypeId, 'Recruited Knight')

    // Reverse: Faction -> NPC
    createRelation(factionId, npc, 'recruited')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT npc_id) as count FROM (
        SELECT e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(factionId, npcTypeId, factionId, npcTypeId) as { count: number }

    expect(result.count).toBe(1)
  })

  it('should count members from BOTH directions combined', () => {
    const factionId = createEntity(factionTypeId, 'Mixed Guild')
    const joiningNpc = createEntity(npcTypeId, 'Joining Member')
    const recruitedNpc = createEntity(npcTypeId, 'Recruited Member')

    // NPC -> Faction
    createRelation(joiningNpc, factionId, 'member')
    // Faction -> NPC
    createRelation(factionId, recruitedNpc, 'recruited')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT npc_id) as count FROM (
        SELECT e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as npc_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(factionId, npcTypeId, factionId, npcTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

// =============================================================================
// FACTION BATCH-COUNTS - LORE (BIDIRECTIONAL)
// =============================================================================

describe('Faction Batch Counts - Lore (Bidirectional)', () => {
  it('should count lore when Lore references faction (Lore -> Faction)', () => {
    const factionId = createEntity(factionTypeId, 'Ancient Order')
    const lore1 = createEntity(loreTypeId, 'Founding Legend')
    const lore2 = createEntity(loreTypeId, 'Secret Rituals')

    // Lore -> Faction
    createRelation(lore1, factionId, 'references')
    createRelation(lore2, factionId, 'references')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT lore_id) as count FROM (
        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(factionId, loreTypeId, factionId, loreTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should count lore when Faction has lore (Faction -> Lore)', () => {
    const factionId = createEntity(factionTypeId, 'Keeper Guild')
    const lore = createEntity(loreTypeId, 'Guild Secrets')

    // Faction -> Lore
    createRelation(factionId, lore, 'guards')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT lore_id) as count FROM (
        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(factionId, loreTypeId, factionId, loreTypeId) as { count: number }

    expect(result.count).toBe(1)
  })

  it('should count lore from BOTH directions combined', () => {
    const factionId = createEntity(factionTypeId, 'Lore Faction')
    const referencingLore = createEntity(loreTypeId, 'Referencing Lore')
    const guardedLore = createEntity(loreTypeId, 'Guarded Lore')

    // Lore -> Faction
    createRelation(referencingLore, factionId, 'references')
    // Faction -> Lore
    createRelation(factionId, guardedLore, 'guards')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT lore_id) as count FROM (
        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT e.id as lore_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
    `).get(factionId, loreTypeId, factionId, loreTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

// =============================================================================
// QUICK LINK - EXISTING LINKED ENTITIES FILTERING
// =============================================================================

describe('QuickLink - Existing Linked Entities Filter', () => {
  // Tests the logic used in QuickLinkEntitySelectDialog to filter out
  // already-linked entities when showing the selection list

  it('should find all linked entities bidirectionally', () => {
    const sourceNpc = createEntity(npcTypeId, 'Source NPC')
    const linkedNpc1 = createEntity(npcTypeId, 'Linked NPC 1')
    const linkedNpc2 = createEntity(npcTypeId, 'Linked NPC 2')
    const unlinkedNpc = createEntity(npcTypeId, 'Unlinked NPC')

    // Source -> Linked1
    createRelation(sourceNpc, linkedNpc1, 'friend')
    // Linked2 -> Source
    createRelation(linkedNpc2, sourceNpc, 'enemy')

    // Query like QuickLinkEntitySelectDialog does via /api/entities/[id]/related/[type]
    const linkedIds = db.prepare(`
      SELECT DISTINCT
        CASE WHEN from_entity_id = ? THEN to_entity_id ELSE from_entity_id END as linked_id
      FROM entity_relations
      WHERE (from_entity_id = ? OR to_entity_id = ?)
    `).all(sourceNpc, sourceNpc, sourceNpc) as Array<{ linked_id: number }>

    const linkedIdSet = new Set(linkedIds.map(r => r.linked_id))

    expect(linkedIdSet.has(linkedNpc1)).toBe(true)
    expect(linkedIdSet.has(linkedNpc2)).toBe(true)
    expect(linkedIdSet.has(unlinkedNpc)).toBe(false)
  })

  it('should find linked entities of specific type', () => {
    const sourceNpc = createEntity(npcTypeId, 'Source NPC')
    const linkedLocation = createEntity(locationTypeId, 'Linked Location')
    const linkedItem = createEntity(itemTypeId, 'Linked Item')
    const unlinkedLocation = createEntity(locationTypeId, 'Unlinked Location')

    createRelation(sourceNpc, linkedLocation, 'lives_at')
    createRelation(sourceNpc, linkedItem, 'owns')

    // Query for locations only (like the dialog does)
    const linkedLocations = db.prepare(`
      SELECT DISTINCT
        CASE WHEN er.from_entity_id = ? THEN er.to_entity_id ELSE er.from_entity_id END as linked_id
      FROM entity_relations er
      INNER JOIN entities e ON e.id = (
        CASE WHEN er.from_entity_id = ? THEN er.to_entity_id ELSE er.from_entity_id END
      )
      WHERE (er.from_entity_id = ? OR er.to_entity_id = ?)
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `).all(sourceNpc, sourceNpc, sourceNpc, sourceNpc, locationTypeId) as Array<{ linked_id: number }>

    const linkedIdSet = new Set(linkedLocations.map(r => r.linked_id))

    expect(linkedIdSet.has(linkedLocation)).toBe(true)
    expect(linkedIdSet.has(unlinkedLocation)).toBe(false)
    expect(linkedIdSet.has(linkedItem)).toBe(false) // Different type
  })

  it('should NOT include soft-deleted entities in linked list', () => {
    const sourceNpc = createEntity(npcTypeId, 'Source NPC')
    const activeLinked = createEntity(npcTypeId, 'Active Linked')
    const deletedLinked = createEntity(npcTypeId, 'Deleted Linked')

    createRelation(sourceNpc, activeLinked, 'friend')
    createRelation(sourceNpc, deletedLinked, 'friend')
    softDelete(deletedLinked)

    const linkedIds = db.prepare(`
      SELECT DISTINCT
        CASE WHEN er.from_entity_id = ? THEN er.to_entity_id ELSE er.from_entity_id END as linked_id
      FROM entity_relations er
      INNER JOIN entities e ON e.id = (
        CASE WHEN er.from_entity_id = ? THEN er.to_entity_id ELSE er.from_entity_id END
      )
      WHERE (er.from_entity_id = ? OR er.to_entity_id = ?)
        AND e.deleted_at IS NULL
    `).all(sourceNpc, sourceNpc, sourceNpc, sourceNpc) as Array<{ linked_id: number }>

    const linkedIdSet = new Set(linkedIds.map(r => r.linked_id))

    expect(linkedIdSet.has(activeLinked)).toBe(true)
    expect(linkedIdSet.has(deletedLinked)).toBe(false)
  })

  it('should filter entities list correctly', () => {
    const sourceNpc = createEntity(npcTypeId, 'Source NPC')
    const linkedNpc = createEntity(npcTypeId, 'Already Linked')
    const _availableNpc1 = createEntity(npcTypeId, 'Available 1')
    const _availableNpc2 = createEntity(npcTypeId, 'Available 2')

    createRelation(sourceNpc, linkedNpc, 'friend')

    // Get all NPCs
    const allNpcs = db.prepare(`
      SELECT id, name FROM entities
      WHERE campaign_id = ? AND type_id = ? AND deleted_at IS NULL
    `).all(testCampaignId, npcTypeId) as Array<{ id: number; name: string }>

    // Get linked NPC IDs
    const linkedIds = db.prepare(`
      SELECT DISTINCT
        CASE WHEN from_entity_id = ? THEN to_entity_id ELSE from_entity_id END as linked_id
      FROM entity_relations
      WHERE (from_entity_id = ? OR to_entity_id = ?)
    `).all(sourceNpc, sourceNpc, sourceNpc) as Array<{ linked_id: number }>

    const linkedIdSet = new Set(linkedIds.map(r => r.linked_id))

    // Filter like QuickLinkEntitySelectDialog does
    const filteredEntities = allNpcs.filter(
      e => e.id !== sourceNpc && !linkedIdSet.has(e.id),
    )

    expect(filteredEntities).toHaveLength(2)
    expect(filteredEntities.map(e => e.name).sort()).toEqual(['Available 1', 'Available 2'])
  })
})

// =============================================================================
// BATCH COUNTS AGGREGATION - MULTIPLE NPCS
// =============================================================================

describe('Batch Counts - Multiple NPCs Aggregation', () => {
  it('should aggregate bidirectional counts for multiple NPCs', () => {
    // Create 3 NPCs
    const npc1 = createEntity(npcTypeId, 'NPC 1')
    const npc2 = createEntity(npcTypeId, 'NPC 2')
    const npc3 = createEntity(npcTypeId, 'NPC 3')

    // Create items
    const item1 = createEntity(itemTypeId, 'Item 1')
    const item2 = createEntity(itemTypeId, 'Item 2')
    const item3 = createEntity(itemTypeId, 'Item 3')

    // NPC1 owns item1, item2 references NPC1 (bidirectional = 2 items)
    createRelation(npc1, item1, 'owns')
    createRelation(item2, npc1, 'created_by')

    // NPC2 only owns item3 (1 item)
    createRelation(npc2, item3, 'owns')

    // NPC3 has no items (0 items)

    const _npcIds = [npc1, npc2, npc3]

    // Batch query like npcs/batch-counts.get.ts
    const itemsCounts = db.prepare(`
      SELECT npc_id, COUNT(DISTINCT item_id) as count FROM (
        SELECT er.from_entity_id as npc_id, e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        INNER JOIN entities npc ON npc.id = er.from_entity_id
        WHERE npc.campaign_id = ?
          AND npc.type_id = ?
          AND npc.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT er.to_entity_id as npc_id, e.id as item_id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        INNER JOIN entities npc ON npc.id = er.to_entity_id
        WHERE npc.campaign_id = ?
          AND npc.type_id = ?
          AND npc.deleted_at IS NULL
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      )
      GROUP BY npc_id
    `).all(
      testCampaignId, npcTypeId, itemTypeId,
      testCampaignId, npcTypeId, itemTypeId,
    ) as Array<{ npc_id: number; count: number }>

    // Build count map
    const countMap = new Map(itemsCounts.map(r => [r.npc_id, r.count]))

    expect(countMap.get(npc1)).toBe(2)
    expect(countMap.get(npc2)).toBe(1)
    expect(countMap.get(npc3)).toBeUndefined() // No items, not in result
  })
})
