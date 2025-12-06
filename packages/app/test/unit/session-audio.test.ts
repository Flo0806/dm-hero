import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Session Audio & Markers Tests
// Tests for session audio recordings and their markers

let db: Database.Database
let testCampaignId: number
let testSessionId: number

beforeAll(() => {
  db = getDb()

  // Create test campaign
  const campaign = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Test Campaign Audio', 'Test description')
  testCampaignId = Number(campaign.lastInsertRowid)

  // Create test session
  const session = db
    .prepare('INSERT INTO sessions (campaign_id, title) VALUES (?, ?)')
    .run(testCampaignId, 'Test Session for Audio')
  testSessionId = Number(session.lastInsertRowid)
})

afterAll(() => {
  if (db) {
    db.prepare('DELETE FROM audio_markers WHERE audio_id IN (SELECT id FROM session_audio WHERE session_id = ?)').run(testSessionId)
    db.prepare('DELETE FROM session_audio WHERE session_id = ?').run(testSessionId)
    db.prepare('DELETE FROM sessions WHERE campaign_id = ?').run(testCampaignId)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
  }
})

beforeEach(() => {
  db.prepare('DELETE FROM audio_markers WHERE audio_id IN (SELECT id FROM session_audio WHERE session_id = ?)').run(testSessionId)
  db.prepare('DELETE FROM session_audio WHERE session_id = ?').run(testSessionId)
})

// Helper to create session audio
function createAudio(options?: {
  title?: string
  description?: string
  durationSeconds?: number
  fileSizeBytes?: number
  mimeType?: string
}): number {
  const result = db
    .prepare(`
      INSERT INTO session_audio (session_id, audio_url, title, description, duration_seconds, file_size_bytes, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      testSessionId,
      'audio/test-recording.mp3',
      options?.title || 'Test Recording',
      options?.description || null,
      options?.durationSeconds || 3600,
      options?.fileSizeBytes || 1024000,
      options?.mimeType || 'audio/mpeg'
    )
  return Number(result.lastInsertRowid)
}

// Helper to create audio marker
function createMarker(audioId: number, timestampSeconds: number, label: string, options?: {
  description?: string
  color?: string
}): number {
  const result = db
    .prepare(`
      INSERT INTO audio_markers (audio_id, timestamp_seconds, label, description, color)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      audioId,
      timestampSeconds,
      label,
      options?.description || null,
      options?.color || '#D4A574'
    )
  return Number(result.lastInsertRowid)
}

describe('Session Audio - Basic CRUD', () => {
  it('should create session audio', () => {
    const audioId = createAudio()

    const audio = db
      .prepare('SELECT * FROM session_audio WHERE id = ?')
      .get(audioId) as { id: number; session_id: number; title: string }

    expect(audio).toBeDefined()
    expect(audio.session_id).toBe(testSessionId)
    expect(audio.title).toBe('Test Recording')
  })

  it('should create audio with all fields', () => {
    const audioId = createAudio({
      title: 'Session 1 Recording',
      description: 'Full recording of session 1',
      durationSeconds: 7200,
      fileSizeBytes: 2048000,
      mimeType: 'audio/wav'
    })

    const audio = db
      .prepare('SELECT * FROM session_audio WHERE id = ?')
      .get(audioId) as {
        title: string
        description: string
        duration_seconds: number
        file_size_bytes: number
        mime_type: string
      }

    expect(audio.title).toBe('Session 1 Recording')
    expect(audio.description).toBe('Full recording of session 1')
    expect(audio.duration_seconds).toBe(7200)
    expect(audio.file_size_bytes).toBe(2048000)
    expect(audio.mime_type).toBe('audio/wav')
  })

  it('should update audio', () => {
    const audioId = createAudio({ title: 'Original Title' })

    db.prepare('UPDATE session_audio SET title = ?, description = ? WHERE id = ?')
      .run('Updated Title', 'New description', audioId)

    const audio = db
      .prepare('SELECT title, description FROM session_audio WHERE id = ?')
      .get(audioId) as { title: string; description: string }

    expect(audio.title).toBe('Updated Title')
    expect(audio.description).toBe('New description')
  })

  it('should delete audio', () => {
    const audioId = createAudio()

    db.prepare('DELETE FROM session_audio WHERE id = ?').run(audioId)

    const audio = db
      .prepare('SELECT * FROM session_audio WHERE id = ?')
      .get(audioId)

    expect(audio).toBeUndefined()
  })
})

describe('Session Audio - Multiple Recordings', () => {
  it('should support multiple audio files per session', () => {
    createAudio({ title: 'Part 1' })
    createAudio({ title: 'Part 2' })
    createAudio({ title: 'Part 3' })

    const audioFiles = db
      .prepare('SELECT * FROM session_audio WHERE session_id = ?')
      .all(testSessionId)

    expect(audioFiles).toHaveLength(3)
  })

  it('should order audio by display_order', () => {
    const audio1 = createAudio({ title: 'First' })
    const audio2 = createAudio({ title: 'Second' })
    const audio3 = createAudio({ title: 'Third' })

    // Set display order
    db.prepare('UPDATE session_audio SET display_order = ? WHERE id = ?').run(2, audio1)
    db.prepare('UPDATE session_audio SET display_order = ? WHERE id = ?').run(0, audio2)
    db.prepare('UPDATE session_audio SET display_order = ? WHERE id = ?').run(1, audio3)

    const audioFiles = db
      .prepare('SELECT title FROM session_audio WHERE session_id = ? ORDER BY display_order')
      .all(testSessionId) as Array<{ title: string }>

    expect(audioFiles[0].title).toBe('Second')
    expect(audioFiles[1].title).toBe('Third')
    expect(audioFiles[2].title).toBe('First')
  })
})

describe('Audio Markers - Basic CRUD', () => {
  it('should create a marker', () => {
    const audioId = createAudio()
    const markerId = createMarker(audioId, 120.5, 'Important moment')

    const marker = db
      .prepare('SELECT * FROM audio_markers WHERE id = ?')
      .get(markerId) as { id: number; audio_id: number; timestamp_seconds: number; label: string }

    expect(marker).toBeDefined()
    expect(marker.audio_id).toBe(audioId)
    expect(marker.timestamp_seconds).toBe(120.5)
    expect(marker.label).toBe('Important moment')
  })

  it('should create marker with all fields', () => {
    const audioId = createAudio()
    const markerId = createMarker(audioId, 300, 'Boss Fight', {
      description: 'The party encountered the dragon',
      color: '#FF5733'
    })

    const marker = db
      .prepare('SELECT * FROM audio_markers WHERE id = ?')
      .get(markerId) as {
        label: string
        description: string
        color: string
      }

    expect(marker.label).toBe('Boss Fight')
    expect(marker.description).toBe('The party encountered the dragon')
    expect(marker.color).toBe('#FF5733')
  })

  it('should update marker', () => {
    const audioId = createAudio()
    const markerId = createMarker(audioId, 60, 'Original')

    db.prepare('UPDATE audio_markers SET label = ?, timestamp_seconds = ? WHERE id = ?')
      .run('Updated', 90, markerId)

    const marker = db
      .prepare('SELECT label, timestamp_seconds FROM audio_markers WHERE id = ?')
      .get(markerId) as { label: string; timestamp_seconds: number }

    expect(marker.label).toBe('Updated')
    expect(marker.timestamp_seconds).toBe(90)
  })

  it('should delete marker', () => {
    const audioId = createAudio()
    const markerId = createMarker(audioId, 60, 'To Delete')

    db.prepare('DELETE FROM audio_markers WHERE id = ?').run(markerId)

    const marker = db
      .prepare('SELECT * FROM audio_markers WHERE id = ?')
      .get(markerId)

    expect(marker).toBeUndefined()
  })
})

describe('Audio Markers - Multiple Markers', () => {
  it('should support multiple markers per audio', () => {
    const audioId = createAudio()

    createMarker(audioId, 60, 'Start of combat')
    createMarker(audioId, 180, 'Player death')
    createMarker(audioId, 300, 'Victory')
    createMarker(audioId, 600, 'Loot distribution')

    const markers = db
      .prepare('SELECT * FROM audio_markers WHERE audio_id = ?')
      .all(audioId)

    expect(markers).toHaveLength(4)
  })

  it('should order markers by timestamp', () => {
    const audioId = createAudio()

    createMarker(audioId, 300, 'Third')
    createMarker(audioId, 60, 'First')
    createMarker(audioId, 180, 'Second')

    const markers = db
      .prepare('SELECT label FROM audio_markers WHERE audio_id = ? ORDER BY timestamp_seconds')
      .all(audioId) as Array<{ label: string }>

    expect(markers[0].label).toBe('First')
    expect(markers[1].label).toBe('Second')
    expect(markers[2].label).toBe('Third')
  })
})

describe('Audio Markers - Cascade Delete', () => {
  it('should delete markers when audio is deleted', () => {
    const audioId = createAudio()
    createMarker(audioId, 60, 'Marker 1')
    createMarker(audioId, 120, 'Marker 2')

    // Verify markers exist
    const markersBefore = db
      .prepare('SELECT * FROM audio_markers WHERE audio_id = ?')
      .all(audioId)
    expect(markersBefore).toHaveLength(2)

    // Delete audio (cascade should delete markers)
    db.prepare('DELETE FROM session_audio WHERE id = ?').run(audioId)

    const markersAfter = db
      .prepare('SELECT * FROM audio_markers WHERE audio_id = ?')
      .all(audioId)
    expect(markersAfter).toHaveLength(0)
  })
})

describe('Session Audio - Session Relationship', () => {
  it('should get audio with session info', () => {
    const audioId = createAudio({ title: 'Session Recording' })

    const result = db
      .prepare(`
        SELECT sa.*, s.title as session_title
        FROM session_audio sa
        JOIN sessions s ON s.id = sa.session_id
        WHERE sa.id = ?
      `)
      .get(audioId) as { title: string; session_title: string }

    expect(result.title).toBe('Session Recording')
    expect(result.session_title).toBe('Test Session for Audio')
  })

  it('should get session with audio count', () => {
    createAudio({ title: 'Recording 1' })
    createAudio({ title: 'Recording 2' })

    const result = db
      .prepare(`
        SELECT s.*, COUNT(sa.id) as audio_count
        FROM sessions s
        LEFT JOIN session_audio sa ON sa.session_id = s.id
        WHERE s.id = ?
        GROUP BY s.id
      `)
      .get(testSessionId) as { title: string; audio_count: number }

    expect(result.title).toBe('Test Session for Audio')
    expect(result.audio_count).toBe(2)
  })
})
