import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

/**
 * NPC Counts API Tests
 *
 * Tests the /api/npcs/[id]/counts endpoint logic:
 * - NPC-to-NPC relations (bidirectional)
 * - Items, Locations, Memberships, Lore, Players
 * - Documents and Images
 * - Notes via session_mentions
 * - factionName extraction
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
    .run('Test Campaign - NPC Counts', 'NPC counts API tests')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM session_mentions WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entity_documents WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM session_mentions WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
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

function softDelete(entityId: number): void {
  db.prepare("UPDATE entities SET deleted_at = datetime('now') WHERE id = ?").run(entityId)
}

// =============================================================================
// NPC-TO-NPC RELATIONS (BIDIRECTIONAL)
// =============================================================================

describe('NPC Counts - NPC Relations (Bidirectional)', () => {
  it('should count NPC-to-NPC relations bidirectionally', () => {
    const mainNpc = createEntity(npcTypeId, 'Main NPC')
    const friend = createEntity(npcTypeId, 'Friend NPC')
    const enemy = createEntity(npcTypeId, 'Enemy NPC')
    const mentor = createEntity(npcTypeId, 'Mentor NPC')

    // Main -> Friend (outgoing)
    createRelation(mainNpc, friend, 'friend')
    // Enemy -> Main (incoming)
    createRelation(enemy, mainNpc, 'enemy')
    // Main -> Mentor (outgoing)
    createRelation(mainNpc, mentor, 'student')

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
    `).get(mainNpc, npcTypeId, mainNpc, npcTypeId) as { count: number }

    expect(result.count).toBe(3)
  })

  it('should NOT count soft-deleted NPCs in relations', () => {
    const mainNpc = createEntity(npcTypeId, 'Main NPC')
    const deletedNpc = createEntity(npcTypeId, 'Deleted NPC')

    createRelation(mainNpc, deletedNpc, 'knows')
    softDelete(deletedNpc)

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
    `).get(mainNpc, npcTypeId, mainNpc, npcTypeId) as { count: number }

    expect(result.count).toBe(0)
  })

  it('should not double-count mutual NPC relations', () => {
    const npc1 = createEntity(npcTypeId, 'NPC 1')
    const npc2 = createEntity(npcTypeId, 'NPC 2')

    // Both directions
    createRelation(npc1, npc2, 'friend')
    createRelation(npc2, npc1, 'friend')

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
    `).get(npc1, npcTypeId, npc1, npcTypeId) as { count: number }

    // Should be 1, not 2 (DISTINCT)
    expect(result.count).toBe(1)
  })
})

// =============================================================================
// FACTION NAME EXTRACTION
// =============================================================================

describe('NPC Counts - Faction Name', () => {
  it('should return first faction name for NPC', () => {
    const npcId = createEntity(npcTypeId, 'Guild Member')
    const faction1 = createEntity(factionTypeId, 'Thieves Guild')
    const faction2 = createEntity(factionTypeId, 'Assassins Guild')

    createRelation(npcId, faction1, 'member')
    createRelation(npcId, faction2, 'associate')

    const faction = db.prepare(`
      SELECT e.name
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
      LIMIT 1
    `).get(npcId, factionTypeId) as { name: string } | undefined

    expect(faction).toBeDefined()
    expect(faction?.name).toBe('Thieves Guild')
  })

  it('should return null if NPC has no faction', () => {
    const npcId = createEntity(npcTypeId, 'Lone Wolf')

    const faction = db.prepare(`
      SELECT e.name
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
      LIMIT 1
    `).get(npcId, factionTypeId) as { name: string } | undefined

    expect(faction).toBeUndefined()
  })

  it('should not return deleted faction name', () => {
    const npcId = createEntity(npcTypeId, 'Ex-Member')
    const factionId = createEntity(factionTypeId, 'Disbanded Guild')

    createRelation(npcId, factionId, 'member')
    softDelete(factionId)

    const faction = db.prepare(`
      SELECT e.name
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
      LIMIT 1
    `).get(npcId, factionTypeId) as { name: string } | undefined

    expect(faction).toBeUndefined()
  })
})

// =============================================================================
// NOTES VIA SESSION MENTIONS
// =============================================================================

describe('NPC Counts - Notes via Session Mentions', () => {
  it('should count sessions mentioning NPC', () => {
    const npcId = createEntity(npcTypeId, 'Mentioned NPC')

    // Create 3 sessions mentioning this NPC
    const session1 = db.prepare(
      'INSERT INTO sessions (campaign_id, title, session_number) VALUES (?, ?, ?)'
    ).run(testCampaignId, 'Session 1', 1)
    const session2 = db.prepare(
      'INSERT INTO sessions (campaign_id, title, session_number) VALUES (?, ?, ?)'
    ).run(testCampaignId, 'Session 2', 2)
    const session3 = db.prepare(
      'INSERT INTO sessions (campaign_id, title, session_number) VALUES (?, ?, ?)'
    ).run(testCampaignId, 'Session 3', 3)

    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(Number(session1.lastInsertRowid), npcId)
    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(Number(session2.lastInsertRowid), npcId)
    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(Number(session3.lastInsertRowid), npcId)

    const notesCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM sessions s
      INNER JOIN session_mentions sm ON s.id = sm.session_id
      WHERE sm.entity_id = ?
        AND s.deleted_at IS NULL
    `).get(npcId) as { count: number }

    expect(notesCount.count).toBe(3)
  })

  it('should NOT count deleted sessions in notes', () => {
    const npcId = createEntity(npcTypeId, 'Mentioned NPC')

    const session = db.prepare(
      'INSERT INTO sessions (campaign_id, title, session_number) VALUES (?, ?, ?)'
    ).run(testCampaignId, 'Deleted Session', 1)
    const sessionId = Number(session.lastInsertRowid)

    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(sessionId, npcId)
    db.prepare("UPDATE sessions SET deleted_at = datetime('now') WHERE id = ?").run(sessionId)

    const notesCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM sessions s
      INNER JOIN session_mentions sm ON s.id = sm.session_id
      WHERE sm.entity_id = ?
        AND s.deleted_at IS NULL
    `).get(npcId) as { count: number }

    expect(notesCount.count).toBe(0)
  })
})

// =============================================================================
// PLAYERS (BIDIRECTIONAL)
// =============================================================================

describe('NPC Counts - Players (Bidirectional)', () => {
  it('should count players bidirectionally', () => {
    const npcId = createEntity(npcTypeId, 'Party NPC')
    const player1 = createEntity(playerTypeId, 'Player 1')
    const player2 = createEntity(playerTypeId, 'Player 2')

    // NPC -> Player (outgoing)
    createRelation(npcId, player1, 'knows')
    // Player -> NPC (incoming)
    createRelation(player2, npcId, 'companion')

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
    `).get(npcId, playerTypeId, npcId, playerTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

// =============================================================================
// FULL NPC COUNTS RESPONSE
// =============================================================================

describe('NPC Counts - Full Response', () => {
  it('should return all counts correctly', () => {
    const npcId = createEntity(npcTypeId, 'Full Test NPC')

    // 2 NPC relations (1 outgoing, 1 incoming)
    const friend = createEntity(npcTypeId, 'Friend')
    const enemy = createEntity(npcTypeId, 'Enemy')
    createRelation(npcId, friend, 'friend')
    createRelation(enemy, npcId, 'enemy')

    // 1 Item
    const item = createEntity(itemTypeId, 'Sword')
    createRelation(npcId, item, 'owns')

    // 1 Location
    const location = createEntity(locationTypeId, 'Home')
    createRelation(npcId, location, 'lives_at')

    // 1 Faction (membership)
    const faction = createEntity(factionTypeId, 'Guild')
    createRelation(npcId, faction, 'member')

    // 1 Lore
    const lore = createEntity(loreTypeId, 'Legend')
    createRelation(npcId, lore, 'knows')

    // 1 Player
    const player = createEntity(playerTypeId, 'Hero')
    createRelation(player, npcId, 'ally')

    // 2 Documents
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)')
      .run(npcId, 'Backstory', 'Content', '2025-01-01')
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date, file_type, file_path) VALUES (?, ?, ?, ?, ?, ?)')
      .run(npcId, 'Sheet', '', '2025-01-01', 'pdf', 'sheet.pdf')

    // 1 Image
    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)')
      .run(npcId, 'portrait.png', 1)

    // 1 Session mention
    const session = db.prepare('INSERT INTO sessions (campaign_id, title, session_number) VALUES (?, ?, ?)')
      .run(testCampaignId, 'Session 1', 1)
    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)')
      .run(Number(session.lastInsertRowid), npcId)

    // Query all counts like the API does
    const relations = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count FROM (
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      ) AS e
    `).get(npcId, npcTypeId, npcId, npcTypeId) as { count: number }

    const items = db.prepare(`
      SELECT COUNT(*) as count FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(npcId, itemTypeId) as { count: number }

    const memberships = db.prepare(`
      SELECT COUNT(*) as count FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
    `).get(npcId, factionTypeId) as { count: number }

    const documents = db.prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(npcId) as { count: number }

    const images = db.prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(npcId) as { count: number }

    const notes = db.prepare(`
      SELECT COUNT(*) as count FROM sessions s
      INNER JOIN session_mentions sm ON s.id = sm.session_id
      WHERE sm.entity_id = ? AND s.deleted_at IS NULL
    `).get(npcId) as { count: number }

    const factionName = db.prepare(`
      SELECT e.name FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
      LIMIT 1
    `).get(npcId, factionTypeId) as { name: string } | undefined

    expect(relations.count).toBe(2)
    expect(items.count).toBe(1)
    expect(memberships.count).toBe(1)
    expect(documents.count).toBe(2) // 1 markdown + 1 PDF
    expect(images.count).toBe(1)
    expect(notes.count).toBe(1)
    expect(factionName?.name).toBe('Guild')
  })
})
