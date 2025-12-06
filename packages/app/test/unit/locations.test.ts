import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Locations API Tests
// Tests the location-specific functionality including hierarchical structure

let db: Database.Database
let testCampaignId: number
let locationTypeId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }

  locationTypeId = locationType.id
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Locations', 'Test description')
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

// Helper to create a location
function createLocation(name: string, parentId?: number, metadata?: Record<string, unknown>): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, parent_entity_id, metadata) VALUES (?, ?, ?, ?, ?)')
    .run(locationTypeId, testCampaignId, name, parentId || null, metadata ? JSON.stringify(metadata) : null)
  return Number(result.lastInsertRowid)
}

describe('Locations - Basic CRUD', () => {
  it('should create a location', () => {
    const locationId = createLocation('Test City')

    const location = db
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(locationId) as { id: number; name: string; type_id: number }

    expect(location).toBeDefined()
    expect(location.name).toBe('Test City')
    expect(location.type_id).toBe(locationTypeId)
  })

  it('should update a location', () => {
    const locationId = createLocation('Old Name')

    db.prepare('UPDATE entities SET name = ?, description = ? WHERE id = ?')
      .run('New Name', 'Updated description', locationId)

    const location = db
      .prepare('SELECT name, description FROM entities WHERE id = ?')
      .get(locationId) as { name: string; description: string }

    expect(location.name).toBe('New Name')
    expect(location.description).toBe('Updated description')
  })

  it('should soft-delete a location', () => {
    const locationId = createLocation('To Delete')

    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(locationId)

    const location = db
      .prepare('SELECT deleted_at FROM entities WHERE id = ?')
      .get(locationId) as { deleted_at: string | null }

    expect(location.deleted_at).not.toBeNull()
  })

  it('should not return soft-deleted locations in normal queries', () => {
    const locationId = createLocation('Deleted Location')
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(locationId)

    const locations = db
      .prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL')
      .all(locationTypeId, testCampaignId)

    expect(locations).toHaveLength(0)
  })
})

describe('Locations - Metadata (Type, Region, Notes)', () => {
  it('should store location type in metadata', () => {
    const locationId = createLocation('Test Tavern', undefined, { type: 'tavern' })

    const location = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(locationId) as { metadata: string }

    const metadata = JSON.parse(location.metadata)
    expect(metadata.type).toBe('tavern')
  })

  it('should store region in metadata', () => {
    const locationId = createLocation('Test City', undefined, { type: 'city', region: 'Northern Kingdom' })

    const location = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(locationId) as { metadata: string }

    const metadata = JSON.parse(location.metadata)
    expect(metadata.region).toBe('Northern Kingdom')
  })

  it('should store notes in metadata', () => {
    const locationId = createLocation('Secret Cave', undefined, {
      type: 'dungeon',
      notes: 'Contains ancient treasure'
    })

    const location = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(locationId) as { metadata: string }

    const metadata = JSON.parse(location.metadata)
    expect(metadata.notes).toBe('Contains ancient treasure')
  })

  it('should query locations by type', () => {
    createLocation('Tavern 1', undefined, { type: 'tavern' })
    createLocation('Tavern 2', undefined, { type: 'tavern' })
    createLocation('City 1', undefined, { type: 'city' })

    const taverns = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
          AND json_extract(metadata, '$.type') = ?
      `)
      .all(locationTypeId, testCampaignId, 'tavern')

    expect(taverns).toHaveLength(2)
  })
})

describe('Locations - Hierarchical Structure (Parent/Child)', () => {
  it('should create a location with a parent', () => {
    const cityId = createLocation('Main City')
    const districtId = createLocation('Market District', cityId)

    const district = db
      .prepare('SELECT parent_entity_id FROM entities WHERE id = ?')
      .get(districtId) as { parent_entity_id: number }

    expect(district.parent_entity_id).toBe(cityId)
  })

  it('should query child locations', () => {
    const cityId = createLocation('Big City')
    createLocation('District A', cityId)
    createLocation('District B', cityId)
    createLocation('District C', cityId)

    const children = db
      .prepare('SELECT * FROM entities WHERE parent_entity_id = ? AND deleted_at IS NULL')
      .all(cityId)

    expect(children).toHaveLength(3)
  })

  it('should build a tree structure', () => {
    // Create hierarchy: City → District → Building → Room
    const cityId = createLocation('Capital City')
    const districtId = createLocation('Noble District', cityId)
    const buildingId = createLocation('Royal Palace', districtId)
    const roomId = createLocation('Throne Room', buildingId)

    // Query full path
    const room = db
      .prepare('SELECT parent_entity_id FROM entities WHERE id = ?')
      .get(roomId) as { parent_entity_id: number }

    const building = db
      .prepare('SELECT parent_entity_id FROM entities WHERE id = ?')
      .get(room.parent_entity_id) as { parent_entity_id: number }

    const district = db
      .prepare('SELECT parent_entity_id FROM entities WHERE id = ?')
      .get(building.parent_entity_id) as { parent_entity_id: number }

    expect(room.parent_entity_id).toBe(buildingId)
    expect(building.parent_entity_id).toBe(districtId)
    expect(district.parent_entity_id).toBe(cityId)
  })

  it('should find root locations (no parent)', () => {
    const city1Id = createLocation('City 1')
    const city2Id = createLocation('City 2')
    createLocation('District in City 1', city1Id)
    createLocation('District in City 2', city2Id)

    const rootLocations = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND parent_entity_id IS NULL
          AND deleted_at IS NULL
      `)
      .all(locationTypeId, testCampaignId)

    expect(rootLocations).toHaveLength(2)
  })

  it('should handle moving a location to a new parent', () => {
    const city1Id = createLocation('City 1')
    const city2Id = createLocation('City 2')
    const districtId = createLocation('Mobile District', city1Id)

    // Move district to city2
    db.prepare('UPDATE entities SET parent_entity_id = ? WHERE id = ?')
      .run(city2Id, districtId)

    const district = db
      .prepare('SELECT parent_entity_id FROM entities WHERE id = ?')
      .get(districtId) as { parent_entity_id: number }

    expect(district.parent_entity_id).toBe(city2Id)
  })

  it('should handle removing parent (making location root)', () => {
    const cityId = createLocation('City')
    const districtId = createLocation('District', cityId)

    // Remove parent
    db.prepare('UPDATE entities SET parent_entity_id = NULL WHERE id = ?')
      .run(districtId)

    const district = db
      .prepare('SELECT parent_entity_id FROM entities WHERE id = ?')
      .get(districtId) as { parent_entity_id: number | null }

    expect(district.parent_entity_id).toBeNull()
  })
})

describe('Locations - Search with FTS5', () => {
  it('should find location by name', () => {
    createLocation('Golden Dragon Inn')
    createLocation('Silver Swan Tavern')

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
      .all('golden*', locationTypeId, testCampaignId)

    expect(results).toHaveLength(1)
    expect((results[0] as { name: string }).name).toBe('Golden Dragon Inn')
  })

  it('should find location by description', () => {
    const locationId = createLocation('Mystery Location')
    db.prepare('UPDATE entities SET description = ? WHERE id = ?')
      .run('A haunted castle on the hill', locationId)

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
      .all('haunted*', locationTypeId, testCampaignId)

    expect(results).toHaveLength(1)
  })
})

describe('Locations - Relations to NPCs', () => {
  it('should link NPCs to locations', () => {
    const locationId = createLocation('Town Square')

    // Create NPCs
    const npc1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Guard')
    const npc2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Merchant')

    // Link NPCs to location
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(npc1.lastInsertRowid, locationId, 'patrols')
    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(npc2.lastInsertRowid, locationId, 'works_at')

    // Query NPCs at location
    const npcsAtLocation = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(locationId, npcTypeId)

    expect(npcsAtLocation).toHaveLength(2)
  })

  it('should count NPCs at location', () => {
    const locationId = createLocation('Busy Market')

    // Create and link multiple NPCs
    for (let i = 0; i < 5; i++) {
      const npc = db
        .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
        .run(npcTypeId, testCampaignId, `NPC ${i}`)
      db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
        .run(npc.lastInsertRowid, locationId, 'visits')
    }

    const count = db
      .prepare(`
        SELECT COUNT(DISTINCT er.from_entity_id) as count
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .get(locationId, npcTypeId) as { count: number }

    expect(count.count).toBe(5)
  })
})

describe('Locations - Location Types', () => {
  const locationTypes = [
    'city', 'town', 'village', 'district', 'building',
    'tavern', 'shop', 'temple', 'dungeon', 'forest',
    'mountain', 'river', 'sea', 'island', 'cave'
  ]

  it('should accept all predefined location types', () => {
    locationTypes.forEach(type => {
      const locationId = createLocation(`Test ${type}`, undefined, { type })

      const location = db
        .prepare('SELECT metadata FROM entities WHERE id = ?')
        .get(locationId) as { metadata: string }

      const metadata = JSON.parse(location.metadata)
      expect(metadata.type).toBe(type)
    })
  })

  it('should accept custom location types', () => {
    const locationId = createLocation('Custom Place', undefined, { type: 'custom_type_xyz' })

    const location = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(locationId) as { metadata: string }

    const metadata = JSON.parse(location.metadata)
    expect(metadata.type).toBe('custom_type_xyz')
  })
})

describe('Locations - Campaign Isolation', () => {
  it('should only return locations from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create locations in both campaigns
    createLocation('Location in Test Campaign')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, campaign2Id, 'Location in Campaign 2')

    const testCampaignLocations = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
      `)
      .all(locationTypeId, testCampaignId)

    const campaign2Locations = db
      .prepare(`
        SELECT * FROM entities
        WHERE type_id = ?
          AND campaign_id = ?
          AND deleted_at IS NULL
      `)
      .all(locationTypeId, campaign2Id)

    expect(testCampaignLocations).toHaveLength(1)
    expect(campaign2Locations).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})
