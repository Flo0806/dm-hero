import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Sessions CRUD Tests
// Tests the sessions table operations (create, read, update, soft-delete)

let db: Database.Database
let testCampaignId: number
let npcTypeId: number

beforeAll(() => {
  db = getDb()

  // Get NPC type ID for mentions
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  npcTypeId = npcType.id

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Sessions', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    // Clean up in correct order
    db.prepare('DELETE FROM session_attendance WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM session_mentions WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  // Clean up sessions before each test
  db.prepare('DELETE FROM session_attendance WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM session_mentions WHERE session_id IN (SELECT id FROM sessions WHERE campaign_id = ?)').run(testCampaignId)
  db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM entities WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create a session
function createSession(title: string, options?: {
  sessionNumber?: number
  date?: string
  summary?: string
  notes?: string
  inGameDayStart?: number
  inGameDayEnd?: number
  durationMinutes?: number
}): number {
  const result = db
    .prepare(`
      INSERT INTO sessions (
        campaign_id, title, session_number, date, summary, notes,
        in_game_day_start, in_game_day_end, duration_minutes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      testCampaignId,
      title,
      options?.sessionNumber || null,
      options?.date || null,
      options?.summary || null,
      options?.notes || null,
      options?.inGameDayStart || null,
      options?.inGameDayEnd || null,
      options?.durationMinutes || null
    )
  return Number(result.lastInsertRowid)
}

// Helper to create an NPC
function createNpc(name: string): number {
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(npcTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

// Helper to create a Player
function createPlayer(name: string): number {
  const playerTypeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Player') as { id: number }).id
  const result = db
    .prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)')
    .run(playerTypeId, testCampaignId, name)
  return Number(result.lastInsertRowid)
}

describe('Sessions - Basic CRUD', () => {
  it('should create a session', () => {
    const sessionId = createSession('Session 1: The Beginning')

    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as { id: number; title: string; campaign_id: number }

    expect(session).toBeDefined()
    expect(session.title).toBe('Session 1: The Beginning')
    expect(session.campaign_id).toBe(testCampaignId)
  })

  it('should create a session with all fields', () => {
    const sessionId = createSession('Session 2: Full Details', {
      sessionNumber: 2,
      date: '2024-03-15',
      summary: 'The party explored the dungeon',
      notes: 'Players were very engaged',
      inGameDayStart: 100,
      inGameDayEnd: 102,
      durationMinutes: 240
    })

    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as {
        session_number: number
        date: string
        summary: string
        notes: string
        in_game_day_start: number
        in_game_day_end: number
        duration_minutes: number
      }

    expect(session.session_number).toBe(2)
    expect(session.date).toBe('2024-03-15')
    expect(session.summary).toBe('The party explored the dungeon')
    expect(session.notes).toBe('Players were very engaged')
    expect(session.in_game_day_start).toBe(100)
    expect(session.in_game_day_end).toBe(102)
    expect(session.duration_minutes).toBe(240)
  })

  it('should update a session', () => {
    const sessionId = createSession('Original Title')

    db.prepare('UPDATE sessions SET title = ?, summary = ? WHERE id = ?')
      .run('Updated Title', 'New summary', sessionId)

    const session = db
      .prepare('SELECT title, summary FROM sessions WHERE id = ?')
      .get(sessionId) as { title: string; summary: string }

    expect(session.title).toBe('Updated Title')
    expect(session.summary).toBe('New summary')
  })

  it('should soft-delete a session', () => {
    const sessionId = createSession('To Delete')

    db.prepare('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId)

    const session = db
      .prepare('SELECT deleted_at FROM sessions WHERE id = ?')
      .get(sessionId) as { deleted_at: string | null }

    expect(session.deleted_at).not.toBeNull()
  })

  it('should not return soft-deleted sessions in normal queries', () => {
    const sessionId = createSession('Deleted Session')
    db.prepare('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId)

    const sessions = db
      .prepare('SELECT * FROM sessions WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId)

    expect(sessions).toHaveLength(0)
  })
})

describe('Sessions - Session Numbers', () => {
  it('should order by session number DESC', () => {
    createSession('Session 1', { sessionNumber: 1 })
    createSession('Session 3', { sessionNumber: 3 })
    createSession('Session 2', { sessionNumber: 2 })

    const sessions = db
      .prepare(`
        SELECT title FROM sessions
        WHERE campaign_id = ? AND deleted_at IS NULL
        ORDER BY session_number DESC
      `)
      .all(testCampaignId) as Array<{ title: string }>

    expect(sessions).toHaveLength(3)
    expect(sessions[0].title).toBe('Session 3')
    expect(sessions[1].title).toBe('Session 2')
    expect(sessions[2].title).toBe('Session 1')
  })

  it('should allow sessions without session numbers', () => {
    const sessionId = createSession('Unnumbered Session')

    const session = db
      .prepare('SELECT session_number FROM sessions WHERE id = ?')
      .get(sessionId) as { session_number: number | null }

    expect(session.session_number).toBeNull()
  })
})

describe('Sessions - In-Game Calendar', () => {
  it('should store in-game day range', () => {
    const sessionId = createSession('Calendar Session', {
      inGameDayStart: 50,
      inGameDayEnd: 52
    })

    const session = db
      .prepare('SELECT in_game_day_start, in_game_day_end FROM sessions WHERE id = ?')
      .get(sessionId) as { in_game_day_start: number; in_game_day_end: number }

    expect(session.in_game_day_start).toBe(50)
    expect(session.in_game_day_end).toBe(52)
  })

  it('should query sessions by in-game day range', () => {
    createSession('Session A', { inGameDayStart: 10, inGameDayEnd: 15 })
    createSession('Session B', { inGameDayStart: 20, inGameDayEnd: 25 })
    createSession('Session C', { inGameDayStart: 30, inGameDayEnd: 35 })

    // Find sessions that include day 22
    const sessions = db
      .prepare(`
        SELECT title FROM sessions
        WHERE campaign_id = ?
          AND deleted_at IS NULL
          AND in_game_day_start <= ?
          AND in_game_day_end >= ?
      `)
      .all(testCampaignId, 22, 22) as Array<{ title: string }>

    expect(sessions).toHaveLength(1)
    expect(sessions[0].title).toBe('Session B')
  })
})

describe('Sessions - Mentions', () => {
  it('should track entity mentions in sessions', () => {
    const sessionId = createSession('Session with mentions')
    const npcId = createNpc('Gandalf')

    // Add mention
    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)')
      .run(sessionId, npcId)

    const mentions = db
      .prepare(`
        SELECT e.name
        FROM session_mentions sm
        JOIN entities e ON e.id = sm.entity_id
        WHERE sm.session_id = ?
      `)
      .all(sessionId) as Array<{ name: string }>

    expect(mentions).toHaveLength(1)
    expect(mentions[0].name).toBe('Gandalf')
  })

  it('should count mentions per session', () => {
    const sessionId = createSession('Session with many mentions')
    const npc1 = createNpc('NPC 1')
    const npc2 = createNpc('NPC 2')
    const npc3 = createNpc('NPC 3')

    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(sessionId, npc1)
    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(sessionId, npc2)
    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(sessionId, npc3)

    const count = db
      .prepare('SELECT COUNT(*) as count FROM session_mentions WHERE session_id = ?')
      .get(sessionId) as { count: number }

    expect(count.count).toBe(3)
  })

  it('should return mentions count in session query', () => {
    const sessionId = createSession('Session for count')
    const npc1 = createNpc('NPC A')
    const npc2 = createNpc('NPC B')

    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(sessionId, npc1)
    db.prepare('INSERT INTO session_mentions (session_id, entity_id) VALUES (?, ?)').run(sessionId, npc2)

    const session = db
      .prepare(`
        SELECT
          s.id,
          (SELECT COUNT(*) FROM session_mentions WHERE session_id = s.id) as mentions_count
        FROM sessions s
        WHERE s.id = ?
      `)
      .get(sessionId) as { id: number; mentions_count: number }

    expect(session.mentions_count).toBe(2)
  })
})

describe('Sessions - Attendance', () => {
  it('should track player attendance', () => {
    const sessionId = createSession('Session with attendance')
    const player1 = createPlayer('Player 1')
    const player2 = createPlayer('Player 2')

    db.prepare('INSERT INTO session_attendance (session_id, player_id) VALUES (?, ?)').run(sessionId, player1)
    db.prepare('INSERT INTO session_attendance (session_id, player_id) VALUES (?, ?)').run(sessionId, player2)

    const attendance = db
      .prepare(`
        SELECT e.name
        FROM session_attendance sa
        JOIN entities e ON e.id = sa.player_id
        WHERE sa.session_id = ?
      `)
      .all(sessionId) as Array<{ name: string }>

    expect(attendance).toHaveLength(2)
  })

  it('should count attendance per session', () => {
    const sessionId = createSession('Session for attendance count')
    const player1 = createPlayer('P1')
    const player2 = createPlayer('P2')
    const player3 = createPlayer('P3')

    db.prepare('INSERT INTO session_attendance (session_id, player_id) VALUES (?, ?)').run(sessionId, player1)
    db.prepare('INSERT INTO session_attendance (session_id, player_id) VALUES (?, ?)').run(sessionId, player2)
    db.prepare('INSERT INTO session_attendance (session_id, player_id) VALUES (?, ?)').run(sessionId, player3)

    const session = db
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM session_attendance WHERE session_id = s.id) as attendance_count
        FROM sessions s
        WHERE s.id = ?
      `)
      .get(sessionId) as { attendance_count: number }

    expect(session.attendance_count).toBe(3)
  })
})

describe('Sessions - Campaign Isolation', () => {
  it('should only return sessions from the active campaign', () => {
    // Create another campaign
    const campaign2 = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Campaign 2')
    const campaign2Id = Number(campaign2.lastInsertRowid)

    // Create sessions in both campaigns
    createSession('Session in Test Campaign')
    db.prepare('INSERT INTO sessions (campaign_id, title) VALUES (?, ?)')
      .run(campaign2Id, 'Session in Campaign 2')

    const testCampaignSessions = db
      .prepare('SELECT * FROM sessions WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(testCampaignId)

    const campaign2Sessions = db
      .prepare('SELECT * FROM sessions WHERE campaign_id = ? AND deleted_at IS NULL')
      .all(campaign2Id)

    expect(testCampaignSessions).toHaveLength(1)
    expect(campaign2Sessions).toHaveLength(1)

    // Cleanup
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(campaign2Id)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign2Id)
  })
})

describe('Sessions - Duration', () => {
  it('should store session duration in minutes', () => {
    const sessionId = createSession('Long Session', { durationMinutes: 300 })

    const session = db
      .prepare('SELECT duration_minutes FROM sessions WHERE id = ?')
      .get(sessionId) as { duration_minutes: number }

    expect(session.duration_minutes).toBe(300)
  })

  it('should calculate total campaign playtime', () => {
    createSession('Session 1', { durationMinutes: 180 })
    createSession('Session 2', { durationMinutes: 240 })
    createSession('Session 3', { durationMinutes: 210 })

    const total = db
      .prepare(`
        SELECT SUM(duration_minutes) as total
        FROM sessions
        WHERE campaign_id = ? AND deleted_at IS NULL
      `)
      .get(testCampaignId) as { total: number }

    expect(total.total).toBe(630) // 180 + 240 + 210
  })
})
