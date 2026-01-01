import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

/**
 * Entity Counts Tests
 *
 * Tests the /api/{entity}/[id]/counts endpoint logic for:
 * - Locations
 * - Lore
 * - Items
 *
 * Critical: Ensures bidirectional queries and soft-delete filtering work correctly.
 */

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let itemTypeId: number
let locationTypeId: number
let factionTypeId: number
let loreTypeId: number
let playerTypeId: number

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
  playerTypeId = getTypeId('Player')

  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign - Entity Counts', 'Entity counts API tests')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM entity_documents WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM entity_documents WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
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

function createDocument(entityId: number, title: string): void {
  db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)')
    .run(entityId, title, 'Content', '2025-01-01')
}

function createImage(entityId: number, isPrimary: boolean = false): void {
  db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)')
    .run(entityId, 'test.png', isPrimary ? 1 : 0)
}

function softDelete(entityId: number): void {
  db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?").run(entityId)
}

// =============================================================================
// LOCATION COUNTS
// =============================================================================

describe('Location Counts - NPCs', () => {
  it('should count NPCs at location', () => {
    const locationId = createEntity(locationTypeId, 'Tavern')
    const npc1 = createEntity(npcTypeId, 'Bartender')
    const npc2 = createEntity(npcTypeId, 'Patron')

    createRelation(npc1, locationId, 'works_at')
    createRelation(npc2, locationId, 'visits')

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(locationId, npcTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should NOT count soft-deleted NPCs at location', () => {
    const locationId = createEntity(locationTypeId, 'Tavern')
    const npcId = createEntity(npcTypeId, 'Ghost')

    createRelation(npcId, locationId, 'haunts')
    softDelete(npcId)

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(locationId, npcTypeId) as { count: number }

    expect(result.count).toBe(0)
  })
})

describe('Location Counts - Items (Bidirectional)', () => {
  it('should count items bidirectionally', () => {
    const locationId = createEntity(locationTypeId, 'Dungeon')
    const item1 = createEntity(itemTypeId, 'Treasure Chest')
    const item2 = createEntity(itemTypeId, 'Sword')

    // Location -> Item (outgoing)
    createRelation(locationId, item1, 'contains')
    // Item -> Location (incoming)
    createRelation(item2, locationId, 'hidden_at')

    const result = db.prepare(`
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
    `).get(locationId, itemTypeId, locationId, itemTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('Location Counts - Full Response', () => {
  it('should return all counts correctly', () => {
    const locationId = createEntity(locationTypeId, 'Castle')

    // 2 NPCs
    const npc1 = createEntity(npcTypeId, 'King')
    const npc2 = createEntity(npcTypeId, 'Guard')
    createRelation(npc1, locationId, 'rules')
    createRelation(npc2, locationId, 'guards')

    // 1 Item (bidirectional test)
    const item = createEntity(itemTypeId, 'Crown')
    createRelation(locationId, item, 'contains')

    // 1 Lore
    const lore = createEntity(loreTypeId, 'Castle History')
    createRelation(lore, locationId, 'describes')

    // 1 Player
    const player = createEntity(playerTypeId, 'Hero')
    createRelation(player, locationId, 'explored')

    // 2 Documents
    createDocument(locationId, 'Map')
    createDocument(locationId, 'Notes')

    // 1 Image
    createImage(locationId, true)

    // Verify counts
    const npcs = db.prepare(`
      SELECT COUNT(*) as count FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(locationId, npcTypeId) as { count: number }

    const items = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(locationId, itemTypeId, locationId, itemTypeId) as { count: number }

    const loreCount = db.prepare(`
      SELECT COUNT(*) as count FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(locationId, loreTypeId) as { count: number }

    const documents = db.prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(locationId) as { count: number }

    const images = db.prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(locationId) as { count: number }

    expect(npcs.count).toBe(2)
    expect(items.count).toBe(1)
    expect(loreCount.count).toBe(1)
    expect(documents.count).toBe(2)
    expect(images.count).toBe(1)
  })
})

// =============================================================================
// LORE COUNTS
// =============================================================================

describe('Lore Counts - NPCs (Bidirectional)', () => {
  it('should count NPCs bidirectionally', () => {
    const loreId = createEntity(loreTypeId, 'Ancient Prophecy')
    const npc1 = createEntity(npcTypeId, 'Prophet')
    const npc2 = createEntity(npcTypeId, 'Scholar')

    // NPC -> Lore (incoming)
    createRelation(npc1, loreId, 'foretold')
    // Lore -> NPC (outgoing)
    createRelation(loreId, npc2, 'mentions')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(loreId, npcTypeId, loreId, npcTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('Lore Counts - All Entity Types', () => {
  it('should count all related entity types bidirectionally', () => {
    const loreId = createEntity(loreTypeId, 'World History')

    // NPCs
    const npc = createEntity(npcTypeId, 'Historian')
    createRelation(npc, loreId, 'knows')

    // Items
    const item = createEntity(itemTypeId, 'Ancient Tome')
    createRelation(loreId, item, 'documented_in')

    // Factions
    const faction = createEntity(factionTypeId, 'Scholars Guild')
    createRelation(faction, loreId, 'preserves')

    // Locations
    const location = createEntity(locationTypeId, 'Library')
    createRelation(loreId, location, 'stored_at')

    // Players
    const player = createEntity(playerTypeId, 'Seeker')
    createRelation(player, loreId, 'discovered')

    // Documents and Images
    createDocument(loreId, 'Summary')
    createImage(loreId)

    // Query like the API does
    const npcs = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(loreId, npcTypeId, loreId, npcTypeId) as { count: number }

    const items = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(loreId, itemTypeId, loreId, itemTypeId) as { count: number }

    const factions = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(loreId, factionTypeId, loreId, factionTypeId) as { count: number }

    expect(npcs.count).toBe(1)
    expect(items.count).toBe(1)
    expect(factions.count).toBe(1)
  })
})

// =============================================================================
// ITEM COUNTS
// =============================================================================

describe('Item Counts - Owners (NPCs)', () => {
  it('should count NPC owners', () => {
    const itemId = createEntity(itemTypeId, 'Magic Sword')
    const npc1 = createEntity(npcTypeId, 'Warrior')
    const npc2 = createEntity(npcTypeId, 'Blacksmith')

    // NPCs own/created the item
    createRelation(npc1, itemId, 'wields')
    createRelation(npc2, itemId, 'forged')

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(itemId, npcTypeId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should NOT count soft-deleted owners', () => {
    const itemId = createEntity(itemTypeId, 'Cursed Ring')
    const npcId = createEntity(npcTypeId, 'Dead Owner')

    createRelation(npcId, itemId, 'owned')
    softDelete(npcId)

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(itemId, npcTypeId) as { count: number }

    expect(result.count).toBe(0)
  })
})

describe('Item Counts - Factions (Bidirectional)', () => {
  it('should count factions bidirectionally', () => {
    const itemId = createEntity(itemTypeId, 'Guild Seal')
    const faction1 = createEntity(factionTypeId, 'Merchants Guild')
    const faction2 = createEntity(factionTypeId, 'Thieves Guild')

    // Item -> Faction (outgoing)
    createRelation(itemId, faction1, 'belongs_to')
    // Faction -> Item (incoming)
    createRelation(faction2, itemId, 'seeks')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(itemId, factionTypeId, itemId, factionTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('Item Counts - Full Response', () => {
  it('should return all counts correctly', () => {
    const itemId = createEntity(itemTypeId, 'Legendary Artifact')

    // 2 Owners (NPCs)
    const npc1 = createEntity(npcTypeId, 'Hero')
    const npc2 = createEntity(npcTypeId, 'Villain')
    createRelation(npc1, itemId, 'wields')
    createRelation(npc2, itemId, 'seeks')

    // 1 Location
    const location = createEntity(locationTypeId, 'Temple')
    createRelation(location, itemId, 'houses')

    // 1 Lore
    const lore = createEntity(loreTypeId, 'Artifact Legend')
    createRelation(itemId, lore, 'described_in')

    // 1 Faction
    const faction = createEntity(factionTypeId, 'Guardians')
    createRelation(faction, itemId, 'protects')

    // 1 Player
    const player = createEntity(playerTypeId, 'Adventurer')
    createRelation(player, itemId, 'found')

    // Documents and Images
    createDocument(itemId, 'Description')
    createImage(itemId, true)
    createImage(itemId, false)

    const owners = db.prepare(`
      SELECT COUNT(*) as count FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(itemId, npcTypeId) as { count: number }

    const loreCount = db.prepare(`
      SELECT COUNT(*) as count FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(itemId, loreTypeId) as { count: number }

    const factions = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(itemId, factionTypeId, itemId, factionTypeId) as { count: number }

    const documents = db.prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(itemId) as { count: number }

    const images = db.prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(itemId) as { count: number }

    expect(owners.count).toBe(2)
    expect(loreCount.count).toBe(1)
    expect(factions.count).toBe(1)
    expect(documents.count).toBe(1)
    expect(images.count).toBe(2)
  })
})

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Entity Counts - Edge Cases', () => {
  it('should return 0 for entity with no relations', () => {
    const itemId = createEntity(itemTypeId, 'Lonely Item')

    const owners = db.prepare(`
      SELECT COUNT(*) as count FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(itemId, npcTypeId) as { count: number }

    expect(owners.count).toBe(0)
  })

  it('should not double-count with bidirectional relations to same entity', () => {
    const loreId = createEntity(loreTypeId, 'Mutual Knowledge')
    const npcId = createEntity(npcTypeId, 'Scholar')

    // Both directions to same NPC
    createRelation(npcId, loreId, 'knows')
    createRelation(loreId, npcId, 'mentions')

    const result = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(loreId, npcTypeId, loreId, npcTypeId) as { count: number }

    // Should be 1, not 2 (DISTINCT)
    expect(result.count).toBe(1)
  })

  it('should count PDF documents same as markdown documents', () => {
    const itemId = createEntity(itemTypeId, 'Documented Item')

    // Markdown document
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)')
      .run(itemId, 'Notes', 'Some notes', '2025-01-01')

    // PDF document
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date, file_type, file_path) VALUES (?, ?, ?, ?, ?, ?)')
      .run(itemId, 'Manual', '', '2025-01-01', 'pdf', 'manual.pdf')

    const documents = db.prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(itemId) as { count: number }

    expect(documents.count).toBe(2)
  })
})
