import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Calendar Events Tests
// Tests for campaign calendar events

let db: Database.Database
let testCampaignId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get NPC type ID
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Calendar', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM calendar_events WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM calendar_events WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create an event
function createEvent(title: string, month: number, day: number, options?: {
  year?: number
  description?: string
  eventType?: string
  entityId?: number
  isRecurring?: boolean
  color?: string
}): number {
  const result = db
    .prepare(`
      INSERT INTO calendar_events (campaign_id, title, description, event_type, year, month, day, is_recurring, entity_id, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      testCampaignId,
      title,
      options?.description || null,
      options?.eventType || 'custom',
      options?.year || null,
      month,
      day,
      options?.isRecurring ? 1 : 0,
      options?.entityId || null,
      options?.color || null
    )
  return Number(result.lastInsertRowid)
}

// Helper to create an entity
function createEntity(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

describe('Calendar Events - Basic CRUD', () => {
  it('should create a calendar event', () => {
    const eventId = createEvent('Festival of Lights', 6, 15)

    const event = db
      .prepare('SELECT * FROM calendar_events WHERE id = ?')
      .get(eventId) as { id: number; title: string; month: number; day: number }

    expect(event).toBeDefined()
    expect(event.title).toBe('Festival of Lights')
    expect(event.month).toBe(6)
    expect(event.day).toBe(15)
  })

  it('should create an event with all fields', () => {
    const eventId = createEvent('Dragon Attack', 3, 21, {
      year: 1492,
      description: 'The dragon attacked the village',
      eventType: 'historical',
      isRecurring: false,
      color: '#FF5733'
    })

    const event = db
      .prepare('SELECT * FROM calendar_events WHERE id = ?')
      .get(eventId) as {
        title: string
        year: number
        month: number
        day: number
        description: string
        event_type: string
        is_recurring: number
        color: string
      }

    expect(event.title).toBe('Dragon Attack')
    expect(event.year).toBe(1492)
    expect(event.description).toBe('The dragon attacked the village')
    expect(event.event_type).toBe('historical')
    expect(event.is_recurring).toBe(0)
    expect(event.color).toBe('#FF5733')
  })

  it('should update an event', () => {
    const eventId = createEvent('Original Event', 1, 1)

    db.prepare('UPDATE calendar_events SET title = ?, description = ?, month = ?, day = ? WHERE id = ?')
      .run('Updated Event', 'New description', 2, 15, eventId)

    const event = db
      .prepare('SELECT title, description, month, day FROM calendar_events WHERE id = ?')
      .get(eventId) as { title: string; description: string; month: number; day: number }

    expect(event.title).toBe('Updated Event')
    expect(event.description).toBe('New description')
    expect(event.month).toBe(2)
    expect(event.day).toBe(15)
  })

  it('should delete an event', () => {
    const eventId = createEvent('To Delete', 5, 5)

    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId)

    const event = db
      .prepare('SELECT * FROM calendar_events WHERE id = ?')
      .get(eventId)

    expect(event).toBeUndefined()
  })
})

describe('Calendar Events - Event Types', () => {
  it('should categorize events by type', () => {
    createEvent('Birthday', 1, 15, { eventType: 'birthday' })
    createEvent('Holiday', 12, 25, { eventType: 'holiday' })
    createEvent('Battle', 6, 1, { eventType: 'historical' })
    createEvent('Meeting', 3, 10, { eventType: 'custom' })

    const holidays = db
      .prepare("SELECT * FROM calendar_events WHERE campaign_id = ? AND event_type = ?")
      .all(testCampaignId, 'holiday')

    const historical = db
      .prepare("SELECT * FROM calendar_events WHERE campaign_id = ? AND event_type = ?")
      .all(testCampaignId, 'historical')

    expect(holidays).toHaveLength(1)
    expect(historical).toHaveLength(1)
  })
})

describe('Calendar Events - Recurring Events', () => {
  it('should mark events as recurring', () => {
    const eventId = createEvent('Annual Festival', 7, 4, { isRecurring: true })

    const event = db
      .prepare('SELECT is_recurring FROM calendar_events WHERE id = ?')
      .get(eventId) as { is_recurring: number }

    expect(event.is_recurring).toBe(1)
  })

  it('should find all recurring events', () => {
    createEvent('New Year', 1, 1, { isRecurring: true })
    createEvent('Harvest Festival', 9, 21, { isRecurring: true })
    createEvent('One-time Event', 5, 5, { isRecurring: false })

    const recurringEvents = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ? AND is_recurring = 1')
      .all(testCampaignId)

    expect(recurringEvents).toHaveLength(2)
  })
})

describe('Calendar Events - Date Queries', () => {
  it('should find events for a specific month', () => {
    createEvent('March Event 1', 3, 5)
    createEvent('March Event 2', 3, 15)
    createEvent('April Event', 4, 10)

    const marchEvents = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ? AND month = ?')
      .all(testCampaignId, 3)

    expect(marchEvents).toHaveLength(2)
  })

  it('should find events for a specific day', () => {
    createEvent('Event A', 6, 15)
    createEvent('Event B', 6, 15)
    createEvent('Event C', 6, 16)

    const june15Events = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ? AND month = ? AND day = ?')
      .all(testCampaignId, 6, 15)

    expect(june15Events).toHaveLength(2)
  })

  it('should find events for a specific year', () => {
    createEvent('Year 1492 Event', 5, 1, { year: 1492 })
    createEvent('Year 1493 Event', 5, 1, { year: 1493 })
    createEvent('Yearly Event', 5, 1, { year: null, isRecurring: true })

    const year1492 = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ? AND year = ?')
      .all(testCampaignId, 1492)

    expect(year1492).toHaveLength(1)
  })
})

describe('Calendar Events - Entity Linking', () => {
  it('should link event to entity', () => {
    const entityId = createEntity('King Arthur')
    const eventId = createEvent('Coronation of King Arthur', 6, 21, { entityId })

    const event = db
      .prepare('SELECT entity_id FROM calendar_events WHERE id = ?')
      .get(eventId) as { entity_id: number }

    expect(event.entity_id).toBe(entityId)
  })

  it('should get event with entity info', () => {
    const entityId = createEntity('Queen Guinevere')
    createEvent('Birthday of the Queen', 3, 15, { entityId, eventType: 'birthday' })

    const result = db
      .prepare(`
        SELECT ce.*, e.name as entity_name
        FROM calendar_events ce
        LEFT JOIN entities e ON e.id = ce.entity_id
        WHERE ce.campaign_id = ? AND ce.entity_id IS NOT NULL
      `)
      .get(testCampaignId) as { title: string; entity_name: string }

    expect(result.title).toBe('Birthday of the Queen')
    expect(result.entity_name).toBe('Queen Guinevere')
  })

  it('should find all events for an entity', () => {
    const entityId = createEntity('Merlin')

    createEvent('Merlin Born', 1, 1, { entityId, eventType: 'birthday' })
    createEvent('Merlin Became Advisor', 6, 15, { entityId })
    createEvent('Unrelated Event', 12, 25)

    const merlinEvents = db
      .prepare('SELECT * FROM calendar_events WHERE entity_id = ?')
      .all(entityId)

    expect(merlinEvents).toHaveLength(2)
  })

  it('should set entity_id to NULL when entity is deleted', () => {
    const entityId = createEntity('Temporary NPC')
    const eventId = createEvent('NPC Event', 5, 5, { entityId })

    // Verify entity_id is set
    const before = db
      .prepare('SELECT entity_id FROM calendar_events WHERE id = ?')
      .get(eventId) as { entity_id: number }
    expect(before.entity_id).toBe(entityId)

    // Delete entity (ON DELETE SET NULL)
    db.prepare('DELETE FROM entities WHERE id = ?').run(entityId)

    const after = db
      .prepare('SELECT entity_id FROM calendar_events WHERE id = ?')
      .get(eventId) as { entity_id: number | null }
    expect(after.entity_id).toBeNull()
  })
})

describe('Calendar Events - Campaign Isolation', () => {
  it('should only return events from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create events in both campaigns
    createEvent('Test Campaign Event', 1, 1)
    db.prepare('INSERT INTO calendar_events (campaign_id, title, month, day) VALUES (?, ?, ?, ?)')
      .run(campaign2Id, 'Campaign 2 Event', 1, 1)

    const testCampaignEvents = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ?')
      .all(testCampaignId)

    const campaign2Events = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ?')
      .all(campaign2Id)

    expect(testCampaignEvents).toHaveLength(1)
    expect(campaign2Events).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM calendar_events WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Calendar Events - Cascade Delete', () => {
  it('should delete events when campaign is deleted', () => {
    // Create a separate campaign for this test
    const tempCampaign = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Temp Campaign')
    const tempCampaignId = Number(tempCampaign.lastInsertRowid)

    db.prepare('INSERT INTO calendar_events (campaign_id, title, month, day) VALUES (?, ?, ?, ?)')
      .run(tempCampaignId, 'Temp Event', 1, 1)

    // Verify event exists
    const before = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ?')
      .all(tempCampaignId)
    expect(before).toHaveLength(1)

    // Delete campaign (cascade should delete events)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(tempCampaignId)

    const after = db
      .prepare('SELECT * FROM calendar_events WHERE campaign_id = ?')
      .all(tempCampaignId)
    expect(after).toHaveLength(0)
  })
})

describe('Calendar Events - Timestamps', () => {
  it('should set created_at on creation', () => {
    const eventId = createEvent('Timestamp Event', 1, 1)

    const event = db
      .prepare('SELECT created_at FROM calendar_events WHERE id = ?')
      .get(eventId) as { created_at: string }

    expect(event.created_at).toBeDefined()
    expect(new Date(event.created_at)).toBeInstanceOf(Date)
  })

  it('should update updated_at on modification', () => {
    const eventId = createEvent('Update Time Event', 1, 1)

    const before = db
      .prepare('SELECT updated_at FROM calendar_events WHERE id = ?')
      .get(eventId) as { updated_at: string }

    db.prepare('UPDATE calendar_events SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Modified', eventId)

    const after = db
      .prepare('SELECT updated_at FROM calendar_events WHERE id = ?')
      .get(eventId) as { updated_at: string }

    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before.updated_at).getTime())
  })
})
