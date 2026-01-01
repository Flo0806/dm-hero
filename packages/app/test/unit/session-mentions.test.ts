import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import { syncSessionMentions } from '../../server/utils/extract-mentions'
import type Database from 'better-sqlite3'

/**
 * Tests for syncSessionMentions - DB integration tests.
 * Tests the syncing of entity mentions from session notes to session_mentions table.
 */

let db: Database.Database
let testCampaignId: number
let testSessionId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get NPC type ID
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Mentions', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    // Clean up in order (foreign key constraints)
    db.prepare('DELETE FROM session_mentions WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up mentions and sessions before each test
  db.prepare('DELETE FROM session_mentions WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)

  // Create a test session
  const session = db
    .prepare('INSERT INTO sessions (campaign_id, title, notes, session_number, date) VALUES (?, ?, ?, ?, ?)')
    .run(testCampaignId, 'Test Session', '', 1, '2025-01-01')
  testSessionId = Number(session.lastInsertRowid)
})

// Helper to create an entity
function createEntity(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

// Helper to get mentions for a session
function getMentions(): Array<{ entity_id: number; context: string }> {
  return db
    .prepare('SELECT entity_id, context FROM session_mentions WHERE session_id = ?')
    .all(testSessionId) as Array<{ entity_id: number; context: string }>
}

describe('syncSessionMentions - Adding Mentions', () => {
  it('should add mentions from notes', () => {
    const npc1 = createEntity('Hero')
    const npc2 = createEntity('Villain')

    const notes = `Met {{npc:${npc1}}} and fought {{npc:${npc2}}}.`
    syncSessionMentions(db, testSessionId, notes)

    const mentions = getMentions()
    expect(mentions).toHaveLength(2)
    expect(mentions.map((m) => m.entity_id)).toContain(npc1)
    expect(mentions.map((m) => m.entity_id)).toContain(npc2)
  })

  it('should store entity type as context', () => {
    const npcId = createEntity('Test NPC')

    const notes = `Met {{npc:${npcId}}}.`
    syncSessionMentions(db, testSessionId, notes)

    const mentions = getMentions()
    expect(mentions).toHaveLength(1)
    expect(mentions[0]!.context).toBe('npc')
  })

  it('should handle empty notes', () => {
    syncSessionMentions(db, testSessionId, '')
    expect(getMentions()).toHaveLength(0)
  })

  it('should handle null notes', () => {
    syncSessionMentions(db, testSessionId, null)
    expect(getMentions()).toHaveLength(0)
  })
})

describe('syncSessionMentions - Removing Mentions', () => {
  it('should remove mentions that are no longer in notes', () => {
    const npc1 = createEntity('NPC One')
    const npc2 = createEntity('NPC Two')

    // First sync with both mentions
    const notes1 = `{{npc:${npc1}}} and {{npc:${npc2}}}`
    syncSessionMentions(db, testSessionId, notes1)
    expect(getMentions()).toHaveLength(2)

    // Second sync with only one mention
    const notes2 = `Only {{npc:${npc1}}} now`
    syncSessionMentions(db, testSessionId, notes2)

    const mentions = getMentions()
    expect(mentions).toHaveLength(1)
    expect(mentions[0]!.entity_id).toBe(npc1)
  })

  it('should remove all mentions when notes are cleared', () => {
    const npcId = createEntity('Some NPC')

    // Add mention
    syncSessionMentions(db, testSessionId, `{{npc:${npcId}}}`)
    expect(getMentions()).toHaveLength(1)

    // Clear notes
    syncSessionMentions(db, testSessionId, 'No mentions here.')
    expect(getMentions()).toHaveLength(0)
  })
})

describe('syncSessionMentions - Validation', () => {
  it('should NOT add mentions for non-existent entities', () => {
    const notes = '{{npc:999999}}' // ID that doesn't exist
    syncSessionMentions(db, testSessionId, notes)

    expect(getMentions()).toHaveLength(0)
  })

  it('should NOT add mentions for soft-deleted entities', () => {
    const npcId = createEntity('Deleted NPC')

    // Soft-delete the entity
    db.prepare('UPDATE entities SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(npcId)

    const notes = `{{npc:${npcId}}}`
    syncSessionMentions(db, testSessionId, notes)

    expect(getMentions()).toHaveLength(0)
  })

  it('should only add valid mentions, skip invalid ones', () => {
    const validNpc = createEntity('Valid NPC')

    const notes = `{{npc:${validNpc}}} and {{npc:888888}}`
    syncSessionMentions(db, testSessionId, notes)

    const mentions = getMentions()
    expect(mentions).toHaveLength(1)
    expect(mentions[0]!.entity_id).toBe(validNpc)
  })
})

describe('syncSessionMentions - Deduplication', () => {
  it('should not create duplicate mentions', () => {
    const npcId = createEntity('Repeated NPC')

    // Sync twice with same mention
    const notes = `{{npc:${npcId}}} appears again {{npc:${npcId}}}`
    syncSessionMentions(db, testSessionId, notes)
    syncSessionMentions(db, testSessionId, notes) // Second sync

    // Should still only have one mention (INSERT OR IGNORE)
    expect(getMentions()).toHaveLength(1)
  })
})

describe('syncSessionMentions - Mixed Operations', () => {
  it('should handle add and remove in same sync', () => {
    const npc1 = createEntity('NPC A')
    const npc2 = createEntity('NPC B')
    const npc3 = createEntity('NPC C')

    // Initial: A and B
    syncSessionMentions(db, testSessionId, `{{npc:${npc1}}} {{npc:${npc2}}}`)
    expect(getMentions()).toHaveLength(2)

    // Update: B and C (remove A, add C)
    syncSessionMentions(db, testSessionId, `{{npc:${npc2}}} {{npc:${npc3}}}`)

    const mentions = getMentions()
    expect(mentions).toHaveLength(2)
    expect(mentions.map((m) => m.entity_id)).toContain(npc2)
    expect(mentions.map((m) => m.entity_id)).toContain(npc3)
    expect(mentions.map((m) => m.entity_id)).not.toContain(npc1)
  })
})
