import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Location Linking Tests - Testing bidirectional NPC and Lore relations
// This tests the API logic for linking entities to locations
let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let locationTypeId: number
let loreTypeId: number

// Type definitions for query results
interface EntityResult {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

interface NameOnlyResult {
  name: string
}

interface IdOnlyResult {
  id: number
}

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as {
    id: number
  }
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as {
    id: number
  }
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as {
    id: number
  }

  npcTypeId = npcType.id
  locationTypeId = locationType.id
  loreTypeId = loreType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign - Locations', 'Location linking tests')
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

describe('Location Linking - NPCs', () => {
  it('should link NPC to Location with relation type', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Taverne zum Goldenen Drachen')
    const locationId = Number(location.lastInsertRowid)

    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Günther der Wirt')
    const npcId = Number(npc.lastInsertRowid)

    // Link NPC to Location (NPC → Location)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, locationId, 'befindet sich in')

    // Query linked NPCs (like /api/locations/[id]/npcs.get.ts)
    const linkedNpcs = db
      .prepare(
        `
      SELECT
        npc.id,
        npc.name,
        npc.description,
        npc.image_url
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      INNER JOIN entity_types nt ON nt.id = npc.type_id
      WHERE er.to_entity_id = ?
        AND nt.name = 'NPC'
        AND npc.deleted_at IS NULL
      ORDER BY npc.name ASC
    `,
      )
      .all(locationId) as EntityResult[]

    expect(linkedNpcs).toHaveLength(1)
    expect(linkedNpcs[0]).toMatchObject({
      id: npcId,
      name: 'Günther der Wirt',
    })
  })

  it('should return multiple NPCs linked to same Location', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Marktplatz')
    const locationId = Number(location.lastInsertRowid)

    // Create 3 NPCs
    const npc1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Händler Anna')
    const npc2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Bettler Bob')
    const npc3 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Wächter Karl')

    // Link all NPCs to location
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc1.lastInsertRowid, locationId, 'arbeitet bei')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc2.lastInsertRowid, locationId, 'befindet sich in')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc3.lastInsertRowid, locationId, 'bewacht')

    // Query linked NPCs
    const linkedNpcs = db
      .prepare(
        `
      SELECT npc.id, npc.name
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      INNER JOIN entity_types nt ON nt.id = npc.type_id
      WHERE er.to_entity_id = ?
        AND nt.name = 'NPC'
        AND npc.deleted_at IS NULL
      ORDER BY npc.name ASC
    `,
      )
      .all(locationId) as EntityResult[]

    expect(linkedNpcs).toHaveLength(3)
    expect(linkedNpcs[0].name).toBe('Bettler Bob')
    expect(linkedNpcs[1].name).toBe('Händler Anna')
    expect(linkedNpcs[2].name).toBe('Wächter Karl')
  })

  it('should NOT return soft-deleted NPCs', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Verlassenes Haus')
    const locationId = Number(location.lastInsertRowid)

    // Create NPC and link it
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Geist Gustav')
    const npcId = Number(npc.lastInsertRowid)

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, locationId, 'spukt in')

    // Soft-delete the NPC
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(npcId)

    // Query should NOT return deleted NPC
    const linkedNpcs = db
      .prepare(
        `
      SELECT npc.id, npc.name
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      INNER JOIN entity_types nt ON nt.id = npc.type_id
      WHERE er.to_entity_id = ?
        AND nt.name = 'NPC'
        AND npc.deleted_at IS NULL
    `,
      )
      .all(locationId) as EntityResult[]

    expect(linkedNpcs).toHaveLength(0)
  })

  it('should find and delete NPC relation via /find endpoint logic', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Bibliothek')
    const locationId = Number(location.lastInsertRowid)

    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Bibliothekar')
    const npcId = Number(npc.lastInsertRowid)

    // Create relation
    const relation = db
      .prepare(
        'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
      )
      .run(npcId, locationId, 'arbeitet bei')
    const relationId = Number(relation.lastInsertRowid)

    // Find relation (like /api/entity-relations/find.get.ts)
    const foundRelation = db
      .prepare(
        `
      SELECT id, from_entity_id, to_entity_id, relation_type
      FROM entity_relations
      WHERE from_entity_id = ? AND to_entity_id = ?
    `,
      )
      .get(npcId, locationId) as {
      id: number
      from_entity_id: number
      to_entity_id: number
      relation_type: string
    } | null

    expect(foundRelation).not.toBeNull()
    expect(foundRelation?.id).toBe(relationId)
    expect(foundRelation?.relation_type).toBe('arbeitet bei')

    // Delete relation
    db.prepare('DELETE FROM entity_relations WHERE id = ?').run(relationId)

    // Verify deleted
    const linkedNpcs = db
      .prepare(
        `
      SELECT npc.id
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE er.to_entity_id = ?
    `,
      )
      .all(locationId) as IdOnlyResult[]

    expect(linkedNpcs).toHaveLength(0)
  })
})

describe('Location Linking - Lore', () => {
  it('should link Lore to Location with relation type', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Ruinen von Eldoria')
    const locationId = Number(location.lastInsertRowid)

    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Die Schlacht von Eldoria', 'Eine epische Schlacht...')
    const loreId = Number(lore.lastInsertRowid)

    // Link Lore to Location (Lore → Location)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, locationId, 'bezieht sich auf')

    // Query linked Lore (like /api/locations/[id]/lore.get.ts)
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
      .all(locationId) as EntityResult[]

    expect(linkedLore).toHaveLength(1)
    expect(linkedLore[0]).toMatchObject({
      id: loreId,
      name: 'Die Schlacht von Eldoria',
      description: 'Eine epische Schlacht...',
    })
  })

  it('should return multiple Lore entries linked to same Location', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Drachenturm')
    const locationId = Number(location.lastInsertRowid)

    // Create 3 Lore entries
    const lore1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Der erste Drache')
    const lore2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Prophezeiung des Turms')
    const lore3 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Verlorene Schätze')

    // Link all Lore to location
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore1.lastInsertRowid, locationId, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore2.lastInsertRowid, locationId, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore3.lastInsertRowid, locationId, 'bezieht sich auf')

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
      .all(locationId) as EntityResult[]

    expect(linkedLore).toHaveLength(3)
    expect(linkedLore[0].name).toBe('Der erste Drache')
    expect(linkedLore[1].name).toBe('Prophezeiung des Turms')
    expect(linkedLore[2].name).toBe('Verlorene Schätze')
  })

  it('should NOT return soft-deleted Lore entries', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Vergessene Bibliothek')
    const locationId = Number(location.lastInsertRowid)

    // Create Lore and link it
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Verbotenes Wissen')
    const loreId = Number(lore.lastInsertRowid)

    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, locationId, 'bezieht sich auf')

    // Soft-delete the Lore
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(loreId)

    // Query should NOT return deleted Lore
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
    `,
      )
      .all(locationId) as EntityResult[]

    expect(linkedLore).toHaveLength(0)
  })

  it('should find and delete Lore relation via /find endpoint logic', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Tempel der Götter')
    const locationId = Number(location.lastInsertRowid)

    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Die drei Götter')
    const loreId = Number(lore.lastInsertRowid)

    // Create relation
    const relation = db
      .prepare(
        'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
      )
      .run(loreId, locationId, 'bezieht sich auf')
    const relationId = Number(relation.lastInsertRowid)

    // Find relation
    const foundRelation = db
      .prepare(
        `
      SELECT id, from_entity_id, to_entity_id, relation_type
      FROM entity_relations
      WHERE from_entity_id = ? AND to_entity_id = ?
    `,
      )
      .get(loreId, locationId) as {
      id: number
      from_entity_id: number
      to_entity_id: number
      relation_type: string
    } | null

    expect(foundRelation).not.toBeNull()
    expect(foundRelation?.id).toBe(relationId)
    expect(foundRelation?.relation_type).toBe('bezieht sich auf')

    // Delete relation
    db.prepare('DELETE FROM entity_relations WHERE id = ?').run(relationId)

    // Verify deleted
    const linkedLore = db
      .prepare(
        `
      SELECT lore.id
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      WHERE er.to_entity_id = ?
    `,
      )
      .all(locationId) as IdOnlyResult[]

    expect(linkedLore).toHaveLength(0)
  })
})

describe('Location Linking - Bidirectionality', () => {
  it('should support bidirectional NPC ↔ Location queries', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Schmied Werkstatt')
    const locationId = Number(location.lastInsertRowid)

    // Create NPC
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Schmied Hans')
    const npcId = Number(npc.lastInsertRowid)

    // Link: NPC → Location
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, locationId, 'arbeitet bei')

    // Query 1: Find NPCs at this Location (Location → NPCs)
    const npcsAtLocation = db
      .prepare(
        `
      SELECT npc.name
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND npc.deleted_at IS NULL
    `,
      )
      .all(locationId) as NameOnlyResult[]

    expect(npcsAtLocation).toHaveLength(1)
    expect(npcsAtLocation[0].name).toBe('Schmied Hans')

    // Query 2: Find Locations for this NPC (NPC → Locations)
    const locationsForNpc = db
      .prepare(
        `
      SELECT loc.name
      FROM entity_relations er
      INNER JOIN entities loc ON loc.id = er.to_entity_id
      WHERE er.from_entity_id = ? AND loc.deleted_at IS NULL
    `,
      )
      .all(npcId) as NameOnlyResult[]

    expect(locationsForNpc).toHaveLength(1)
    expect(locationsForNpc[0].name).toBe('Schmied Werkstatt')
  })

  it('should support bidirectional Lore ↔ Location queries', () => {
    // Create location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Schlachtfeld von Waterdeep')
    const locationId = Number(location.lastInsertRowid)

    // Create Lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Die Schlacht um Waterdeep')
    const loreId = Number(lore.lastInsertRowid)

    // Link: Lore → Location
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(loreId, locationId, 'bezieht sich auf')

    // Query 1: Find Lore about this Location (Location → Lore)
    const loreAtLocation = db
      .prepare(
        `
      SELECT lore.name
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      WHERE er.to_entity_id = ? AND lore.deleted_at IS NULL
    `,
      )
      .all(locationId) as NameOnlyResult[]

    expect(loreAtLocation).toHaveLength(1)
    expect(loreAtLocation[0].name).toBe('Die Schlacht um Waterdeep')

    // Query 2: Find Locations referenced in this Lore (Lore → Locations)
    const locationsInLore = db
      .prepare(
        `
      SELECT loc.name
      FROM entity_relations er
      INNER JOIN entities loc ON loc.id = er.to_entity_id
      WHERE er.from_entity_id = ? AND loc.deleted_at IS NULL
    `,
      )
      .all(loreId) as NameOnlyResult[]

    expect(locationsInLore).toHaveLength(1)
    expect(locationsInLore[0].name).toBe('Schlachtfeld von Waterdeep')
  })
})

describe('Location Linking - Edge Cases', () => {
  it('should handle Location with no linked entities', () => {
    // Create location without any links
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Einsame Insel')
    const locationId = Number(location.lastInsertRowid)

    // Query NPCs
    const linkedNpcs = db
      .prepare(
        `
      SELECT npc.id
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      INNER JOIN entity_types nt ON nt.id = npc.type_id
      WHERE er.to_entity_id = ? AND nt.name = 'NPC'
    `,
      )
      .all(locationId) as IdOnlyResult[]

    // Query Lore
    const linkedLore = db
      .prepare(
        `
      SELECT lore.id
      FROM entity_relations er
      INNER JOIN entities lore ON lore.id = er.from_entity_id
      INNER JOIN entity_types lt ON lt.id = lore.type_id
      WHERE er.to_entity_id = ? AND lt.name = 'Lore'
    `,
      )
      .all(locationId) as IdOnlyResult[]

    expect(linkedNpcs).toHaveLength(0)
    expect(linkedLore).toHaveLength(0)
  })

  it('should prevent duplicate relations (unique constraint)', () => {
    // Create location and NPC
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Taverne')
    const locationId = Number(location.lastInsertRowid)

    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Wirt')
    const npcId = Number(npc.lastInsertRowid)

    // Create first relation
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, locationId, 'arbeitet bei')

    // Try to create duplicate relation (same from, to, type)
    expect(() => {
      db.prepare(
        'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
      ).run(npcId, locationId, 'arbeitet bei')
    }).toThrow() // Should throw UNIQUE constraint violation
  })

  it('should filter by campaign ID when querying linked entities', () => {
    // Create second campaign
    const campaign2 = db
      .prepare('INSERT INTO campaigns (name) VALUES (?)')
      .run('Campaign 2 - Isolation Test')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create locations in both campaigns
    const location1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Taverne Campaign 1')
    const location1Id = Number(location1.lastInsertRowid)

    const _location2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, campaign2Id, 'Taverne Campaign 2')

    // Create NPC in campaign 1
    const npc = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Wirt Hans')
    const npcId = Number(npc.lastInsertRowid)

    // Link NPC to Location 1
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, location1Id, 'arbeitet bei')

    // Query should only return entities from same campaign
    const linkedNpcs = db
      .prepare(
        `
      SELECT npc.id, npc.name
      FROM entity_relations er
      INNER JOIN entities npc ON npc.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND npc.campaign_id = ?
        AND npc.deleted_at IS NULL
    `,
      )
      .all(location1Id, testCampaignId) as EntityResult[]

    expect(linkedNpcs).toHaveLength(1)
    expect(linkedNpcs[0].name).toBe('Wirt Hans')

    // Cleanup
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
  })
})
