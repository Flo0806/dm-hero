import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Faction Counts Tests - Testing the /api/factions/[id]/counts endpoint logic
let db: Database.Database
let testCampaignId: number
let factionTypeId: number
let npcTypeId: number
let itemTypeId: number
let locationTypeId: number
let loreTypeId: number

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const factionType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Faction') as {
    id: number
  }
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as {
    id: number
  }
  const itemType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as {
    id: number
  }
  const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as {
    id: number
  }
  const loreType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as {
    id: number
  }

  factionTypeId = factionType.id
  npcTypeId = npcType.id
  itemTypeId = itemType.id
  locationTypeId = locationType.id
  loreTypeId = loreType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign - Faction Counts', 'Faction counts API tests')
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
  db.prepare('DELETE FROM entity_documents WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_images WHERE entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
})

describe('Faction Counts API - Members', () => {
  it('should count faction members (NPCs)', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 3 NPCs
    const npc1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npc1Id = Number(npc1.lastInsertRowid)

    const npc2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Frodo')
    const npc2Id = Number(npc2.lastInsertRowid)

    const npc3 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Sam')
    const npc3Id = Number(npc3.lastInsertRowid)

    // Link NPCs to Faction (NPC → Faction)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc1Id, factionId, 'Mitglied')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc2Id, factionId, 'Anführer')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npc3Id, factionId, 'Mitglied')

    // Count members (like /api/factions/[id]/counts.get.ts)
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(factionId, npcTypeId) as { count: number }

    expect(result.count).toBe(3)
  })

  it('should NOT count soft-deleted NPCs as members', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create NPC and soft-delete it
    const npc = db
      .prepare(
        "INSERT INTO entities (type_id, campaign_id, name, deleted_at) VALUES (?, ?, ?, datetime('now'))",
      )
      .run(npcTypeId, testCampaignId, 'Gandalf')
    const npcId = Number(npc.lastInsertRowid)

    // Link deleted NPC to Faction
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(npcId, factionId, 'Mitglied')

    // Count members
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(factionId, npcTypeId) as { count: number }

    expect(result.count).toBe(0)
  })
})

describe('Faction Counts API - Items (Bidirectional)', () => {
  it('should count items linked TO faction (faction owns items)', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 2 items
    const item1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Energietrank')
    const item1Id = Number(item1.lastInsertRowid)

    const item2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Heiltrank')
    const item2Id = Number(item2.lastInsertRowid)

    // Link items TO faction (Faction → Item, "faction owns item")
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, item1Id, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, item2Id, 'bezieht sich auf')

    // Count items (OUTGOING direction: Faction → Item)
    const outgoingResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.to_entity_id
      WHERE er.from_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(factionId, itemTypeId) as { count: number }

    expect(outgoingResult.count).toBe(2)
  })

  it('should count items linked FROM faction (item references faction)', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create item
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Harper Pin')
    const itemId = Number(item.lastInsertRowid)

    // Link item FROM faction (Item → Faction, "item references faction")
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(itemId, factionId, 'gehört zu')

    // Count items (INCOMING direction: Item → Faction)
    const incomingResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(factionId, itemTypeId) as { count: number }

    expect(incomingResult.count).toBe(1)
  })

  it('should count items BIDIRECTIONALLY (union of both directions)', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 3 items
    const item1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Energietrank')
    const item1Id = Number(item1.lastInsertRowid)

    const item2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Harper Pin')
    const item2Id = Number(item2.lastInsertRowid)

    const item3 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Heiltrank')
    const item3Id = Number(item3.lastInsertRowid)

    // Link: Faction → Item1 (outgoing)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, item1Id, 'bezieht sich auf')
    // Link: Item2 → Faction (incoming)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(item2Id, factionId, 'gehört zu')
    // Link: Faction → Item3 (outgoing)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, item3Id, 'bezieht sich auf')

    // Count items BIDIRECTIONALLY (like /api/factions/[id]/counts.get.ts)
    const result = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        -- Outgoing: Faction → Item
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        -- Incoming: Item → Faction
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(factionId, itemTypeId, factionId, itemTypeId) as { count: number }

    expect(result.count).toBe(3)
  })
})

describe('Faction Counts API - Locations (Bidirectional)', () => {
  it('should count locations linked to faction (bidirectional)', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 2 locations
    const location1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Taverne zum Goldenen Drachen')
    const location1Id = Number(location1.lastInsertRowid)

    const location2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Versteck')
    const location2Id = Number(location2.lastInsertRowid)

    // Link: Faction → Location1 (headquarters)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, location1Id, 'Hauptquartier')
    // Link: Faction → Location2 (hideout)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, location2Id, 'Versteck')

    // Count locations BIDIRECTIONALLY
    const result = db
      .prepare(
        `
      SELECT COUNT(DISTINCT e.id) as count
      FROM (
        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION

        SELECT e.id
        FROM entity_relations er
        INNER JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      ) AS e
    `,
      )
      .get(factionId, locationTypeId, factionId, locationTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('Faction Counts API - Documents & Images', () => {
  it('should count documents for faction', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 2 documents
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)').run(
      factionId,
      'History',
      'Founded in...',
      '2025-01-01',
    )
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)').run(
      factionId,
      'Goals',
      'Protect the realm...',
      '2025-01-02',
    )

    // Count documents
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_documents
      WHERE entity_id = ?
    `,
      )
      .get(factionId) as { count: number }

    expect(result.count).toBe(2)
  })

  it('should count images for faction', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 3 images
    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)').run(
      factionId,
      'image1.png',
      1,
    )
    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)').run(
      factionId,
      'image2.png',
      0,
    )
    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)').run(
      factionId,
      'image3.png',
      0,
    )

    // Count images
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_images
      WHERE entity_id = ?
    `,
      )
      .get(factionId) as { count: number }

    expect(result.count).toBe(3)
  })
})

describe('Faction Counts API - Lore', () => {
  it('should count lore entries linked to faction', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 2 lore entries
    const lore1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    const lore1Id = Number(lore1.lastInsertRowid)

    const lore2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Der Ring der Macht')
    const lore2Id = Number(lore2.lastInsertRowid)

    // Link lore to faction (Lore → Faction)
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore1Id, factionId, 'bezieht sich auf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(lore2Id, factionId, 'bezieht sich auf')

    // Count lore (like /api/factions/[id]/counts.get.ts)
    const result = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(factionId, loreTypeId) as { count: number }

    expect(result.count).toBe(2)
  })
})

describe('Faction Counts API - Full Response', () => {
  it('should return all counts in correct format', () => {
    // Create faction
    const faction = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(factionTypeId, testCampaignId, 'Die Harpers')
    const factionId = Number(faction.lastInsertRowid)

    // Create 2 NPCs (members)
    const npc1 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Gandalf')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(Number(npc1.lastInsertRowid), factionId, 'Mitglied')

    const npc2 = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Frodo')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(Number(npc2.lastInsertRowid), factionId, 'Mitglied')

    // Create 1 item
    const item = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(itemTypeId, testCampaignId, 'Harper Pin')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, Number(item.lastInsertRowid), 'bezieht sich auf')

    // Create 1 location
    const location = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Taverne')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(factionId, Number(location.lastInsertRowid), 'Hauptquartier')

    // Create 1 lore
    const lore = db
      .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(loreTypeId, testCampaignId, 'Böser Frosch')
    db.prepare(
      'INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)',
    ).run(Number(lore.lastInsertRowid), factionId, 'bezieht sich auf')

    // Create 1 document
    db.prepare('INSERT INTO entity_documents (entity_id, title, content, date) VALUES (?, ?, ?, ?)').run(
      factionId,
      'History',
      'Founded in...',
      '2025-01-01',
    )

    // Create 2 images
    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)').run(
      factionId,
      'image1.png',
      1,
    )
    db.prepare('INSERT INTO entity_images (entity_id, image_url, is_primary) VALUES (?, ?, ?)').run(
      factionId,
      'image2.png',
      0,
    )

    // Verify counts match expected API response format
    const membersCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM entity_relations er
         INNER JOIN entities e ON e.id = er.from_entity_id
         WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL`,
      )
      .get(factionId, npcTypeId) as { count: number }

    const itemsCount = db
      .prepare(
        `SELECT COUNT(DISTINCT e.id) as count FROM (
           SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
           WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
           UNION
           SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
           WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
         ) AS e`,
      )
      .get(factionId, itemTypeId, factionId, itemTypeId) as { count: number }

    const locationsCount = db
      .prepare(
        `SELECT COUNT(DISTINCT e.id) as count FROM (
           SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.to_entity_id
           WHERE er.from_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
           UNION
           SELECT e.id FROM entity_relations er INNER JOIN entities e ON e.id = er.from_entity_id
           WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL
         ) AS e`,
      )
      .get(factionId, locationTypeId, factionId, locationTypeId) as { count: number }

    const loreCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM entity_relations er
         INNER JOIN entities e ON e.id = er.from_entity_id
         WHERE er.to_entity_id = ? AND e.type_id = ? AND e.deleted_at IS NULL`,
      )
      .get(factionId, loreTypeId) as { count: number }

    const documentsCount = db
      .prepare('SELECT COUNT(*) as count FROM entity_documents WHERE entity_id = ?')
      .get(factionId) as { count: number }

    const imagesCount = db
      .prepare('SELECT COUNT(*) as count FROM entity_images WHERE entity_id = ?')
      .get(factionId) as { count: number }

    // Expected API response format
    const expectedResponse = {
      members: membersCount.count,
      items: itemsCount.count,
      locations: locationsCount.count,
      lore: loreCount.count,
      documents: documentsCount.count,
      images: imagesCount.count,
    }

    expect(expectedResponse).toEqual({
      members: 2,
      items: 1,
      locations: 1,
      lore: 1,
      documents: 1,
      images: 2,
    })
  })
})
