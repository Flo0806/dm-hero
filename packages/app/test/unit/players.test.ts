import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Players CRUD Tests
// Tests the Player entity operations

let db: Database.Database
let testCampaignId: number
let playerTypeId: number
let npcTypeId: number
let itemTypeId: number

beforeAll(() => {
  db = getDb()

  // Get type IDs
  const playerType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as { id: number }
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number }
  playerTypeId = playerType.id
  npcTypeId = npcType.id
  itemTypeId = itemType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Players', 'Test description')
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

// Helper to create a Player
function createPlayer(name: string, options?: {
  description?: string
  imageUrl?: string
  metadata?: Record<string, unknown>
}): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description, image_url, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      playerTypeId,
      testCampaignId,
      name,
      options?.description || null,
      options?.imageUrl || null,
      options?.metadata ? JSON.stringify(options.metadata) : null
    )
  return Number(result.lastInsertRowid)
}

// Helper to create an NPC (for character linking)
function createNpc(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

// Helper to create an Item
function createItem(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(itemTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

describe('Players - Basic CRUD', () => {
  it('should create a player', () => {
    const playerId = createPlayer('John Doe')

    const player = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(playerId) as { id: number; name: string; type_id: number }

    expect(player).toBeDefined()
    expect(player.name).toBe('John Doe')
    expect(player.type_id).toBe(playerTypeId)
  })

  it('should create a player with all fields', () => {
    const playerId = createPlayer('Jane Smith', {
      description: 'Experienced player, loves roleplay',
      imageUrl: 'jane.jpg',
      metadata: {
        email: 'jane@example.com',
        discord: 'jane#1234',
        preferredRole: 'healer'
      }
    })

    const player = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(playerId) as {
        name: string
        description: string
        image_url: string
        metadata: string
      }

    expect(player.name).toBe('Jane Smith')
    expect(player.description).toBe('Experienced player, loves roleplay')
    expect(player.image_url).toBe('jane.jpg')

    const metadata = JSON.parse(player.metadata)
    expect(metadata.email).toBe('jane@example.com')
    expect(metadata.discord).toBe('jane#1234')
  })

  it('should update a player', () => {
    const playerId = createPlayer('Old Name')

    db.prepare('UPDATE entities SET name = ?, description = ? WHERE id = ?')
      .run('New Name', 'Updated bio', playerId)

    const player = db
      .prepare('SELECT name, description FROM entities WHERE id = ?')
      .get(playerId) as { name: string; description: string }

    expect(player.name).toBe('New Name')
    expect(player.description).toBe('Updated bio')
  })

  it('should soft-delete a player', () => {
    const playerId = createPlayer('To Delete')

    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(playerId)

    const player = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(playerId) as { deleted_at: string | null }

    expect(player.deleted_at).not.toBeNull()
  })

  it('should not return soft-deleted players in normal queries', () => {
    const playerId = createPlayer('Deleted Player')
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(playerId)

    const players = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(playerTypeId, testCampaignId)

    expect(players).toHaveLength(0)
  })
})

describe('Players - Character Relations (Player-NPC)', () => {
  it('should link player to character (NPC)', () => {
    const playerId = createPlayer('Player 1')
    const characterId = createNpc('Aragorn')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(playerId, characterId, 'plays')

    const characters = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(playerId, npcTypeId)

    expect(characters).toHaveLength(1)
    expect((characters[0] as { name: string }).name).toBe('Aragorn')
  })

  it('should support multiple characters per player', () => {
    const playerId = createPlayer('Multi-Character Player')
    const char1 = createNpc('Character 1')
    const char2 = createNpc('Character 2')
    const char3 = createNpc('Character 3 (retired)')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(playerId, char1, 'plays')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(playerId, char2, 'plays')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(playerId, char3, 'played')

    const allCharacters = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
      `)
      .all(playerId, npcTypeId) as Array<{ name: string; relation_type: string }>

    expect(allCharacters).toHaveLength(3)

    const activeCharacters = allCharacters.filter(c => c.relation_type === 'plays')
    expect(activeCharacters).toHaveLength(2)
  })

  it('should find which player plays a character', () => {
    const player1 = createPlayer('Player A')
    const player2 = createPlayer('Player B')
    const character = createNpc('Shared World Character')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(player1, character, 'plays')

    const playerOfCharacter = db
      .prepare(`
        SELECT e.name
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND er.relation_type = ?
      `)
      .get(character, playerTypeId, 'plays') as { name: string }

    expect(playerOfCharacter.name).toBe('Player A')
  })
})

describe('Players - Item Relations', () => {
  it('should link player to items', () => {
    const playerId = createPlayer('Item Collector')
    const item1 = createItem('Magic Sword')
    const item2 = createItem('Healing Potion')

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(playerId, item1, 'owns')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(playerId, item2, 'owns')

    const items = db
      .prepare(`
        SELECT e.name
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
      `)
      .all(playerId, itemTypeId)

    expect(items).toHaveLength(2)
  })
})

describe('Players - Session Attendance', () => {
  it('should track player session attendance', () => {
    const playerId = createPlayer('Regular Attendee')

    // Create a session
    const session = db
      .prepare('INSERT INTO sessions (campaign_id, title) VALUES (?, ?)')
      .run(testCampaignId, 'Test Session')

    // Add attendance
    db.prepare('INSERT INTO session_attendance (session_id, player_id) VALUES (?, ?)')
      .run(session.lastInsertRowid, playerId)

    const attendance = db
      .prepare('SELECT * FROM session_attendance WHERE player_id = ?')
      .all(playerId)

    expect(attendance).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM session_attendance WHERE player_id = ?').run(playerId)
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
  })

  it('should count sessions attended by player', () => {
    const playerId = createPlayer('Frequent Player')

    // Create multiple sessions
    for (let i = 0; i < 5; i++) {
      const session = db
        .prepare('INSERT INTO sessions (campaign_id, title) VALUES (?, ?)')
        .run(testCampaignId, `Session ${i}`)
      db.prepare('INSERT INTO session_attendance (session_id, player_id) VALUES (?, ?)')
        .run(session.lastInsertRowid, playerId)
    }

    const count = db
      .prepare('SELECT COUNT(*) as count FROM session_attendance WHERE player_id = ?')
      .get(playerId) as { count: number }

    expect(count.count).toBe(5)

    // Cleanup
    db.prepare('DELETE FROM session_attendance WHERE player_id = ?').run(playerId)
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
  })
})

describe('Players - FTS5 Search', () => {
  it('should find player by name', () => {
    createPlayer('Alexander the Great')
    createPlayer('Bob Smith')

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
      .all('alexander*', playerTypeId, testCampaignId)

    expect(results).toHaveLength(1)
    expect((results[0] as { name: string }).name).toBe('Alexander the Great')
  })

  it('should find player by description', () => {
    const playerId = createPlayer('Mystery Player')
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run('The sneaky rogue player who always backstabs', playerId)

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
      .all('sneaky*', playerTypeId, testCampaignId)

    expect(results).toHaveLength(1)
  })
})

describe('Players - Campaign Isolation', () => {
  it('should only return players from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create players in both campaigns
    createPlayer('Player in Test Campaign')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(playerTypeId, campaign2Id, 'Player in Campaign 2')

    const testCampaignPlayers = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(playerTypeId, testCampaignId)

    const campaign2Players = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(playerTypeId, campaign2Id)

    expect(testCampaignPlayers).toHaveLength(1)
    expect(campaign2Players).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})
