import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Chaos Graph Tests
// Tests the entity connections API used by the chaos graph visualization

let db: Database.Database
let testCampaignId: number
let entityTypeIds: Record<string, number> = {}

beforeAll(() => {
  db = getDb()

  // Get all entity type IDs
  const entityTypes = ['NPC', 'Location', 'Item', 'Faction', 'Lore', 'Player']
  for (const typeName of entityTypes) {
    const type = db.prepare('SELECT id FROM entity_types WHERE name = ?').get(typeName) as { id: number }
    entityTypeIds[typeName] = type.id
  }

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Chaos', 'Test description')
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

// Helper to create an entity of any type
function createEntity(typeName: string, name: string, metadata?: Record<string, unknown>): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, metadata) VALUES (?, ?, ?, ?)')
    .run(entityTypeIds[typeName], testCampaignId, name, metadata ? JSON.stringify(metadata) : null)
  return Number(result.lastInsertRowid)
}

// Helper to create a relation
function createRelation(fromId: number, toId: number, relationType: string): number {
  const result = db
    .prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
    .run(fromId, toId, relationType)
  return Number(result.lastInsertRowid)
}

// Helper to get connections (simulates the API)
function getConnections(entityId: number) {
  interface DbConnection {
    relation_id: number
    entity_id: number
    entity_name: string
    entity_type: string
    entity_type_id: number
    entity_icon: string
    entity_color: string
    entity_image_url: string | null
    relation_type: string
    relation_notes: string | null
    direction: 'outgoing' | 'incoming'
  }

  // Get outgoing relations
  const outgoing = db
    .prepare<unknown[], DbConnection>(`
      SELECT
        er.id as relation_id,
        e.id as entity_id,
        e.name as entity_name,
        et.name as entity_type,
        et.id as entity_type_id,
        et.icon as entity_icon,
        et.color as entity_color,
        e.image_url as entity_image_url,
        er.relation_type,
        er.notes as relation_notes,
        'outgoing' as direction
      FROM entity_relations er
      INNER JOIN entities e ON er.to_entity_id = e.id
      INNER JOIN entity_types et ON e.type_id = et.id
      WHERE er.from_entity_id = ?
        AND e.deleted_at IS NULL
      ORDER BY et.name, e.name
    `)
    .all(entityId)

  // Get incoming relations
  const incoming = db
    .prepare<unknown[], DbConnection>(`
      SELECT
        er.id as relation_id,
        e.id as entity_id,
        e.name as entity_name,
        et.name as entity_type,
        et.id as entity_type_id,
        et.icon as entity_icon,
        et.color as entity_color,
        e.image_url as entity_image_url,
        er.relation_type,
        er.notes as relation_notes,
        'incoming' as direction
      FROM entity_relations er
      INNER JOIN entities e ON er.from_entity_id = e.id
      INNER JOIN entity_types et ON e.type_id = et.id
      WHERE er.to_entity_id = ?
        AND e.deleted_at IS NULL
      ORDER BY et.name, e.name
    `)
    .all(entityId)

  return [...outgoing, ...incoming]
}

describe('Chaos Graph - Entity Connections', () => {
  it('should return outgoing connections', () => {
    const npcId = createEntity('NPC', 'Test NPC')
    const locationId = createEntity('Location', 'Test Location')
    createRelation(npcId, locationId, 'lives_at')

    const connections = getConnections(npcId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_name).toBe('Test Location')
    expect(connections[0].entity_type).toBe('Location')
    expect(connections[0].direction).toBe('outgoing')
  })

  it('should return incoming connections', () => {
    const npcId = createEntity('NPC', 'Test NPC')
    const locationId = createEntity('Location', 'Test Location')
    createRelation(npcId, locationId, 'lives_at')

    const connections = getConnections(locationId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_name).toBe('Test NPC')
    expect(connections[0].entity_type).toBe('NPC')
    expect(connections[0].direction).toBe('incoming')
  })

  it('should return both incoming and outgoing connections', () => {
    const npc1 = createEntity('NPC', 'NPC 1')
    const npc2 = createEntity('NPC', 'NPC 2')
    const npc3 = createEntity('NPC', 'NPC 3')

    // NPC1 -> NPC2 (outgoing from NPC2's perspective: incoming)
    createRelation(npc1, npc2, 'friend')
    // NPC2 -> NPC3 (outgoing from NPC2's perspective)
    createRelation(npc2, npc3, 'enemy')

    const connections = getConnections(npc2)

    expect(connections).toHaveLength(2)

    const incoming = connections.find(c => c.direction === 'incoming')
    const outgoing = connections.find(c => c.direction === 'outgoing')

    expect(incoming?.entity_name).toBe('NPC 1')
    expect(outgoing?.entity_name).toBe('NPC 3')
  })
})

describe('Chaos Graph - All Entity Types', () => {
  it('should handle NPC connections', () => {
    const npcId = createEntity('NPC', 'Gandalf', { race: 'human', class: 'wizard' })
    const itemId = createEntity('Item', 'Staff of Power')
    createRelation(npcId, itemId, 'owns')

    const connections = getConnections(npcId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_type).toBe('Item')
  })

  it('should handle Location connections', () => {
    const locationId = createEntity('Location', 'Moria', { type: 'dungeon' })
    const npcId = createEntity('NPC', 'Balrog')
    createRelation(npcId, locationId, 'guards')

    const connections = getConnections(locationId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_type).toBe('NPC')
  })

  it('should handle Item connections', () => {
    const itemId = createEntity('Item', 'The One Ring', { rarity: 'artifact' })
    const npcId = createEntity('NPC', 'Frodo')
    createRelation(npcId, itemId, 'carries')

    const connections = getConnections(itemId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_type).toBe('NPC')
  })

  it('should handle Faction connections', () => {
    const factionId = createEntity('Faction', 'Fellowship', { type: 'alliance' })
    const npcId = createEntity('NPC', 'Aragorn')
    createRelation(npcId, factionId, 'member')

    const connections = getConnections(factionId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_type).toBe('NPC')
  })

  it('should handle Lore connections', () => {
    const loreId = createEntity('Lore', 'The Silmarillion', { category: 'history' })
    const npcId = createEntity('NPC', 'Elrond')
    createRelation(loreId, npcId, 'mentions')

    const connections = getConnections(loreId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_type).toBe('NPC')
  })

  it('should handle Player connections', () => {
    const playerId = createEntity('Player', 'John', { player_name: 'John Doe' })
    const npcId = createEntity('NPC', 'Legolas')
    createRelation(playerId, npcId, 'plays')

    const connections = getConnections(playerId)

    expect(connections).toHaveLength(1)
    expect(connections[0].entity_type).toBe('NPC')
  })
})

describe('Chaos Graph - Complex Networks', () => {
  it('should handle entity with multiple connections of different types', () => {
    const npcId = createEntity('NPC', 'Central NPC')
    const location1 = createEntity('Location', 'Home')
    const location2 = createEntity('Location', 'Work')
    const item1 = createEntity('Item', 'Sword')
    const faction1 = createEntity('Faction', 'Guild')

    createRelation(npcId, location1, 'lives_at')
    createRelation(npcId, location2, 'works_at')
    createRelation(npcId, item1, 'owns')
    createRelation(npcId, faction1, 'member_of')

    const connections = getConnections(npcId)

    expect(connections).toHaveLength(4)

    const types = connections.map(c => c.entity_type)
    expect(types).toContain('Location')
    expect(types).toContain('Item')
    expect(types).toContain('Faction')
  })

  it('should not include soft-deleted entities in connections', () => {
    const npcId = createEntity('NPC', 'Active NPC')
    const deletedNpcId = createEntity('NPC', 'Deleted NPC')

    createRelation(npcId, deletedNpcId, 'friend')

    // Soft-delete the connected NPC
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(deletedNpcId)

    const connections = getConnections(npcId)

    expect(connections).toHaveLength(0)
  })

  it('should handle bidirectional relationships correctly', () => {
    const npc1 = createEntity('NPC', 'Alice')
    const npc2 = createEntity('NPC', 'Bob')

    // Create bidirectional relationship
    createRelation(npc1, npc2, 'friend')
    createRelation(npc2, npc1, 'friend')

    const connectionsNpc1 = getConnections(npc1)
    const connectionsNpc2 = getConnections(npc2)

    // Each should see the other twice (once outgoing, once incoming)
    expect(connectionsNpc1).toHaveLength(2)
    expect(connectionsNpc2).toHaveLength(2)
  })
})

describe('Chaos Graph - Entity Type Metadata', () => {
  it('should return entity type icon and color', () => {
    const npcId = createEntity('NPC', 'Test NPC')
    const locationId = createEntity('Location', 'Test Location')
    createRelation(npcId, locationId, 'visits')

    const connections = getConnections(npcId)

    expect(connections[0].entity_icon).toBeDefined()
    expect(connections[0].entity_color).toBeDefined()
    expect(connections[0].entity_type_id).toBe(entityTypeIds['Location'])
  })

  it('should return entity image URL if present', () => {
    const npcId = createEntity('NPC', 'NPC with Image')
    const locationId = createEntity('Location', 'Location')

    // Set image URL
    db.prepare('UPDATE entities SET image_url = ? WHERE id = ?').run('test-image.jpg', locationId)

    createRelation(npcId, locationId, 'visits')

    const connections = getConnections(npcId)

    expect(connections[0].entity_image_url).toBe('test-image.jpg')
  })

  it('should return null for entity without image', () => {
    const npcId = createEntity('NPC', 'NPC')
    const locationId = createEntity('Location', 'Location without image')

    createRelation(npcId, locationId, 'visits')

    const connections = getConnections(npcId)

    expect(connections[0].entity_image_url).toBeNull()
  })
})

describe('Chaos Graph - Relation Types', () => {
  it('should return relation type', () => {
    const npcId = createEntity('NPC', 'NPC')
    const locationId = createEntity('Location', 'Location')

    createRelation(npcId, locationId, 'guards')

    const connections = getConnections(npcId)

    expect(connections[0].relation_type).toBe('guards')
  })

  it('should handle custom relation types', () => {
    const npcId = createEntity('NPC', 'NPC')
    const itemId = createEntity('Item', 'Item')

    createRelation(npcId, itemId, 'custom_relation_type')

    const connections = getConnections(npcId)

    expect(connections[0].relation_type).toBe('custom_relation_type')
  })

  it('should handle i18n key relation types', () => {
    const npc1 = createEntity('NPC', 'NPC 1')
    const npc2 = createEntity('NPC', 'NPC 2')

    createRelation(npc1, npc2, 'friend')

    const connections = getConnections(npc1)

    expect(connections[0].relation_type).toBe('friend')
  })
})

describe('Chaos Graph - Empty States', () => {
  it('should return empty array for entity with no connections', () => {
    const npcId = createEntity('NPC', 'Lonely NPC')

    const connections = getConnections(npcId)

    expect(connections).toHaveLength(0)
  })
})
