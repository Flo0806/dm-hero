import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getTestDb } from '../utils/test-db'

describe('Player Counts', () => {
  let db: ReturnType<typeof getTestDb>
  let testPlayerId: number
  let testCampaignId: number
  let playerTypeId: number
  let npcTypeId: number
  let itemTypeId: number

  beforeEach(async () => {
    db = getTestDb()

    // Get campaign ID
    const campaign = db.prepare('SELECT id FROM campaigns LIMIT 1').get() as { id: number }
    testCampaignId = campaign.id

    // Get entity type IDs
    playerTypeId = (db.prepare("SELECT id FROM entity_types WHERE name = 'Player'").get() as { id: number }).id
    npcTypeId = (db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as { id: number }).id
    itemTypeId = (db.prepare("SELECT id FROM entity_types WHERE name = 'Item'").get() as { id: number }).id

    // Create test player
    const result = db
      .prepare(
        `INSERT INTO entities (campaign_id, type_id, name, description)
         VALUES (?, ?, ?, ?)`,
      )
      .run(testCampaignId, playerTypeId, 'Test Player', 'Test player description')

    testPlayerId = result.lastInsertRowid as number
  })

  afterEach(() => {
    // Clean up relations
    db.prepare('DELETE FROM entity_relations WHERE from_entity_id = ? OR to_entity_id = ?').run(
      testPlayerId,
      testPlayerId,
    )
    // Clean up images
    db.prepare('DELETE FROM entity_images WHERE entity_id = ?').run(testPlayerId)
    // Clean up documents
    db.prepare('DELETE FROM entity_documents WHERE entity_id = ?').run(testPlayerId)
    // Clean up test entities
    db.prepare('DELETE FROM entities WHERE id = ?').run(testPlayerId)
  })

  describe('API /api/players/:id/counts', () => {
    it('should return zero counts for player with no relations', () => {
      // Simulate what the counts API does
      const counts = getPlayerCounts(testPlayerId)

      expect(counts.characters).toBe(0)
      expect(counts.items).toBe(0)
      expect(counts.locations).toBe(0)
      expect(counts.factions).toBe(0)
      expect(counts.lore).toBe(0)
      expect(counts.documents).toBe(0)
      expect(counts.images).toBe(0)
    })

    it('should count linked NPCs as characters', () => {
      // Create test NPC
      const npcResult = db
        .prepare(
          `INSERT INTO entities (campaign_id, type_id, name)
           VALUES (?, ?, ?)`,
        )
        .run(testCampaignId, npcTypeId, 'Test NPC Character')
      const npcId = npcResult.lastInsertRowid as number

      // Link NPC to Player
      db.prepare(
        `INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type)
         VALUES (?, ?, ?)`,
      ).run(testPlayerId, npcId, 'plays')

      const counts = getPlayerCounts(testPlayerId)
      expect(counts.characters).toBe(1)

      // Cleanup
      db.prepare('DELETE FROM entities WHERE id = ?').run(npcId)
    })

    it('should count linked items', () => {
      // Create test Items
      const item1 = db
        .prepare(
          `INSERT INTO entities (campaign_id, type_id, name)
           VALUES (?, ?, ?)`,
        )
        .run(testCampaignId, itemTypeId, 'Test Sword')
      const item2 = db
        .prepare(
          `INSERT INTO entities (campaign_id, type_id, name)
           VALUES (?, ?, ?)`,
        )
        .run(testCampaignId, itemTypeId, 'Test Shield')

      // Link items to Player
      db.prepare(
        `INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type)
         VALUES (?, ?, ?)`,
      ).run(testPlayerId, item1.lastInsertRowid, 'owns')
      db.prepare(
        `INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type)
         VALUES (?, ?, ?)`,
      ).run(testPlayerId, item2.lastInsertRowid, 'owns')

      const counts = getPlayerCounts(testPlayerId)
      expect(counts.items).toBe(2)

      // Cleanup
      db.prepare('DELETE FROM entities WHERE id = ?').run(item1.lastInsertRowid)
      db.prepare('DELETE FROM entities WHERE id = ?').run(item2.lastInsertRowid)
    })

    it('should count documents', () => {
      // Add documents (entity_documents uses sort_order, not display_order, and requires date)
      db.prepare(
        `INSERT INTO entity_documents (entity_id, title, content, date, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerId, 'Document 1', 'Content 1', '2024-01-01', 0)
      db.prepare(
        `INSERT INTO entity_documents (entity_id, title, content, date, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerId, 'Document 2', 'Content 2', '2024-01-02', 1)

      const counts = getPlayerCounts(testPlayerId)
      expect(counts.documents).toBe(2)
    })

    it('should count images', () => {
      // Add images
      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, ?, ?)`,
      ).run(testPlayerId, 'image1.png', 1, 0)
      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, ?, ?)`,
      ).run(testPlayerId, 'image2.png', 0, 1)
      db.prepare(
        `INSERT INTO entity_images (entity_id, image_url, is_primary, display_order)
         VALUES (?, ?, ?, ?)`,
      ).run(testPlayerId, 'image3.png', 0, 2)

      const counts = getPlayerCounts(testPlayerId)
      expect(counts.images).toBe(3)
    })

    it('should update counts when relations change', () => {
      // Initial count
      let counts = getPlayerCounts(testPlayerId)
      expect(counts.items).toBe(0)

      // Add item relation
      const itemResult = db
        .prepare(
          `INSERT INTO entities (campaign_id, type_id, name)
           VALUES (?, ?, ?)`,
        )
        .run(testCampaignId, itemTypeId, 'New Item')
      const itemId = itemResult.lastInsertRowid as number

      const relationResult = db
        .prepare(
          `INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type)
           VALUES (?, ?, ?)`,
        )
        .run(testPlayerId, itemId, 'owns')

      // Count should increase
      counts = getPlayerCounts(testPlayerId)
      expect(counts.items).toBe(1)

      // Remove relation
      db.prepare('DELETE FROM entity_relations WHERE id = ?').run(relationResult.lastInsertRowid)

      // Count should decrease
      counts = getPlayerCounts(testPlayerId)
      expect(counts.items).toBe(0)

      // Cleanup
      db.prepare('DELETE FROM entities WHERE id = ?').run(itemId)
    })
  })

  // Helper function that simulates the counts API logic
  function getPlayerCounts(playerId: number) {
    const entityTypes = db.prepare('SELECT id, name FROM entity_types').all() as Array<{
      id: number
      name: string
    }>

    const typeMap = new Map(entityTypes.map(t => [t.name, t.id]))

    // Count characters (NPCs linked to this player)
    const characters = db
      .prepare(
        `SELECT COUNT(DISTINCT e.id) as count
         FROM entities e
         JOIN entity_relations er ON (er.to_entity_id = e.id OR er.from_entity_id = e.id)
         WHERE e.type_id = ?
         AND e.deleted_at IS NULL
         AND (er.from_entity_id = ? OR er.to_entity_id = ?)
         AND e.id != ?`,
      )
      .get(typeMap.get('NPC'), playerId, playerId, playerId) as { count: number }

    // Count items
    const items = db
      .prepare(
        `SELECT COUNT(DISTINCT e.id) as count
         FROM entities e
         JOIN entity_relations er ON (er.to_entity_id = e.id OR er.from_entity_id = e.id)
         WHERE e.type_id = ?
         AND e.deleted_at IS NULL
         AND (er.from_entity_id = ? OR er.to_entity_id = ?)
         AND e.id != ?`,
      )
      .get(typeMap.get('Item'), playerId, playerId, playerId) as { count: number }

    // Count locations
    const locations = db
      .prepare(
        `SELECT COUNT(DISTINCT e.id) as count
         FROM entities e
         JOIN entity_relations er ON (er.to_entity_id = e.id OR er.from_entity_id = e.id)
         WHERE e.type_id = ?
         AND e.deleted_at IS NULL
         AND (er.from_entity_id = ? OR er.to_entity_id = ?)
         AND e.id != ?`,
      )
      .get(typeMap.get('Location'), playerId, playerId, playerId) as { count: number }

    // Count factions
    const factions = db
      .prepare(
        `SELECT COUNT(DISTINCT e.id) as count
         FROM entities e
         JOIN entity_relations er ON (er.to_entity_id = e.id OR er.from_entity_id = e.id)
         WHERE e.type_id = ?
         AND e.deleted_at IS NULL
         AND (er.from_entity_id = ? OR er.to_entity_id = ?)
         AND e.id != ?`,
      )
      .get(typeMap.get('Faction'), playerId, playerId, playerId) as { count: number }

    // Count lore
    const lore = db
      .prepare(
        `SELECT COUNT(DISTINCT e.id) as count
         FROM entities e
         JOIN entity_relations er ON (er.to_entity_id = e.id OR er.from_entity_id = e.id)
         WHERE e.type_id = ?
         AND e.deleted_at IS NULL
         AND (er.from_entity_id = ? OR er.to_entity_id = ?)
         AND e.id != ?`,
      )
      .get(typeMap.get('Lore'), playerId, playerId, playerId) as { count: number }

    // Count documents
    const documents = db
      .prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(playerId) as { count: number }

    // Count images
    const images = db
      .prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(playerId) as { count: number }

    return {
      characters: characters.count,
      items: items.count,
      locations: locations.count,
      factions: factions.count,
      lore: lore.count,
      documents: documents.count,
      images: images.count,
      sessions: 0, // Sessions counted separately
    }
  }
})
