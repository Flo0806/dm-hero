import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getTestDb } from '../utils/test-db'
import type Database from 'better-sqlite3'

let db: Database.Database
let testCampaignId: number
let npcTypeId: number
let locationTypeId: number
let itemTypeId: number

beforeAll(() => {
  db = getTestDb()

  npcTypeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }).id
  locationTypeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }).id
  itemTypeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Item') as { id: number }).id

  const campaign = db.prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)').run('Archive Test', 'Test')
  testCampaignId = Number(campaign.lastInsertRowid)
})

beforeEach(() => {
  db.prepare('DELETE FROM entity_relations WHERE from_entity_id IN (SELECT id FROM entities WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

describe('Archive - Basic', () => {
  it('should archive an entity', () => {
    const id = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(npcTypeId, testCampaignId, 'Test NPC').lastInsertRowid)

    db.prepare("UPDATE entities SET archived_at = datetime('now') WHERE id = ?").run(id)

    const entity = db.prepare('SELECT archived_at FROM entities WHERE id = ?').get(id) as { archived_at: string | null }
    expect(entity.archived_at).not.toBeNull()
  })

  it('should unarchive an entity', () => {
    const id = Number(db.prepare("INSERT INTO entities (type_id, campaign_id, name, archived_at) VALUES (?, ?, ?, datetime('now'))").run(npcTypeId, testCampaignId, 'Archived NPC').lastInsertRowid)

    db.prepare('UPDATE entities SET archived_at = NULL WHERE id = ?').run(id)

    const entity = db.prepare('SELECT archived_at FROM entities WHERE id = ?').get(id) as { archived_at: string | null }
    expect(entity.archived_at).toBeNull()
  })
})

describe('Archive - Filtering', () => {
  it('should exclude archived from active queries', () => {
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(npcTypeId, testCampaignId, 'Active')
    db.prepare("INSERT INTO entities (type_id, campaign_id, name, archived_at) VALUES (?, ?, ?, datetime('now'))").run(npcTypeId, testCampaignId, 'Archived')

    const active = db.prepare('SELECT name FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL AND archived_at IS NULL').all(npcTypeId, testCampaignId)
    const all = db.prepare('SELECT name FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL').all(npcTypeId, testCampaignId)

    expect(active).toHaveLength(1)
    expect(all).toHaveLength(2)
  })

  it('should work across entity types', () => {
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(npcTypeId, testCampaignId, 'Active NPC')
    db.prepare("INSERT INTO entities (type_id, campaign_id, name, archived_at) VALUES (?, ?, ?, datetime('now'))").run(npcTypeId, testCampaignId, 'Archived NPC')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(itemTypeId, testCampaignId, 'Active Item')
    db.prepare("INSERT INTO entities (type_id, campaign_id, name, archived_at) VALUES (?, ?, ?, datetime('now'))").run(itemTypeId, testCampaignId, 'Archived Item')

    const activeNpcs = db.prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL AND archived_at IS NULL').all(npcTypeId, testCampaignId)
    const activeItems = db.prepare('SELECT * FROM entities WHERE type_id = ? AND campaign_id = ? AND deleted_at IS NULL AND archived_at IS NULL').all(itemTypeId, testCampaignId)

    expect(activeNpcs).toHaveLength(1)
    expect(activeItems).toHaveLength(1)
  })
})

describe('Archive - Cascade (Parent/Child)', () => {
  it('should find all descendants recursively via CTE', () => {
    const cityId = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(locationTypeId, testCampaignId, 'City').lastInsertRowid)
    const districtId = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name, parent_entity_id) VALUES (?, ?, ?, ?)').run(locationTypeId, testCampaignId, 'District', cityId).lastInsertRowid)
    const tavernId = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name, parent_entity_id) VALUES (?, ?, ?, ?)').run(locationTypeId, testCampaignId, 'Tavern', districtId).lastInsertRowid)
    db.prepare('INSERT INTO entities (type_id, campaign_id, name, parent_entity_id) VALUES (?, ?, ?, ?)').run(locationTypeId, testCampaignId, 'Room', tavernId)

    const descendants = db.prepare(`
      WITH RECURSIVE children AS (
        SELECT id FROM entities WHERE parent_entity_id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT e.id FROM entities e INNER JOIN children c ON e.parent_entity_id = c.id WHERE e.deleted_at IS NULL
      )
      SELECT id FROM children
    `).all(cityId) as Array<{ id: number }>

    // District + Tavern + Room = 3 descendants
    expect(descendants).toHaveLength(3)
  })

  it('should archive all descendants when archiving parent', () => {
    const cityId = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(locationTypeId, testCampaignId, 'City').lastInsertRowid)
    const districtId = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name, parent_entity_id) VALUES (?, ?, ?, ?)').run(locationTypeId, testCampaignId, 'District', cityId).lastInsertRowid)
    db.prepare('INSERT INTO entities (type_id, campaign_id, name, parent_entity_id) VALUES (?, ?, ?, ?)').run(locationTypeId, testCampaignId, 'Tavern', districtId)

    // Simulate archive endpoint logic
    const descendants = db.prepare(`
      WITH RECURSIVE children AS (
        SELECT id FROM entities WHERE parent_entity_id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT e.id FROM entities e INNER JOIN children c ON e.parent_entity_id = c.id WHERE e.deleted_at IS NULL
      )
      SELECT id FROM children
    `).all(cityId) as Array<{ id: number }>

    const allIds = [cityId, ...descendants.map(d => d.id)]
    const placeholders = allIds.map(() => '?').join(',')
    db.prepare(`UPDATE entities SET archived_at = datetime('now') WHERE id IN (${placeholders})`).run(...allIds)

    const archived = db.prepare('SELECT name FROM entities WHERE campaign_id = ? AND archived_at IS NOT NULL ORDER BY name').all(testCampaignId) as Array<{ name: string }>
    expect(archived).toHaveLength(3)
    expect(archived.map(a => a.name)).toEqual(['City', 'District', 'Tavern'])
  })

  it('should unarchive all descendants when restoring parent', () => {
    const cityId = Number(db.prepare("INSERT INTO entities (type_id, campaign_id, name, archived_at) VALUES (?, ?, ?, datetime('now'))").run(locationTypeId, testCampaignId, 'City').lastInsertRowid)
    const districtId = Number(db.prepare("INSERT INTO entities (type_id, campaign_id, name, parent_entity_id, archived_at) VALUES (?, ?, ?, ?, datetime('now'))").run(locationTypeId, testCampaignId, 'District', cityId).lastInsertRowid)
    db.prepare("INSERT INTO entities (type_id, campaign_id, name, parent_entity_id, archived_at) VALUES (?, ?, ?, ?, datetime('now'))").run(locationTypeId, testCampaignId, 'Tavern', districtId)

    const descendants = db.prepare(`
      WITH RECURSIVE children AS (
        SELECT id FROM entities WHERE parent_entity_id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT e.id FROM entities e INNER JOIN children c ON e.parent_entity_id = c.id WHERE e.deleted_at IS NULL
      )
      SELECT id FROM children
    `).all(cityId) as Array<{ id: number }>

    const allIds = [cityId, ...descendants.map(d => d.id)]
    const placeholders = allIds.map(() => '?').join(',')
    db.prepare(`UPDATE entities SET archived_at = NULL WHERE id IN (${placeholders})`).run(...allIds)

    const active = db.prepare('SELECT * FROM entities WHERE campaign_id = ? AND archived_at IS NULL AND deleted_at IS NULL').all(testCampaignId)
    expect(active).toHaveLength(3)
  })

  it('should skip soft-deleted children in cascade', () => {
    const cityId = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(locationTypeId, testCampaignId, 'City').lastInsertRowid)
    db.prepare('INSERT INTO entities (type_id, campaign_id, name, parent_entity_id) VALUES (?, ?, ?, ?)').run(locationTypeId, testCampaignId, 'Active Child', cityId)
    db.prepare("INSERT INTO entities (type_id, campaign_id, name, parent_entity_id, deleted_at) VALUES (?, ?, ?, ?, datetime('now'))").run(locationTypeId, testCampaignId, 'Deleted Child', cityId)

    const descendants = db.prepare(`
      WITH RECURSIVE children AS (
        SELECT id FROM entities WHERE parent_entity_id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT e.id FROM entities e INNER JOIN children c ON e.parent_entity_id = c.id WHERE e.deleted_at IS NULL
      )
      SELECT id FROM children
    `).all(cityId) as Array<{ id: number }>

    expect(descendants).toHaveLength(1)
  })
})

describe('Archive - Relations remain visible', () => {
  it('should keep archived entities in relations', () => {
    const npcId = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(npcTypeId, testCampaignId, 'Hero').lastInsertRowid)
    const locId = Number(db.prepare("INSERT INTO entities (type_id, campaign_id, name, archived_at) VALUES (?, ?, ?, datetime('now'))").run(locationTypeId, testCampaignId, 'Old Tavern').lastInsertRowid)

    db.prepare('INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)').run(npcId, locId, 'visited')

    const relations = db.prepare(`
      SELECT e.name, e.archived_at
      FROM entity_relations er
      INNER JOIN entities e ON er.to_entity_id = e.id
      WHERE er.from_entity_id = ? AND e.deleted_at IS NULL
    `).all(npcId) as Array<{ name: string, archived_at: string | null }>

    expect(relations).toHaveLength(1)
    expect(relations[0]?.name).toBe('Old Tavern')
    expect(relations[0]?.archived_at).not.toBeNull()
  })
})
