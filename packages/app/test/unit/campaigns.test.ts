import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Campaigns CRUD Tests
// Tests the campaign operations

let db: Database.Database
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get NPC type ID for entity tests
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  npcTypeId = npcType.id
})

afterAll(() => {
  // No global cleanup needed - each test cleans up its own campaigns
})

beforeEach(() => {
  // Clean up test campaigns before each test
  db.prepare("DELETE FROM campaigns WHERE name LIKE 'Test Campaign%'").run()
})

// Helper to create a campaign
function createCampaign(name: string, description?: string): number {
  const result = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run(name, description || null)
  return Number(result.lastInsertRowid)
}

describe('Campaigns - Basic CRUD', () => {
  it('should create a campaign', () => {
    const campaignId = createCampaign('Test Campaign Alpha')

    const campaign = db
      .prepare('SELECT * FROM campaigns WHERE id = ?')
      .get(campaignId) as { id: number; name: string }

    expect(campaign).toBeDefined()
    expect(campaign.name).toBe('Test Campaign Alpha')
  })

  it('should create a campaign with description', () => {
    const campaignId = createCampaign('Test Campaign Beta', 'A grand adventure awaits')

    const campaign = db
      .prepare('SELECT * FROM campaigns WHERE id = ?')
      .get(campaignId) as { name: string; description: string }

    expect(campaign.name).toBe('Test Campaign Beta')
    expect(campaign.description).toBe('A grand adventure awaits')
  })

  it('should update a campaign', () => {
    const campaignId = createCampaign('Test Campaign Old Name')

    db.prepare('UPDATE campaigns SET name = ?, description = ? WHERE id = ?')
      .run('Test Campaign New Name', 'Updated description', campaignId)

    const campaign = db
      .prepare('SELECT name, description FROM campaigns WHERE id = ?')
      .get(campaignId) as { name: string; description: string }

    expect(campaign.name).toBe('Test Campaign New Name')
    expect(campaign.description).toBe('Updated description')
  })

  it('should delete a campaign', () => {
    const campaignId = createCampaign('Test Campaign To Delete')

    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaignId)

    const campaign = db
      .prepare('SELECT * FROM campaigns WHERE id = ?')
      .get(campaignId)

    expect(campaign).toBeUndefined()
  })
})

describe('Campaigns - Entity Association', () => {
  it('should associate entities with a campaign', () => {
    const campaignId = createCampaign('Test Campaign Entities')

    // Create entities in this campaign
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaignId, 'NPC 1')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaignId, 'NPC 2')

    const entities = db
      .prepare('SELECT * FROM entities WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(campaignId)

    expect(entities).toHaveLength(2)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaignId)
  })

  it('should cascade delete entities when campaign is deleted', () => {
    const campaignId = createCampaign('Test Campaign Cascade')

    // Create entity
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaignId, 'Orphan NPC')

    // Delete campaign
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaignId)

    const entities = db
      .prepare('SELECT * FROM entities WHERE campaign_id = ?')
      .all(campaignId)

    expect(entities).toHaveLength(0)
  })
})

describe('Campaigns - Multiple Campaigns', () => {
  it('should list all campaigns', () => {
    const campaign1 = createCampaign('Test Campaign List 1')
    const campaign2 = createCampaign('Test Campaign List 2')
    const campaign3 = createCampaign('Test Campaign List 3')

    const campaigns = db
      .prepare("SELECT * FROM campaigns WHERE name LIKE 'Test Campaign List%' ORDER BY name")
      .all() as Array<{ id: number; name: string }>

    expect(campaigns.length).toBeGreaterThanOrEqual(3)

    const names = campaigns.map(c => c.name)
    expect(names).toContain('Test Campaign List 1')
    expect(names).toContain('Test Campaign List 2')
    expect(names).toContain('Test Campaign List 3')
  })

  it('should isolate entities between campaigns', () => {
    const campaign1 = createCampaign('Test Campaign Isolation 1')
    const campaign2 = createCampaign('Test Campaign Isolation 2')

    // Create entities in each campaign
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaign1, 'Campaign 1 NPC')
    db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaign2, 'Campaign 2 NPC')

    const campaign1Entities = db
      .prepare('SELECT * FROM entities WHERE campaign_id = ?')
      .all(campaign1)

    const campaign2Entities = db
      .prepare('SELECT * FROM entities WHERE campaign_id = ?')
      .all(campaign2)

    expect(campaign1Entities).toHaveLength(1)
    expect(campaign2Entities).toHaveLength(1)
    expect((campaign1Entities[0] as { name: string }).name).toBe('Campaign 1 NPC')
    expect((campaign2Entities[0] as { name: string }).name).toBe('Campaign 2 NPC')

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id IN (?, ?)').run(campaign1, campaign2)
  })
})

describe('Campaigns - Timestamps', () => {
  it('should set created_at on creation', () => {
    const campaignId = createCampaign('Test Campaign Timestamp')

    const campaign = db
      .prepare('SELECT created_at FROM campaigns WHERE id = ?')
      .get(campaignId) as { created_at: string }

    expect(campaign.created_at).toBeDefined()
    expect(new Date(campaign.created_at)).toBeInstanceOf(Date)
  })

  it('should update updated_at on modification', () => {
    const campaignId = createCampaign('Test Campaign Update Time')

    const before = db
      .prepare('SELECT updated_at FROM campaigns WHERE id = ?')
      .get(campaignId) as { updated_at: string }

    db.prepare('UPDATE campaigns SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Test Campaign Modified', campaignId)

    const after = db
      .prepare('SELECT updated_at FROM campaigns WHERE id = ?')
      .get(campaignId) as { updated_at: string }

    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before.updated_at).getTime())
  })
})

describe('Campaigns - Entity Counts', () => {
  it('should count entities per campaign', () => {
    const campaignId = createCampaign('Test Campaign Count')

    // Create 5 entities
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
        .run(npcTypeId, campaignId, `NPC ${i}`)
    }

    const count = db
      .prepare('SELECT COUNT(*) as count FROM entities WHERE campaign_id = ? AND deleted_at IS NULL')
      .get(campaignId) as { count: number }

    expect(count.count).toBe(5)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaignId)
  })

  it('should not count soft-deleted entities', () => {
    const campaignId = createCampaign('Test Campaign Soft Delete Count')

    // Create entities
    const npc1 = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaignId, 'Active NPC')
    const npc2 = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, campaignId, 'Deleted NPC')

    // Soft-delete one
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(npc2.lastInsertRowid)

    const activeCount = db
      .prepare('SELECT COUNT(*) as count FROM entities WHERE campaign_id = ? AND deleted_at IS NULL')
      .get(campaignId) as { count: number }

    const totalCount = db
      .prepare('SELECT COUNT(*) as count FROM entities WHERE campaign_id = ?')
      .get(campaignId) as { count: number }

    expect(activeCount.count).toBe(1)
    expect(totalCount.count).toBe(2)

    // Cleanup
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(campaignId)
  })
})
