import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Entity Relations CRUD Tests
// Tests the entity_relations table operations (bidirectional linking)

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let itemTypeId: number
let locationTypeId: number
let factionTypeId: number
let loreTypeId: number

beforeAll(() => {
  db = getDb()

  // Get entity type IDs
  const getTypeId = (name: string) => {
    const type = db.prepare('SELECT id FROM entity_types WHERE name = ?').get(name) as { id: number }
    return type.id
  }

  npcTypeId = getTypeId('NPC')
  itemTypeId = getTypeId('Item')
  locationTypeId = getTypeId('Location')
  factionTypeId = getTypeId('Faction')
  loreTypeId = getTypeId('Lore')

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Relations', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    // Clean up in correct order (relations first, then entities, then campaign)
    db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up relations and entities before each test
  db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create an entity
function createEntity(typeId: number, name: string, description?: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description) VALUES (?, ?, ?, ?)')
    .run(typeId, testCampaignId, name, description || null)
  return Number(result.lastInsertRowid)
}

// Helper to create a relation
function createRelation(fromId: number, toId: number, relationType: string, notes?: string): number {
  const result = db
    .prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, notes) VALUES (?, ?, ?, ?)')
    .run(fromId, toId, relationType, notes || null)
  return Number(result.lastInsertRowid)
}

describe('Entity Relations - Basic CRUD', () => {
  it('should create a relation between two entities', () => {
    const npcId = createEntity(npcTypeId, 'Test NPC')
    const itemId = createEntity(itemTypeId, 'Test Item')

    const relationId = createRelation(npcId, itemId, 'owns')

    const relation = db
      .prepare('SELECT * FROM entity_relations WHERE id = ?')
      .get(relationId) as { id: number; from_entity_id: number; to_entity_id: number; relation_type: string }

    expect(relation).toBeDefined()
    expect(relation.from_entity_id).toBe(npcId)
    expect(relation.to_entity_id).toBe(itemId)
    expect(relation.relation_type).toBe('owns')
  })

  it('should update a relation', () => {
    const npcId = createEntity(npcTypeId, 'Test NPC')
    const itemId = createEntity(itemTypeId, 'Test Item')
    const relationId = createRelation(npcId, itemId, 'owns')

    db.prepare('UPDATE entity_relations SET relation_type = ?, notes = ? WHERE id = ?')
      .run('carries', 'Updated notes', relationId)

    const relation = db
      .prepare('SELECT * FROM entity_relations WHERE id = ?')
      .get(relationId) as { relation_type: string; notes: string }

    expect(relation.relation_type).toBe('carries')
    expect(relation.notes).toBe('Updated notes')
  })

  it('should delete a relation', () => {
    const npcId = createEntity(npcTypeId, 'Test NPC')
    const itemId = createEntity(itemTypeId, 'Test Item')
    const relationId = createRelation(npcId, itemId, 'owns')

    db.prepare('DELETE FROM entity_relations WHERE id = ?').run(relationId)

    const relation = db
      .prepare('SELECT * FROM entity_relations WHERE id = ?')
      .get(relationId)

    expect(relation).toBeUndefined()
  })

  it('should store relation notes', () => {
    const npcId = createEntity(npcTypeId, 'Test NPC')
    const locationId = createEntity(locationTypeId, 'Test Location')

    const relationId = createRelation(npcId, locationId, 'lives_at', 'Has lived here for 10 years')

    const relation = db
      .prepare('SELECT notes FROM entity_relations WHERE id = ?')
      .get(relationId) as { notes: string }

    expect(relation.notes).toBe('Has lived here for 10 years')
  })
})

describe('Entity Relations - Bidirectional Queries', () => {
  it('should find relations in both directions', () => {
    const npcId = createEntity(npcTypeId, 'NPC A')
    const itemId = createEntity(itemTypeId, 'Magic Sword')

    // NPC owns Item
    createRelation(npcId, itemId, 'owns')

    // Query from NPC perspective (outgoing)
    const outgoing = db
      .prepare(`
        SELECT to_entity_id as related_id, relation_type
        FROM entity_relations
        WHERE from_entity_id = ?
      `)
      .all(npcId) as Array<{ related_id: number; relation_type: string }>

    expect(outgoing).toHaveLength(1)
    expect(outgoing[0].related_id).toBe(itemId)

    // Query from Item perspective (incoming)
    const incoming = db
      .prepare(`
        SELECT from_entity_id as related_id, relation_type
        FROM entity_relations
        WHERE to_entity_id = ?
      `)
      .all(itemId) as Array<{ related_id: number; relation_type: string }>

    expect(incoming).toHaveLength(1)
    expect(incoming[0].related_id).toBe(npcId)
  })

  it('should query all related entities bidirectionally with UNION', () => {
    const npcId = createEntity(npcTypeId, 'Central NPC')
    const item1Id = createEntity(itemTypeId, 'Item 1')
    const item2Id = createEntity(itemTypeId, 'Item 2')

    // NPC → Item1 (outgoing)
    createRelation(npcId, item1Id, 'owns')
    // Item2 → NPC (incoming, e.g. "belongs to")
    createRelation(item2Id, npcId, 'belongs_to')

    // Bidirectional query
    const allRelated = db
      .prepare(`
        SELECT to_entity_id as related_id, 'outgoing' as direction, relation_type
        FROM entity_relations
        WHERE from_entity_id = ?
        UNION ALL
        SELECT from_entity_id as related_id, 'incoming' as direction, relation_type
        FROM entity_relations
        WHERE to_entity_id = ?
      `)
      .all(npcId, npcId) as Array<{ related_id: number; direction: string; relation_type: string }>

    expect(allRelated).toHaveLength(2)

    const relatedIds = allRelated.map(r => r.related_id)
    expect(relatedIds).toContain(item1Id)
    expect(relatedIds).toContain(item2Id)
  })
})

describe('Entity Relations - Cross-Entity Type Linking', () => {
  it('should link NPC to Faction', () => {
    const npcId = createEntity(npcTypeId, 'Guild Member')
    const factionId = createEntity(factionTypeId, 'Thieves Guild')

    createRelation(npcId, factionId, 'member')

    const relations = db
      .prepare(`
        SELECT e.name, e.type_id, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
      `)
      .all(npcId) as Array<{ name: string; type_id: number; relation_type: string }>

    expect(relations).toHaveLength(1)
    expect(relations[0].name).toBe('Thieves Guild')
    expect(relations[0].type_id).toBe(factionTypeId)
    expect(relations[0].relation_type).toBe('member')
  })

  it('should link NPC to Location', () => {
    const npcId = createEntity(npcTypeId, 'Tavern Owner')
    const locationId = createEntity(locationTypeId, 'The Golden Dragon Inn')

    createRelation(npcId, locationId, 'works_at')

    const relations = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ?
      `)
      .all(npcId, locationTypeId) as Array<{ name: string; relation_type: string }>

    expect(relations).toHaveLength(1)
    expect(relations[0].name).toBe('The Golden Dragon Inn')
  })

  it('should link NPC to Lore', () => {
    const npcId = createEntity(npcTypeId, 'Scholar')
    const loreId = createEntity(loreTypeId, 'Ancient Dragon Prophecy')

    createRelation(npcId, loreId, 'knows')

    const relations = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ? AND e.type_id = ?
      `)
      .all(npcId, loreTypeId) as Array<{ name: string; relation_type: string }>

    expect(relations).toHaveLength(1)
    expect(relations[0].name).toBe('Ancient Dragon Prophecy')
  })

  it('should link Item to Location', () => {
    const itemId = createEntity(itemTypeId, 'Legendary Sword')
    const locationId = createEntity(locationTypeId, 'Hidden Cave')

    createRelation(itemId, locationId, 'located_at')

    const relations = db
      .prepare(`
        SELECT e.name, er.relation_type
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
      `)
      .all(itemId) as Array<{ name: string; relation_type: string }>

    expect(relations).toHaveLength(1)
    expect(relations[0].name).toBe('Hidden Cave')
  })
})

describe('Entity Relations - Multiple Relations', () => {
  it('should allow multiple relations from one entity', () => {
    const npcId = createEntity(npcTypeId, 'Adventurer')
    const item1Id = createEntity(itemTypeId, 'Sword')
    const item2Id = createEntity(itemTypeId, 'Shield')
    const item3Id = createEntity(itemTypeId, 'Potion')

    createRelation(npcId, item1Id, 'wields')
    createRelation(npcId, item2Id, 'carries')
    createRelation(npcId, item3Id, 'owns')

    const relations = db
      .prepare('SELECT COUNT(*) as count FROM entity_relations WHERE from_entity_id = ?')
      .get(npcId) as { count: number }

    expect(relations.count).toBe(3)
  })

  it('should allow multiple relations to one entity', () => {
    const locationId = createEntity(locationTypeId, 'Market Square')
    const npc1Id = createEntity(npcTypeId, 'Merchant')
    const npc2Id = createEntity(npcTypeId, 'Guard')
    const npc3Id = createEntity(npcTypeId, 'Beggar')

    createRelation(npc1Id, locationId, 'works_at')
    createRelation(npc2Id, locationId, 'patrols')
    createRelation(npc3Id, locationId, 'lives_at')

    const relations = db
      .prepare('SELECT COUNT(*) as count FROM entity_relations WHERE to_entity_id = ?')
      .get(locationId) as { count: number }

    expect(relations.count).toBe(3)
  })

  it('should handle NPC to NPC relations', () => {
    const npc1Id = createEntity(npcTypeId, 'King')
    const npc2Id = createEntity(npcTypeId, 'Knight')
    const npc3Id = createEntity(npcTypeId, 'Squire')

    createRelation(npc2Id, npc1Id, 'serves')
    createRelation(npc3Id, npc2Id, 'serves')

    // Query knight's relations
    const knightRelations = db
      .prepare(`
        SELECT
          CASE WHEN from_entity_id = ? THEN to_entity_id ELSE from_entity_id END as related_id,
          relation_type
        FROM entity_relations
        WHERE from_entity_id = ? OR to_entity_id = ?
      `)
      .all(npc2Id, npc2Id, npc2Id) as Array<{ related_id: number; relation_type: string }>

    expect(knightRelations).toHaveLength(2)

    const relatedIds = knightRelations.map(r => r.related_id)
    expect(relatedIds).toContain(npc1Id)
    expect(relatedIds).toContain(npc3Id)
  })
})

describe('Entity Relations - Relation Types', () => {
  it('should support various relation types', () => {
    const npcId = createEntity(npcTypeId, 'Test NPC')

    const relationTypes = ['owns', 'carries', 'wields', 'wears', 'seeks', 'guards', 'stole', 'lost', 'created']

    relationTypes.forEach((type, index) => {
      const itemN = createEntity(itemTypeId, `Item ${index}`)
      createRelation(npcId, itemN, type)
    })

    const relations = db
      .prepare('SELECT DISTINCT relation_type FROM entity_relations WHERE from_entity_id = ?')
      .all(npcId) as Array<{ relation_type: string }>

    expect(relations).toHaveLength(relationTypes.length)

    const storedTypes = relations.map(r => r.relation_type)
    relationTypes.forEach(type => {
      expect(storedTypes).toContain(type)
    })
  })

  it('should allow custom relation types', () => {
    const npcId = createEntity(npcTypeId, 'Custom NPC')
    const locationId = createEntity(locationTypeId, 'Custom Location')

    createRelation(npcId, locationId, 'custom_relation_type_xyz')

    const relation = db
      .prepare('SELECT relation_type FROM entity_relations WHERE from_entity_id = ?')
      .get(npcId) as { relation_type: string }

    expect(relation.relation_type).toBe('custom_relation_type_xyz')
  })
})

describe('Entity Relations - Cascade Behavior', () => {
  it('should allow querying relations even after entity soft-delete', () => {
    const npcId = createEntity(npcTypeId, 'Deleted NPC')
    const itemId = createEntity(itemTypeId, 'Item of Deleted NPC')

    createRelation(npcId, itemId, 'owns')

    // Soft-delete the NPC
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(npcId)

    // Relations should still exist in database
    const relation = db
      .prepare('SELECT * FROM entity_relations WHERE from_entity_id = ?')
      .get(npcId)

    expect(relation).toBeDefined()

    // But queries should filter out deleted entities
    const activeRelations = db
      .prepare(`
        SELECT er.*
        FROM entity_relations er
        JOIN entities e ON e.id = er.from_entity_id
        WHERE er.to_entity_id = ? AND e.deleted_at IS NULL
      `)
      .all(itemId)

    expect(activeRelations).toHaveLength(0)
  })
})

describe('Entity Relations - Query with Entity Details', () => {
  it('should return full entity details when querying relations', () => {
    const npcId = createEntity(npcTypeId, 'Rich Merchant')
    const itemId = createEntity(itemTypeId, 'Golden Ring')

    // Update item with more details
    db.prepare('UPDATE entities SET description = ?, image_url = ? WHERE id = ?')
      .run('A beautiful golden ring', 'ring.jpg', itemId)

    createRelation(npcId, itemId, 'owns', 'Family heirloom')

    const relations = db
      .prepare(`
        SELECT
          er.id as relation_id,
          er.relation_type,
          er.notes,
          e.id,
          e.name,
          e.description,
          e.image_url
        FROM entity_relations er
        JOIN entities e ON e.id = er.to_entity_id
        WHERE er.from_entity_id = ?
      `)
      .all(npcId) as Array<{
        relation_id: number
        relation_type: string
        notes: string
        id: number
        name: string
        description: string
        image_url: string
      }>

    expect(relations).toHaveLength(1)
    expect(relations[0].name).toBe('Golden Ring')
    expect(relations[0].description).toBe('A beautiful golden ring')
    expect(relations[0].image_url).toBe('ring.jpg')
    expect(relations[0].relation_type).toBe('owns')
    expect(relations[0].notes).toBe('Family heirloom')
  })
})

describe('Entity Relations - Faction to Faction', () => {
  it('should create a relation between two factions', () => {
    const faction1Id = createEntity(factionTypeId, 'Thieves Guild')
    const faction2Id = createEntity(factionTypeId, 'Merchant Consortium')

    const relationId = createRelation(faction1Id, faction2Id, 'hostile')

    const relation = db
      .prepare('SELECT * FROM entity_relations WHERE id = ?')
      .get(relationId) as { id: number; from_entity_id: number; to_entity_id: number; relation_type: string }

    expect(relation).toBeDefined()
    expect(relation.from_entity_id).toBe(faction1Id)
    expect(relation.to_entity_id).toBe(faction2Id)
    expect(relation.relation_type).toBe('hostile')
  })

  it('should query faction relations bidirectionally', () => {
    const faction1Id = createEntity(factionTypeId, 'Kingdom of Eldoria')
    const faction2Id = createEntity(factionTypeId, 'Dwarven Stronghold')
    const faction3Id = createEntity(factionTypeId, 'Elven Enclave')

    // Faction 1 -> Faction 2 (outgoing)
    createRelation(faction1Id, faction2Id, 'allied')
    // Faction 3 -> Faction 1 (incoming)
    createRelation(faction3Id, faction1Id, 'neutral')

    // Query all relations for Faction 1 (like the API does)
    const relations = db
      .prepare(`
        SELECT
          er.id,
          er.relation_type,
          e.id as related_faction_id,
          e.name as related_faction_name,
          'outgoing' as direction
        FROM entity_relations er
        INNER JOIN entities e ON er.to_entity_id = e.id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL

        UNION ALL

        SELECT
          er.id,
          er.relation_type,
          e.id as related_faction_id,
          e.name as related_faction_name,
          'incoming' as direction
        FROM entity_relations er
        INNER JOIN entities e ON er.from_entity_id = e.id
        WHERE er.to_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(faction1Id, factionTypeId, faction1Id, factionTypeId) as Array<{
        id: number
        relation_type: string
        related_faction_id: number
        related_faction_name: string
        direction: string
      }>

    expect(relations).toHaveLength(2)

    const outgoing = relations.find(r => r.direction === 'outgoing')
    const incoming = relations.find(r => r.direction === 'incoming')

    expect(outgoing).toBeDefined()
    expect(outgoing?.related_faction_name).toBe('Dwarven Stronghold')
    expect(outgoing?.relation_type).toBe('allied')

    expect(incoming).toBeDefined()
    expect(incoming?.related_faction_name).toBe('Elven Enclave')
    expect(incoming?.relation_type).toBe('neutral')
  })

  it('should support standard faction relation types', () => {
    const factionA = createEntity(factionTypeId, 'Faction A')

    const relationTypes = ['allied', 'hostile', 'neutral', 'vassal', 'overlord', 'trade_partner', 'rival', 'subsidiary']

    relationTypes.forEach((type, index) => {
      const factionN = createEntity(factionTypeId, `Faction ${index + 2}`)
      createRelation(factionA, factionN, type)
    })

    const relations = db
      .prepare('SELECT DISTINCT relation_type FROM entity_relations WHERE from_entity_id = ?')
      .all(factionA) as Array<{ relation_type: string }>

    expect(relations).toHaveLength(relationTypes.length)

    const storedTypes = relations.map(r => r.relation_type)
    relationTypes.forEach(type => {
      expect(storedTypes).toContain(type)
    })
  })

  it('should store JSON notes for faction relations', () => {
    const faction1Id = createEntity(factionTypeId, 'Order of the Silver Shield')
    const faction2Id = createEntity(factionTypeId, 'Dark Brotherhood')

    const jsonNotes = JSON.stringify({ text: 'Long-standing enemies since the Great War' })
    const relationId = createRelation(faction1Id, faction2Id, 'hostile', jsonNotes)

    const relation = db
      .prepare('SELECT notes FROM entity_relations WHERE id = ?')
      .get(relationId) as { notes: string }

    expect(relation.notes).toBe(jsonNotes)

    // Parse and verify JSON structure
    const parsed = JSON.parse(relation.notes)
    expect(parsed.text).toBe('Long-standing enemies since the Great War')
  })

  it('should store plain text notes for faction relations', () => {
    const faction1Id = createEntity(factionTypeId, 'Merchants Guild')
    const faction2Id = createEntity(factionTypeId, 'Crafters Union')

    const plainNotes = 'Trade agreement signed in 1452'
    const relationId = createRelation(faction1Id, faction2Id, 'trade_partner', plainNotes)

    const relation = db
      .prepare('SELECT notes FROM entity_relations WHERE id = ?')
      .get(relationId) as { notes: string }

    expect(relation.notes).toBe(plainNotes)
  })

  it('should exclude deleted factions from relation queries', () => {
    const faction1Id = createEntity(factionTypeId, 'Active Faction')
    const faction2Id = createEntity(factionTypeId, 'Soon Deleted Faction')

    createRelation(faction1Id, faction2Id, 'allied')

    // Soft-delete faction2
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(faction2Id)

    // Query relations excluding deleted entities
    const relations = db
      .prepare(`
        SELECT e.id, e.name
        FROM entity_relations er
        INNER JOIN entities e ON er.to_entity_id = e.id
        WHERE er.from_entity_id = ?
          AND e.type_id = ?
          AND e.deleted_at IS NULL
      `)
      .all(faction1Id, factionTypeId) as Array<{ id: number; name: string }>

    expect(relations).toHaveLength(0)
  })

  it('should prevent self-referencing faction relations at application level', () => {
    const factionId = createEntity(factionTypeId, 'Self Faction')

    // Database allows it, but API should prevent it
    // This test documents that the DB doesn't enforce it - validation is in the API
    const relationId = createRelation(factionId, factionId, 'allied')

    const relation = db
      .prepare('SELECT * FROM entity_relations WHERE id = ?')
      .get(relationId) as { from_entity_id: number; to_entity_id: number }

    // DB allows self-reference - API must validate
    expect(relation.from_entity_id).toBe(relation.to_entity_id)
  })

  it('should update faction relation type and notes', () => {
    const faction1Id = createEntity(factionTypeId, 'Trading Company')
    const faction2Id = createEntity(factionTypeId, 'Pirate Fleet')

    const relationId = createRelation(faction1Id, faction2Id, 'hostile', 'Initial conflict')

    // Update the relation
    db.prepare('UPDATE entity_relations SET relation_type = ?, notes = ? WHERE id = ?')
      .run('neutral', 'Peace treaty signed', relationId)

    const updated = db
      .prepare('SELECT relation_type, notes FROM entity_relations WHERE id = ?')
      .get(relationId) as { relation_type: string; notes: string }

    expect(updated.relation_type).toBe('neutral')
    expect(updated.notes).toBe('Peace treaty signed')
  })

  it('should handle complex faction networks', () => {
    // Create a network of factions with various relations
    const kingdom = createEntity(factionTypeId, 'Kingdom')
    const vassal1 = createEntity(factionTypeId, 'Vassal Duchy')
    const vassal2 = createEntity(factionTypeId, 'Vassal Barony')
    const enemy = createEntity(factionTypeId, 'Enemy Empire')
    const neutral = createEntity(factionTypeId, 'Neutral City-State')

    // Kingdom has vassals
    createRelation(kingdom, vassal1, 'overlord')
    createRelation(kingdom, vassal2, 'overlord')
    // Vassals serve kingdom
    createRelation(vassal1, kingdom, 'vassal')
    createRelation(vassal2, kingdom, 'vassal')
    // Kingdom has enemy
    createRelation(kingdom, enemy, 'hostile')
    createRelation(enemy, kingdom, 'hostile')
    // Neutral trade partner
    createRelation(kingdom, neutral, 'trade_partner')

    // Count all relations for kingdom
    const kingdomRelations = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM entity_relations
        WHERE from_entity_id = ? OR to_entity_id = ?
      `)
      .get(kingdom, kingdom) as { count: number }

    // Kingdom: 2 overlord + 2 vassal incoming + 2 hostile + 1 trade = 7 relations
    expect(kingdomRelations.count).toBe(7)
  })

  it('should return faction with image_url in relations query', () => {
    const faction1Id = createEntity(factionTypeId, 'Image Faction 1')
    const faction2Id = createEntity(factionTypeId, 'Image Faction 2')

    // Set image_url on faction2
    db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run('faction2.jpg', faction2Id)

    createRelation(faction1Id, faction2Id, 'allied')

    const relations = db
      .prepare(`
        SELECT
          e.name as related_faction_name,
          e.image_url as related_faction_image_url
        FROM entity_relations er
        INNER JOIN entities e ON er.to_entity_id = e.id
        WHERE er.from_entity_id = ?
      `)
      .all(faction1Id) as Array<{ related_faction_name: string; related_faction_image_url: string }>

    expect(relations).toHaveLength(1)
    expect(relations[0].related_faction_name).toBe('Image Faction 2')
    expect(relations[0].related_faction_image_url).toBe('faction2.jpg')
  })
})
