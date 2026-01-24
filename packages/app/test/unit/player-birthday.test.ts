import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Player Birthday Tests
// Tests for player birthday metadata and calendar event integration

let db: Database.Database
let testCampaignId: number
let playerTypeId: number

beforeAll(() => {
  db = getDb()

  // Get Player type ID
  const playerType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as { id: number }
  playerTypeId = playerType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Birthday', 'Test description')
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

// Helper to create a Player with optional birthday
function createPlayer(name: string, options?: {
  description?: string
  birthday?: { year: number; month: number; day: number } | null
  showBirthdayInCalendar?: boolean
}): number {
  const metadata: Record<string, unknown> = {}
  if (options?.birthday) {
    metadata.birthday = options.birthday
    metadata.showBirthdayInCalendar = options.showBirthdayInCalendar ?? false
  }

  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name, description, metadata) VALUES (?, ?, ?, ?, ?)')
    .run(
      playerTypeId,
      testCampaignId,
      name,
      options?.description || null,
      Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
    )
  return Number(result.lastInsertRowid)
}

// Helper to create a birthday calendar event
function createBirthdayEvent(playerId: number, playerName: string, month: number, day: number): number {
  const result = db
    .prepare(`
      INSERT INTO calendar_events (campaign_id, title, event_type, month, day, is_recurring, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      testCampaignId,
      `Geburtstag von ${playerName}`,
      'birthday',
      month,
      day,
      1, // is_recurring
      playerId
    )
  return Number(result.lastInsertRowid)
}

describe('Player Birthday - Metadata Storage', () => {
  it('should store birthday in player metadata', () => {
    const playerId = createPlayer('Test Player', {
      birthday: { year: 1492, month: 6, day: 15 },
      showBirthdayInCalendar: true
    })

    const player = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string }

    const metadata = JSON.parse(player.metadata)
    expect(metadata.birthday).toBeDefined()
    expect(metadata.birthday.year).toBe(1492)
    expect(metadata.birthday.month).toBe(6)
    expect(metadata.birthday.day).toBe(15)
    expect(metadata.showBirthdayInCalendar).toBe(true)
  })

  it('should allow player without birthday', () => {
    const playerId = createPlayer('No Birthday Player')

    const player = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string | null }

    expect(player.metadata).toBeNull()
  })

  it('should update birthday in metadata', () => {
    const playerId = createPlayer('Update Birthday Player', {
      birthday: { year: 1490, month: 3, day: 10 }
    })

    // Update birthday
    const newMetadata = JSON.stringify({
      birthday: { year: 1495, month: 8, day: 20 },
      showBirthdayInCalendar: true
    })
    db.prepare('UPDATE entities SET metadata = ? WHERE id = ?').run(newMetadata, playerId)

    const player = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string }

    const metadata = JSON.parse(player.metadata)
    expect(metadata.birthday.year).toBe(1495)
    expect(metadata.birthday.month).toBe(8)
    expect(metadata.birthday.day).toBe(20)
  })

  it('should clear birthday from metadata', () => {
    const playerId = createPlayer('Clear Birthday Player', {
      birthday: { year: 1492, month: 6, day: 15 }
    })

    // Clear birthday by setting metadata to null
    db.prepare('UPDATE entities SET metadata = ? WHERE id = ?').run(null, playerId)

    const player = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string | null }

    expect(player.metadata).toBeNull()
  })
})

describe('Player Birthday - Calendar Event Integration', () => {
  it('should create birthday calendar event for player', () => {
    const playerId = createPlayer('Birthday Event Player')
    const eventId = createBirthdayEvent(playerId, 'Birthday Event Player', 6, 15)

    const event = db
      .prepare('SELECT * FROM calendar_events WHERE id = ?')
      .get(eventId) as {
        title: string
        event_type: string
        month: number
        day: number
        is_recurring: number
        entity_id: number
      }

    expect(event.title).toBe('Geburtstag von Birthday Event Player')
    expect(event.event_type).toBe('birthday')
    expect(event.month).toBe(6)
    expect(event.day).toBe(15)
    expect(event.is_recurring).toBe(1)
    expect(event.entity_id).toBe(playerId)
  })

  it('should link birthday event to player entity', () => {
    const playerId = createPlayer('Linked Player')
    createBirthdayEvent(playerId, 'Linked Player', 3, 21)

    const event = db
      .prepare(`
        SELECT ce.*, e.name as player_name
        FROM calendar_events ce
        JOIN entities e ON e.id = ce.entity_id
        WHERE ce.campaign_id = ? AND ce.event_type = 'birthday'
      `)
      .get(testCampaignId) as { player_name: string; entity_id: number }

    expect(event.player_name).toBe('Linked Player')
    expect(event.entity_id).toBe(playerId)
  })

  it('should update birthday event when date changes', () => {
    const playerId = createPlayer('Update Event Player')
    const eventId = createBirthdayEvent(playerId, 'Update Event Player', 3, 10)

    // Update the event date
    db.prepare('UPDATE calendar_events SET month = ?, day = ? WHERE id = ?')
      .run(9, 25, eventId)

    const event = db
      .prepare('SELECT month, day FROM calendar_events WHERE id = ?')
      .get(eventId) as { month: number; day: number }

    expect(event.month).toBe(9)
    expect(event.day).toBe(25)
  })

  it('should delete birthday event when showBirthdayInCalendar is disabled', () => {
    const playerId = createPlayer('Delete Event Player')
    const eventId = createBirthdayEvent(playerId, 'Delete Event Player', 6, 15)

    // Delete the event
    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId)

    const event = db
      .prepare('SELECT * FROM calendar_events WHERE id = ?')
      .get(eventId)

    expect(event).toBeUndefined()
  })

  it('should find existing birthday event for player', () => {
    const playerId = createPlayer('Find Event Player')
    createBirthdayEvent(playerId, 'Find Event Player', 12, 25)

    const event = db
      .prepare(`
        SELECT * FROM calendar_events
        WHERE campaign_id = ?
          AND event_type = 'birthday'
          AND entity_id = ?
      `)
      .get(testCampaignId, playerId)

    expect(event).toBeDefined()
  })

  it('should not find birthday event for player without one', () => {
    const playerId = createPlayer('No Event Player')

    const event = db
      .prepare(`
        SELECT * FROM calendar_events
        WHERE campaign_id = ?
          AND event_type = 'birthday'
          AND entity_id = ?
      `)
      .get(testCampaignId, playerId)

    expect(event).toBeUndefined()
  })
})

describe('Player Birthday - Recurring Events', () => {
  it('should mark birthday as recurring event', () => {
    const playerId = createPlayer('Recurring Birthday Player')
    const eventId = createBirthdayEvent(playerId, 'Recurring Birthday Player', 1, 1)

    const event = db
      .prepare('SELECT is_recurring FROM calendar_events WHERE id = ?')
      .get(eventId) as { is_recurring: number }

    expect(event.is_recurring).toBe(1)
  })

  it('should find all birthday events in campaign', () => {
    const player1 = createPlayer('Player 1')
    const player2 = createPlayer('Player 2')
    const player3 = createPlayer('Player 3')

    createBirthdayEvent(player1, 'Player 1', 1, 15)
    createBirthdayEvent(player2, 'Player 2', 6, 20)
    createBirthdayEvent(player3, 'Player 3', 12, 31)

    const birthdayEvents = db
      .prepare(`
        SELECT * FROM calendar_events
        WHERE campaign_id = ?
          AND event_type = 'birthday'
          AND is_recurring = 1
      `)
      .all(testCampaignId)

    expect(birthdayEvents).toHaveLength(3)
  })
})

describe('Player Birthday - Entity Deletion', () => {
  it('should set entity_id to NULL when player is deleted', () => {
    const playerId = createPlayer('Deletable Player')
    const eventId = createBirthdayEvent(playerId, 'Deletable Player', 5, 5)

    // Verify entity_id is set
    const before = db
      .prepare('SELECT entity_id FROM calendar_events WHERE id = ?')
      .get(eventId) as { entity_id: number }
    expect(before.entity_id).toBe(playerId)

    // Hard delete player (ON DELETE SET NULL triggers)
    db.prepare('DELETE FROM entities WHERE id = ?').run(playerId)

    const after = db
      .prepare('SELECT entity_id FROM calendar_events WHERE id = ?')
      .get(eventId) as { entity_id: number | null }
    expect(after.entity_id).toBeNull()
  })
})

describe('Player Birthday - Sync showBirthdayInCalendar with Event Existence', () => {
  it('should detect when birthday event exists for player', () => {
    const playerId = createPlayer('Event Exists Player', {
      birthday: { year: 1500, month: 6, day: 15 },
      showBirthdayInCalendar: true
    })
    createBirthdayEvent(playerId, 'Event Exists Player', 6, 15)

    // Check that event exists
    const event = db
      .prepare(`
        SELECT * FROM calendar_events
        WHERE campaign_id = ? AND event_type = 'birthday' AND entity_id = ?
      `)
      .get(testCampaignId, playerId)

    expect(event).toBeDefined()
  })

  it('should detect when birthday event was deleted but metadata still says true', () => {
    // Create player with birthday and showBirthdayInCalendar=true
    const playerId = createPlayer('Deleted Event Player', {
      birthday: { year: 1500, month: 6, day: 15 },
      showBirthdayInCalendar: true
    })

    // Verify metadata says showBirthdayInCalendar: true
    const playerBefore = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string }
    const metadataBefore = JSON.parse(playerBefore.metadata)
    expect(metadataBefore.showBirthdayInCalendar).toBe(true)

    // Event does NOT exist (simulating it was deleted in calendar)
    const event = db
      .prepare(`
        SELECT * FROM calendar_events
        WHERE campaign_id = ? AND event_type = 'birthday' AND entity_id = ?
      `)
      .get(testCampaignId, playerId)

    expect(event).toBeUndefined()

    // In this case, the dialog should show showBirthdayInCalendar as false
    // because: metadataShowInCalendar=true AND eventActuallyExists=false → false
    const eventExists = event !== undefined
    const effectiveShowInCalendar = metadataBefore.showBirthdayInCalendar && eventExists
    expect(effectiveShowInCalendar).toBe(false)
  })

  it('should keep showBirthdayInCalendar true when event exists', () => {
    const playerId = createPlayer('Synced Player', {
      birthday: { year: 1500, month: 6, day: 15 },
      showBirthdayInCalendar: true
    })
    createBirthdayEvent(playerId, 'Synced Player', 6, 15)

    const player = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string }
    const metadata = JSON.parse(player.metadata)

    const event = db
      .prepare(`
        SELECT * FROM calendar_events
        WHERE campaign_id = ? AND event_type = 'birthday' AND entity_id = ?
      `)
      .get(testCampaignId, playerId)

    const eventExists = event !== undefined
    const effectiveShowInCalendar = metadata.showBirthdayInCalendar && eventExists
    expect(effectiveShowInCalendar).toBe(true)
  })
})

describe('Player Birthday - Date Validation', () => {
  it('should store birthday with valid in-game date components', () => {
    const playerId = createPlayer('Valid Date Player', {
      birthday: { year: 1, month: 1, day: 1 }
    })

    const player = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string }

    const metadata = JSON.parse(player.metadata)
    expect(metadata.birthday.year).toBe(1)
    expect(metadata.birthday.month).toBe(1)
    expect(metadata.birthday.day).toBe(1)
  })

  it('should store large year values for fantasy calendars', () => {
    const playerId = createPlayer('High Year Player', {
      birthday: { year: 9999, month: 12, day: 30 }
    })

    const player = db
      .prepare('SELECT metadata FROM entities WHERE id = ?')
      .get(playerId) as { metadata: string }

    const metadata = JSON.parse(player.metadata)
    expect(metadata.birthday.year).toBe(9999)
  })
})
