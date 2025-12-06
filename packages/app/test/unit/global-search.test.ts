import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import { createLevenshtein } from '../../server/utils/levenshtein'
import { normalizeText } from '../../server/utils/normalize'
import type Database from 'better-sqlite3'

// Global Search Tests
// Tests the cross-entity search functionality with Levenshtein matching

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let itemTypeId: number
let locationTypeId: number
let factionTypeId: number
let loreTypeId: number
let playerTypeId: number

const levenshtein = createLevenshtein()

beforeAll(() => {
  db = getDb()

  // Get type IDs
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

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Global Search', 'Test description')
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

// Helper to create entities
function createEntity(typeId: number, name: string, description?: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)')
    .run(typeId, testCampaignId, name, description || null)
  return Number(result.lastInsertRowid)
}

// Helper to create relation
function createRelation(fromId: number, toId: number, relationType: string): void {
  db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
    .run(fromId, toId, relationType)
}

describe('Global Search - Levenshtein Distance', () => {
  it('should calculate Levenshtein distance correctly', () => {
    expect(levenshtein('gandalf', 'gandalf')).toBe(0)
    expect(levenshtein('gandalf', 'gandlf')).toBe(1) // Missing 'a'
    expect(levenshtein('gandalf', 'gandolf')).toBe(1) // Different char
    expect(levenshtein('abc', 'xyz')).toBe(3) // Completely different
    expect(levenshtein('', 'abc')).toBe(3) // Empty to word
    expect(levenshtein('abc', '')).toBe(3) // Word to empty
  })

  it('should normalize text for comparison', () => {
    expect(normalizeText('Gândalf')).toBe('gandalf')
    expect(normalizeText('UPPERCASE')).toBe('uppercase')
    expect(normalizeText('Müller')).toBe('muller')
    expect(normalizeText('André')).toBe('andre')
  })
})

describe('Global Search - Name Matching', () => {
  it('should find entity by exact name', () => {
    createEntity(npcTypeId, 'Gandalf the Grey')

    const allNpcs = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, testCampaignId) as Array<{ name: string }>

    const searchTerm = normalizeText('gandalf')
    const matches = allNpcs.filter(npc => {
      const normalized = normalizeText(npc.name)
      return normalized.includes(searchTerm) || levenshtein(searchTerm, normalized.split(' ')[0]) <= 2
    })

    expect(matches).toHaveLength(1)
  })

  it('should find entity by partial name', () => {
    createEntity(npcTypeId, 'Lord Voldemort')

    const allNpcs = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, testCampaignId) as Array<{ name: string }>

    const searchTerm = normalizeText('volde')
    const matches = allNpcs.filter(npc => normalizeText(npc.name).includes(searchTerm))

    expect(matches).toHaveLength(1)
  })

  it('should find entity with fuzzy matching (typo tolerance)', () => {
    createEntity(npcTypeId, 'Shadowheart')

    const searchTerm = normalizeText('shadowhrat') // Typo
    const allNpcs = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, testCampaignId) as Array<{ name: string }>

    const maxDist = 3
    const matches = allNpcs.filter(npc => {
      const normalized = normalizeText(npc.name)
      return levenshtein(searchTerm, normalized) <= maxDist
    })

    expect(matches).toHaveLength(1)
  })
})

describe('Global Search - Cross-Entity Matching', () => {
  it('should find Location via linked NPC name', () => {
    const locationId = createEntity(locationTypeId, 'The Prancing Pony')
    const npcId = createEntity(npcTypeId, 'Butterbur')

    createRelation(npcId, locationId, 'works_at')

    // Query locations with their linked NPCs
    const result = db
      .prepare(`
        SELECT l.id, l.name,
          (SELECT GROUP_CONCAT(n.name, '|')
           FROM entity_relations r
           JOIN entities n ON n.id = r.from_entity_id AND n.type_id = ?
           WHERE r.to_entity_id = l.id) as linked_npcs
        FROM entities l
        WHERE l.type_id = ?
          AND l.campaign_id = ?
          AND l.deleted_at IS NULL
      `)
      .get(npcTypeId, locationTypeId, testCampaignId) as { id: number; name: string; linked_npcs: string }

    expect(result.name).toBe('The Prancing Pony')
    expect(result.linked_npcs).toBe('Butterbur')

    // Now search for "butterbur" - should find location via cross-entity match
    const searchTerm = normalizeText('butterbur')
    const linkedMatch = result.linked_npcs && normalizeText(result.linked_npcs).includes(searchTerm)
    expect(linkedMatch).toBe(true)
  })

  it('should find Item via linked NPC name (owner)', () => {
    const itemId = createEntity(itemTypeId, 'Sting')
    const npcId = createEntity(npcTypeId, 'Bilbo Baggins')

    createRelation(npcId, itemId, 'owns')

    const result = db
      .prepare(`
        SELECT i.id, i.name,
          (SELECT GROUP_CONCAT(n.name, '|')
           FROM entity_relations r
           JOIN entities n ON n.id = r.from_entity_id AND n.type_id = ?
           WHERE r.to_entity_id = i.id) as linked_npcs
        FROM entities i
        WHERE i.type_id = ?
          AND i.campaign_id = ?
          AND i.deleted_at IS NULL
      `)
      .get(npcTypeId, itemTypeId, testCampaignId) as { name: string; linked_npcs: string }

    expect(result.name).toBe('Sting')
    expect(result.linked_npcs).toBe('Bilbo Baggins')
  })
})

describe('Global Search - Multi-Type Results', () => {
  it('should return results from multiple entity types', () => {
    // Create entities with similar names across types
    createEntity(npcTypeId, 'Dragon Hunter')
    createEntity(itemTypeId, 'Dragon Slayer Sword')
    createEntity(locationTypeId, 'Dragon Cave')
    createEntity(factionTypeId, 'Order of the Dragon')
    createEntity(loreTypeId, 'Legend of the Dragon')

    const searchTerm = normalizeText('dragon')

    const results: Array<{ name: string; type_id: number }> = []

    // Query all entity types
    const allEntities = db
      .prepare('SELECT name, type_id FROM entities WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId) as Array<{ name: string; type_id: number }>

    for (const entity of allEntities) {
      if (normalizeText(entity.name).includes(searchTerm)) {
        results.push(entity)
      }
    }

    expect(results).toHaveLength(5)

    // Check we have all types
    const typeIds = results.map(r => r.type_id)
    expect(typeIds).toContain(npcTypeId)
    expect(typeIds).toContain(itemTypeId)
    expect(typeIds).toContain(locationTypeId)
    expect(typeIds).toContain(factionTypeId)
    expect(typeIds).toContain(loreTypeId)
  })
})

describe('Global Search - Description Matching', () => {
  it('should find entity by description', () => {
    const npcId = createEntity(npcTypeId, 'Mysterious Figure')
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run('A wizard who wields powerful arcane magic', npcId)

    const entity = db
      .prepare('SELECT description FROM entities WHERE id = ?')
      .get(npcId) as { description: string }

    const searchTerm = normalizeText('arcane')
    const descMatch = normalizeText(entity.description).includes(searchTerm)

    expect(descMatch).toBe(true)
  })
})

describe('Global Search - Campaign Isolation', () => {
  it('should only search within the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create entity in test campaign
    createEntity(npcTypeId, 'Unique Name ABC')

    // Create entity in other campaign
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaign2Id, 'Unique Name XYZ')

    // Search in test campaign
    const testCampaignResults = db
      .prepare('SELECT * FROM entities WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId)

    const campaign2Results = db
      .prepare('SELECT * FROM entities WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(campaign2Id)

    expect(testCampaignResults).toHaveLength(1)
    expect((testCampaignResults[0] as { name: string }).name).toBe('Unique Name ABC')

    expect(campaign2Results).toHaveLength(1)
    expect((campaign2Results[0] as { name: string }).name).toBe('Unique Name XYZ')

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Global Search - Score Ranking', () => {
  it('should rank exact matches higher than partial matches', () => {
    createEntity(npcTypeId, 'Gandalf')
    createEntity(npcTypeId, 'Gandalf the Grey')
    createEntity(npcTypeId, 'Grey Wizard')

    const searchTerm = normalizeText('gandalf')

    const allNpcs = db
      .prepare('SELECT name FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, testCampaignId) as Array<{ name: string }>

    // Score results
    const scored = allNpcs.map(npc => {
      const normalized = normalizeText(npc.name)
      let score = 1000

      if (normalized === searchTerm) {
        score -= 500 // Exact match
      } else if (normalized.includes(searchTerm)) {
        score -= 200 // Contains match
      } else if (normalized.split(' ').some(word => levenshtein(searchTerm, word) <= 2)) {
        score -= 100 // Fuzzy match
      }

      return { name: npc.name, score }
    })
      .filter(r => r.score < 1000)
      .sort((a, b) => a.score - b.score)

    expect(scored).toHaveLength(2)
    expect(scored[0].name).toBe('Gandalf') // Exact match first
    expect(scored[1].name).toBe('Gandalf the Grey') // Contains match second
  })
})

describe('Global Search - Soft Delete Exclusion', () => {
  it('should not return soft-deleted entities', () => {
    const npcId = createEntity(npcTypeId, 'Deleted NPC')
    createEntity(npcTypeId, 'Active NPC')

    // Soft-delete one
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(npcId)

    const results = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(npcTypeId, testCampaignId)

    expect(results).toHaveLength(1)
    expect((results[0] as { name: string }).name).toBe('Active NPC')
  })
})
