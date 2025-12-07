import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Calendar Structure Validation Tests
// Tests for calendar structure change validation and fix APIs

let db: Database.Database
let testCampaignId: number

beforeAll(() => {
  db = getDb()

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Calendar Validation', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    // Clean up in correct order
    db.prepare('DELETE FROM calendar_event_entities WHERE event_id IN (SELECT id FROM calendar_events WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM calendar_events WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_seasons WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_moons WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_weekdays WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_months WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM calendar_config WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up calendar data before each test
  db.prepare('DELETE FROM calendar_event_entities WHERE event_id IN (SELECT id FROM calendar_events WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM calendar_events WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_seasons WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_moons WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_weekdays WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_months WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM calendar_config WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to set up months
function setupMonths(monthDays: number[]) {
  monthDays.forEach((days, index) => {
    db.prepare(`
      INSERT INTO calendar_months (campaign_id, name, days, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(testCampaignId, `Month ${index + 1}`, days, index + 1)
  })
}

// Helper to create an event
function createEvent(title: string, month: number, day: number, year?: number): number {
  const result = db
    .prepare(`
      INSERT INTO calendar_events (campaign_id, title, month, day, year, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(testCampaignId, title, month, day, year || null, 'custom')
  return Number(result.lastInsertRowid)
}

// Helper to create a session with in-game date
function createSession(title: string, dayStart: number | null, dayEnd: number | null): number {
  const result = db
    .prepare(`
      INSERT INTO sessions (campaign_id, title, in_game_day_start, in_game_day_end)
      VALUES (?, ?, ?, ?)
    `)
    .run(testCampaignId, title, dayStart, dayEnd)
  return Number(result.lastInsertRowid)
}

describe('Calendar Structure Validation - Month Deletion', () => {
  it('should detect events in deleted months', () => {
    // Setup: 12 months with 30 days each
    setupMonths([30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30])

    // Create event in month 12
    createEvent('Winter Festival', 12, 15)

    // Get current months
    const currentMonths = db
      .prepare('SELECT * FROM calendar_months WHERE campaign_id = ? ORDER BY sort_order')
      .all(testCampaignId) as Array<{ name: string; days: number; sort_order: number }>

    // Simulate new config with only 10 months
    const newMonths = currentMonths.slice(0, 10)

    // Validation logic
    const events = db
      .prepare(`
        SELECT id, title, month, day FROM calendar_events
        WHERE campaign_id = ? AND month IS NOT NULL
      `)
      .all(testCampaignId) as Array<{ id: number; title: string; month: number; day: number }>

    const affectedEvents = events.filter((evt) => evt.month > newMonths.length)

    expect(affectedEvents).toHaveLength(1)
    expect(affectedEvents[0].title).toBe('Winter Festival')
    expect(affectedEvents[0].month).toBe(12)
  })

  it('should not flag events in remaining months', () => {
    // Setup: 12 months
    setupMonths([30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30])

    // Create event in month 5
    createEvent('Spring Event', 5, 15)

    // Simulate new config with 10 months (5 is still valid)
    const newMonthCount = 10

    const events = db
      .prepare(`
        SELECT id, month FROM calendar_events
        WHERE campaign_id = ? AND month IS NOT NULL
      `)
      .all(testCampaignId) as Array<{ id: number; month: number }>

    const affectedEvents = events.filter((evt) => evt.month > newMonthCount)

    expect(affectedEvents).toHaveLength(0)
  })
})

describe('Calendar Structure Validation - Day Overflow', () => {
  it('should detect events on days that no longer exist', () => {
    // Setup: Month 2 has 30 days
    setupMonths([30, 30, 30])

    // Create event on day 28 of month 2
    createEvent('Late Month Event', 2, 28)

    // New config: Month 2 now only has 20 days
    const newMonthDays = [30, 20, 30]

    const events = db
      .prepare(`
        SELECT id, title, month, day FROM calendar_events
        WHERE campaign_id = ? AND month IS NOT NULL AND day IS NOT NULL
      `)
      .all(testCampaignId) as Array<{ id: number; title: string; month: number; day: number }>

    const affectedEvents = events.filter((evt) => {
      const maxDays = newMonthDays[evt.month - 1] || 30
      return evt.day > maxDays
    })

    expect(affectedEvents).toHaveLength(1)
    expect(affectedEvents[0].title).toBe('Late Month Event')
    expect(affectedEvents[0].day).toBe(28)
  })

  it('should not flag events on valid days', () => {
    // Setup: Month 2 has 30 days
    setupMonths([30, 30, 30])

    // Create event on day 15 of month 2
    createEvent('Mid Month Event', 2, 15)

    // New config: Month 2 reduced to 20 days (15 is still valid)
    const newMonthDays = [30, 20, 30]

    const events = db
      .prepare(`
        SELECT id, month, day FROM calendar_events
        WHERE campaign_id = ? AND month IS NOT NULL AND day IS NOT NULL
      `)
      .all(testCampaignId) as Array<{ id: number; month: number; day: number }>

    const affectedEvents = events.filter((evt) => {
      const maxDays = newMonthDays[evt.month - 1] || 30
      return evt.day > maxDays
    })

    expect(affectedEvents).toHaveLength(0)
  })
})

describe('Calendar Structure Validation - Session Impact', () => {
  it('should detect sessions affected by total days change', () => {
    // Setup: 12 months with 30 days = 360 days/year
    setupMonths([30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30])

    // Create session on absolute day 180 (month 6, day 30)
    createSession('Mid-year Session', 180, 185)

    // Calculate old total days
    const oldTotal = 360

    // New config: Only 10 months = 300 days/year
    const newTotal = 300

    const sessions = db
      .prepare(`
        SELECT id, title, in_game_day_start, in_game_day_end
        FROM sessions
        WHERE campaign_id = ? AND (in_game_day_start IS NOT NULL OR in_game_day_end IS NOT NULL)
      `)
      .all(testCampaignId) as Array<{ id: number; title: string; in_game_day_start: number | null; in_game_day_end: number | null }>

    // If total days changed, ALL sessions with dates are affected
    const affectedSessions = oldTotal !== newTotal ? sessions : []

    expect(affectedSessions).toHaveLength(1)
    expect(affectedSessions[0].title).toBe('Mid-year Session')
  })

  it('should not affect sessions when total days stays same', () => {
    // Setup: 12 months with 30 days = 360 days/year
    setupMonths([30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30])

    // Create session
    createSession('Stable Session', 100, 105)

    // New config: Same total (different distribution)
    const oldTotal = 360
    const newTotal = 360 // e.g., 10 x 36 days

    const sessions = db
      .prepare(`
        SELECT id FROM sessions
        WHERE campaign_id = ? AND (in_game_day_start IS NOT NULL OR in_game_day_end IS NOT NULL)
      `)
      .all(testCampaignId)

    const affectedSessions = oldTotal !== newTotal ? sessions : []

    expect(affectedSessions).toHaveLength(0)
  })

  it('should not count sessions without in-game dates', () => {
    // Setup months
    setupMonths([30, 30, 30])

    // Create session WITHOUT in-game dates
    createSession('Undated Session', null, null)

    const sessions = db
      .prepare(`
        SELECT id FROM sessions
        WHERE campaign_id = ? AND (in_game_day_start IS NOT NULL OR in_game_day_end IS NOT NULL)
      `)
      .all(testCampaignId)

    expect(sessions).toHaveLength(0)
  })
})

describe('Calendar Structure Fix - Event Relocation', () => {
  it('should move events from deleted months to last valid month', () => {
    // Setup: 12 months
    setupMonths([30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30])

    // Create event in month 12
    const eventId = createEvent('December Event', 12, 15)

    // Fix: New config has only 10 months
    const newMonthCount = 10
    const lastMonthDays = 30

    db.prepare(`
      UPDATE calendar_events
      SET month = ?, day = ?, updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = ? AND month > ?
    `).run(newMonthCount, lastMonthDays, testCampaignId, newMonthCount)

    const event = db
      .prepare('SELECT month, day FROM calendar_events WHERE id = ?')
      .get(eventId) as { month: number; day: number }

    expect(event.month).toBe(10)
    expect(event.day).toBe(30)
  })

  it('should move events with day overflow to last valid day', () => {
    // Setup: Month 2 has 30 days
    setupMonths([30, 30, 30])

    // Create event on day 28
    const eventId = createEvent('Day 28 Event', 2, 28)

    // Fix: Month 2 now has only 20 days
    const newMaxDays = 20

    db.prepare(`
      UPDATE calendar_events
      SET day = ?, updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = ? AND month = ? AND day > ?
    `).run(newMaxDays, testCampaignId, 2, newMaxDays)

    const event = db
      .prepare('SELECT month, day FROM calendar_events WHERE id = ?')
      .get(eventId) as { month: number; day: number }

    expect(event.month).toBe(2)
    expect(event.day).toBe(20)
  })
})

describe('Calendar Structure Fix - Session Reset', () => {
  it('should reset session in-game dates when structure changes', () => {
    // Setup months
    setupMonths([30, 30, 30])

    // Create session with dates
    const sessionId = createSession('Dated Session', 50, 55)

    // Verify dates are set
    const before = db
      .prepare('SELECT in_game_day_start, in_game_day_end FROM sessions WHERE id = ?')
      .get(sessionId) as { in_game_day_start: number; in_game_day_end: number }
    expect(before.in_game_day_start).toBe(50)
    expect(before.in_game_day_end).toBe(55)

    // Reset session dates
    db.prepare(`
      UPDATE sessions
      SET in_game_day_start = NULL, in_game_day_end = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sessionId)

    const after = db
      .prepare('SELECT in_game_day_start, in_game_day_end FROM sessions WHERE id = ?')
      .get(sessionId) as { in_game_day_start: number | null; in_game_day_end: number | null }

    expect(after.in_game_day_start).toBeNull()
    expect(after.in_game_day_end).toBeNull()
  })
})

describe('Calendar Seasons', () => {
  it('should create a season', () => {
    // First create months
    setupMonths([30, 30, 30, 30])

    const result = db
      .prepare(`
        INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, background_image)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(testCampaignId, 'Spring', 1, 1, 'spring.jpg')

    expect(result.changes).toBe(1)

    const season = db
      .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ?')
      .get(testCampaignId) as { name: string; start_month: number; start_day: number; background_image: string }

    expect(season.name).toBe('Spring')
    expect(season.start_month).toBe(1)
    expect(season.start_day).toBe(1)
    expect(season.background_image).toBe('spring.jpg')
  })

  it('should support multiple seasons', () => {
    setupMonths([30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30])

    const seasons = [
      { name: 'Spring', start_month: 3, start_day: 1, background: 'spring.jpg' },
      { name: 'Summer', start_month: 6, start_day: 1, background: 'summer.jpg' },
      { name: 'Autumn', start_month: 9, start_day: 1, background: 'autumn.jpg' },
      { name: 'Winter', start_month: 12, start_day: 1, background: 'winter.jpg' },
    ]

    seasons.forEach((s) => {
      db.prepare(`
        INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, background_image)
        VALUES (?, ?, ?, ?, ?)
      `).run(testCampaignId, s.name, s.start_month, s.start_day, s.background)
    })

    const storedSeasons = db
      .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ? ORDER BY start_month')
      .all(testCampaignId) as Array<{ name: string }>

    expect(storedSeasons).toHaveLength(4)
    expect(storedSeasons[0].name).toBe('Spring')
    expect(storedSeasons[3].name).toBe('Winter')
  })

  it('should delete seasons when campaign is deleted', () => {
    // Create a temp campaign
    const tempCampaign = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Temp Season Campaign')
    const tempCampaignId = Number(tempCampaign.lastInsertRowid)

    db.prepare(`
      INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day)
      VALUES (?, ?, ?, ?)
    `).run(tempCampaignId, 'Temp Season', 1, 1)

    // Verify season exists
    const before = db
      .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ?')
      .all(tempCampaignId)
    expect(before).toHaveLength(1)

    // Delete campaign (cascade should delete seasons)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(tempCampaignId)

    const after = db
      .prepare('SELECT * FROM calendar_seasons WHERE campaign_id = ?')
      .all(tempCampaignId)
    expect(after).toHaveLength(0)
  })
})

describe('Calendar Event - Multi-Entity Linking', () => {
  let npcTypeId: number
  let locationTypeId: number

  beforeAll(() => {
    const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
    npcTypeId = npcType.id
    const locationType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Location') as { id: number }
    locationTypeId = locationType.id
  })

  beforeEach(() => {
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  })

  afterAll(() => {
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
  })

  it('should link multiple entities to an event', () => {
    // Create entities
    const npc1 = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Hero')
    const npc2 = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Villain')
    const location = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(locationTypeId, testCampaignId, 'Battle Arena')

    // Create event
    const eventId = createEvent('Epic Battle', 6, 15)

    // Link entities to event
    db.prepare('INSERT INTO calendar_event_entities (event_id, entity_id) VALUES (?, ?)').run(eventId, npc1.lastInsertRowid)
    db.prepare('INSERT INTO calendar_event_entities (event_id, entity_id) VALUES (?, ?)').run(eventId, npc2.lastInsertRowid)
    db.prepare('INSERT INTO calendar_event_entities (event_id, entity_id) VALUES (?, ?)').run(eventId, location.lastInsertRowid)

    const linkedEntities = db
      .prepare(`
        SELECT cee.entity_id, e.name, et.name as entity_type
        FROM calendar_event_entities cee
        JOIN entities e ON e.id = cee.entity_id
        JOIN entity_types et ON et.id = e.type_id
        WHERE cee.event_id = ?
      `)
      .all(eventId) as Array<{ entity_id: number; name: string; entity_type: string }>

    expect(linkedEntities).toHaveLength(3)
    expect(linkedEntities.map((e) => e.name)).toContain('Hero')
    expect(linkedEntities.map((e) => e.name)).toContain('Villain')
    expect(linkedEntities.map((e) => e.name)).toContain('Battle Arena')
  })

  it('should remove entity links when event is deleted', () => {
    const npc = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Test NPC')

    const eventId = createEvent('Test Event', 1, 1)

    db.prepare('INSERT INTO calendar_event_entities (event_id, entity_id) VALUES (?, ?)')
      .run(eventId, npc.lastInsertRowid)

    // Verify link exists
    const before = db
      .prepare('SELECT * FROM calendar_event_entities WHERE event_id = ?')
      .all(eventId)
    expect(before).toHaveLength(1)

    // Delete event
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId)

    // Verify link is removed (cascade delete)
    const after = db
      .prepare('SELECT * FROM calendar_event_entities WHERE event_id = ?')
      .all(eventId)
    expect(after).toHaveLength(0)
  })

  it('should remove entity link when entity is deleted', () => {
    const npc = db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
      .run(npcTypeId, testCampaignId, 'Deletable NPC')
    const npcId = Number(npc.lastInsertRowid)

    const eventId = createEvent('Linked Event', 1, 1)

    db.prepare('INSERT INTO calendar_event_entities (event_id, entity_id) VALUES (?, ?)')
      .run(eventId, npcId)

    // Verify link exists
    const before = db
      .prepare('SELECT * FROM calendar_event_entities WHERE event_id = ?')
      .all(eventId)
    expect(before).toHaveLength(1)

    // Delete entity
    db.prepare('DELETE FROM entities WHERE id = ?').run(npcId)

    // Verify link is removed (cascade delete)
    const after = db
      .prepare('SELECT * FROM calendar_event_entities WHERE event_id = ?')
      .all(eventId)
    expect(after).toHaveLength(0)
  })
})

describe('Calendar - Set as Today', () => {
  it('should update current date in config', () => {
    // Create config
    db.prepare(`
      INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day)
      VALUES (?, ?, ?, ?)
    `).run(testCampaignId, 1352, 3, 15)

    // Set new "today"
    db.prepare(`
      UPDATE calendar_config
      SET current_year = ?, current_month = ?, current_day = ?
      WHERE campaign_id = ?
    `).run(1352, 6, 20, testCampaignId)

    const config = db
      .prepare('SELECT current_year, current_month, current_day FROM calendar_config WHERE campaign_id = ?')
      .get(testCampaignId) as { current_year: number; current_month: number; current_day: number }

    expect(config.current_year).toBe(1352)
    expect(config.current_month).toBe(6)
    expect(config.current_day).toBe(20)
  })

  it('should allow setting date in the past', () => {
    // Create config with current date in "future"
    db.prepare(`
      INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day)
      VALUES (?, ?, ?, ?)
    `).run(testCampaignId, 1352, 12, 25)

    // Set "today" to earlier date (going back in time)
    db.prepare(`
      UPDATE calendar_config
      SET current_year = ?, current_month = ?, current_day = ?
      WHERE campaign_id = ?
    `).run(1352, 1, 1, testCampaignId)

    const config = db
      .prepare('SELECT current_year, current_month, current_day FROM calendar_config WHERE campaign_id = ?')
      .get(testCampaignId) as { current_year: number; current_month: number; current_day: number }

    expect(config.current_year).toBe(1352)
    expect(config.current_month).toBe(1)
    expect(config.current_day).toBe(1)
  })
})
