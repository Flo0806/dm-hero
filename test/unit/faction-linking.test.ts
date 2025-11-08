import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Faction Linking Tests - Testing bidirectional Lore relations and cross-search
// This tests the API logic for linking Lore to Factions and searching Factions via Lore names
let db: Database.Database
let testCampaignId: number
let factionTypeId: number
let loreTypeId: number

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const factionType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as {
    id: number
  }
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as {
    id: number
  }

  factionTypeId = factionType.id
  loreTypeId = loreType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign - Factions', 'Faction linking tests')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  // Clean up test data
  if (db) {
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up entities before each test
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  db.prepare(
    'DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)',
  ).run(testCampaignId)
  db.prepare(
    'DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)',
  ).run(testCampaignId)
})

describe('Faction Linking - Lore', () => {
  it('should link Lore to Faction with relation type', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Link Lore to Faction (Lore → Faction)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, factionId, 'bezieht sich auf')

    // Query linked Lore (like /api/factions/[id]/lore.get.ts)
    const linkedLore = db
      .prepare(
        `
      SELECT
        lore.id,
        lore.name,
        lore.description,
        lore.image_url
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      INNER JOIN entity_types lt ON lt.id = lore.type_id
      WHERE er.to_entity_id = ?
        AND lt.name = 'Lore'
        AND lore.deleted_at IS NULL
      ORDER BY lore.name ASC
    `,
      )
      .all(factionId)

    expect(linkedLore).toHaveLength(1)
    expect(linkedLore[0]).toMatchObject({
      id: loreId,
      name: 'Böser Frosch',
    })
  })

  it('should return multiple Lore entries linked to same Faction', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create multiple lore entries
    const lore1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const lore1Id = Number(lore1.lastInsertRowid)

    const lore2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Der Ring der Macht')
    const lore2Id = Number(lore2.lastInsertRowid)

    // Link both Lore entries to Faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore1Id, factionId, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore2Id, factionId, 'bezieht sich auf')

    // Query linked Lore
    const linkedLore = db
      .prepare(
        `
      SELECT lore.id, lore.name
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      INNER JOIN entity_types lt ON lt.id = lore.type_id
      WHERE er.to_entity_id = ?
        AND lt.name = 'Lore'
        AND lore.deleted_at IS NULL
      ORDER BY lore.name ASC
    `,
      )
      .all(factionId)

    expect(linkedLore).toHaveLength(2)
    expect(linkedLore[0].name).toBe('Böser Frosch')
    expect(linkedLore[1].name).toBe('Der Ring der Macht')
  })

  it('should NOT return soft-deleted Lore entries', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create lore and soft-delete it
    const lore = db
      .prepare(
        "INSERT INTO entities (type_id, campaign_id, name, deleted_at) VALUES (?, ?, ?, datetime('now'))",
      )
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Link deleted Lore to Faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, factionId, 'bezieht sich auf')

    // Query linked Lore
    const linkedLore = db
      .prepare(
        `
      SELECT lore.id
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      INNER JOIN entity_types lt ON lt.id = lore.type_id
      WHERE er.to_entity_id = ?
        AND lt.name = 'Lore'
        AND lore.deleted_at IS NULL
    `,
      )
      .all(factionId)

    expect(linkedLore).toHaveLength(0)
  })

  it('should find and delete Lore relation via /find endpoint logic', () => {
    // Create faction and lore
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Create relation
    const relation = db
      .prepare(
        'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
      )
      .run(loreId, factionId, 'bezieht sich auf')
    const relationId = Number(relation.lastInsertRowid)

    // Find relation (like /api/entity-relations/find)
    const foundRelation = db
      .prepare(
        `
      SELECT id FROM entity_relations
      WHERE from_entity_id = ? AND to_entity_id = ?
    `,
      )
      .get(loreId, factionId) as { id: number } | undefined

    expect(foundRelation).toBeDefined()
    expect(foundRelation?.id).toBe(relationId)

    // Delete relation
    db.prepare('DELETE FROM entity_relations WHERE id = ?').run(foundRelation!.id)

    // Verify deletion
    const linkedLore = db
      .prepare(
        `
      SELECT lore.id
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      WHERE er.to_entity_id = ?
    `,
      )
      .all(factionId)

    expect(linkedLore).toHaveLength(0)
  })
})

describe('Faction Linking - Bidirectionality', () => {
  it('should support bidirectional Lore ↔ Faction queries', () => {
    // Create faction and lore
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Link Lore to Faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, factionId, 'bezieht sich auf')

    // Query 1: Faction → Lore (from Faction's perspective)
    const loreFromFaction = db
      .prepare(
        `
      SELECT lore.id, lore.name
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      INNER JOIN entity_types lt ON lt.id = lore.type_id
      WHERE er.to_entity_id = ? AND lt.name = 'Lore'
    `,
      )
      .all(factionId)

    // Query 2: Lore → Factions (from Lore's perspective, like /api/lore/[id]/factions.get.ts)
    const factionsFromLore = db
      .prepare(
        `
      SELECT faction.id, faction.name
      FROM entity_relations er
      INNER JOIN entities faction ON faction.id = er.to_entity_id
      INNER JOIN entity_types ft ON ft.id = faction.type_id
      WHERE er.from_entity_id = ? AND ft.name = 'Faction'
    `,
      )
      .all(loreId)

    expect(loreFromFaction).toHaveLength(1)
    expect(factionsFromLore).toHaveLength(1)
    expect(loreFromFaction[0].name).toBe('Böser Frosch')
    expect(factionsFromLore[0].name).toBe('Die Harpers')
  })
})

describe('Faction Cross-Search via Lore', () => {
  it('should find Faction by linked Lore name via GROUP_CONCAT', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create lore with specific name
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Link Lore to Faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, factionId, 'bezieht sich auf')

    // Query Faction with GROUP_CONCAT for Lore names (like /api/factions/index.get.ts with search)
    const factions = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
      LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id
        AND lore.type_id = ? AND lore.deleted_at IS NULL
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(loreTypeId, factionTypeId, testCampaignId)

    expect(factions).toHaveLength(1)
    expect(factions[0]).toMatchObject({
      id: factionId,
      name: 'Die Harpers',
      linked_lore_names: 'Böser Frosch',
    })
  })

  it('should find Faction when searching for linked Lore name (substring match)', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const loreId = Number(lore.lastInsertRowid)

    // Link Lore to Faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, factionId, 'bezieht sich auf')

    // Query Faction with Lore cross-search
    const factions = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
      LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id
        AND lore.type_id = ? AND lore.deleted_at IS NULL
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(loreTypeId, factionTypeId, testCampaignId)

    // Simulate search: check if "frosch" is in linked_lore_names
    const searchTerm = 'frosch'
    const matchingFactions = factions.filter((f) => {
      const loreNamesLower = (f.linked_lore_names as string || '').toLowerCase()
      return loreNamesLower.includes(searchTerm.toLowerCase())
    })

    expect(matchingFactions).toHaveLength(1)
    expect(matchingFactions[0].name).toBe('Die Harpers')
  })

  it('should handle multiple Lore entries in GROUP_CONCAT', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create multiple lore entries
    const lore1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const lore1Id = Number(lore1.lastInsertRowid)

    const lore2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Der Ring der Macht')
    const lore2Id = Number(lore2.lastInsertRowid)

    // Link both to Faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore1Id, factionId, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore2Id, factionId, 'bezieht sich auf')

    // Query Faction with GROUP_CONCAT
    const factions = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
      LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id
        AND lore.type_id = ? AND lore.deleted_at IS NULL
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(loreTypeId, factionTypeId, testCampaignId)

    expect(factions).toHaveLength(1)
    // GROUP_CONCAT creates comma-separated list
    const loreNames = (factions[0].linked_lore_names as string).split(',')
    expect(loreNames).toHaveLength(2)
    expect(loreNames).toContain('Böser Frosch')
    expect(loreNames).toContain('Der Ring der Macht')
  })

  it('should NOT return Factions when searching for unlinked Lore name', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const _factionId = Number(faction.lastInsertRowid)

    // Create lore but DON'T link it
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')

    // Query Faction with Lore cross-search
    const factions = db
      .prepare(
        `
      SELECT
        e.id,
        e.name,
        GROUP_CONCAT(DISTINCT lore.name) as linked_lore_names
      FROM entities e
      LEFT JOIN entity_relations lore_rel ON lore_rel.to_entity_id = e.id
      LEFT JOIN entities lore ON lore.id = lore_rel.from_entity_id
        AND lore.type_id = ? AND lore.deleted_at IS NULL
      WHERE e.type_id = ? AND e.campaign_id = ? AND e.deleted_at IS NULL
      GROUP BY e.id
    `,
      )
      .all(loreTypeId, factionTypeId, testCampaignId)

    expect(factions).toHaveLength(1)
    expect(factions[0].linked_lore_names).toBeNull() // No linked Lore
  })
})
