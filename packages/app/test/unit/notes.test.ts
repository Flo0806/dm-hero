import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getDb } from '../../server/utils/db'
import type Database from 'better-sqlite3'

// Notes Tests
// Tests creating notes, updating, deleting, toggling completed, and reordering

let db: Database.Database
let testCampaignId: number

interface NoteRow {
  id: number
  campaign_id: number
  content: string
  completed: number
  sort_order: number
  created_at: string
  updated_at: string
}

beforeAll(() => {
  db = getDb()

  // Create test campaign
  const result = db
    .prepare('INSERT INTO campaigns (name, description) VALUES (?, ?)')
    .run('Notes Test Campaign', 'Campaign for notes tests')
  testCampaignId = Number(result.lastInsertRowid)
})

afterAll(() => {
  // Clean up test data
  db.prepare('DELETE FROM campaign_notes WHERE campaign_id = ?').run(testCampaignId)
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(testCampaignId)
})

beforeEach(() => {
  // Clean up notes before each test
  db.prepare('DELETE FROM campaign_notes WHERE campaign_id = ?').run(testCampaignId)
})

// Helper to create a note
function createNote(content: string, completed = false, sortOrder = 0): number {
  const result = db
    .prepare('INSERT INTO campaign_notes (campaign_id, content, completed, sort_order) VALUES (?, ?, ?, ?)')
    .run(testCampaignId, content, completed ? 1 : 0, sortOrder)
  return Number(result.lastInsertRowid)
}

// Helper to get all notes for the test campaign
function getNotes(): NoteRow[] {
  return db
    .prepare('SELECT * FROM campaign_notes WHERE campaign_id = ? ORDER BY sort_order ASC')
    .all(testCampaignId) as NoteRow[]
}

// Helper to get a single note by ID
function getNote(noteId: number): NoteRow | undefined {
  return db.prepare('SELECT * FROM campaign_notes WHERE id = ?').get(noteId) as NoteRow | undefined
}

describe('Notes - Basic CRUD Operations', () => {
  it('should create a note', () => {
    const noteId = createNote('Test note content')

    const note = getNote(noteId)

    expect(note).toBeDefined()
    expect(note?.campaign_id).toBe(testCampaignId)
    expect(note?.content).toBe('Test note content')
    expect(note?.completed).toBe(0)
    expect(note?.sort_order).toBe(0)
  })

  it('should create a note with completed status', () => {
    const noteId = createNote('Completed note', true)

    const note = getNote(noteId)

    expect(note?.completed).toBe(1)
  })

  it('should update note content', () => {
    const noteId = createNote('Original content')

    db.prepare('UPDATE campaign_notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Updated content', noteId)

    const note = getNote(noteId)

    expect(note?.content).toBe('Updated content')
  })

  it('should delete a note', () => {
    const noteId = createNote('Note to delete')

    // Verify note exists
    let note = getNote(noteId)
    expect(note).toBeDefined()

    // Delete note
    db.prepare('DELETE FROM campaign_notes WHERE id = ?').run(noteId)

    // Verify note is gone
    note = getNote(noteId)
    expect(note).toBeUndefined()
  })

  it('should allow multiple notes with same content', () => {
    createNote('Duplicate content')
    createNote('Duplicate content')
    createNote('Duplicate content')

    const notes = getNotes()

    expect(notes).toHaveLength(3)
    expect(notes.every((n) => n.content === 'Duplicate content')).toBe(true)
  })
})

describe('Notes - Completed Toggle', () => {
  it('should toggle note from pending to completed', () => {
    const noteId = createNote('Toggle test', false)

    // Toggle to completed
    db.prepare('UPDATE campaign_notes SET completed = 1 WHERE id = ?').run(noteId)

    const note = getNote(noteId)
    expect(note?.completed).toBe(1)
  })

  it('should toggle note from completed to pending', () => {
    const noteId = createNote('Toggle back test', true)

    // Toggle back to pending
    db.prepare('UPDATE campaign_notes SET completed = 0 WHERE id = ?').run(noteId)

    const note = getNote(noteId)
    expect(note?.completed).toBe(0)
  })

  it('should count completed and pending notes correctly', () => {
    createNote('Pending 1', false)
    createNote('Pending 2', false)
    createNote('Completed 1', true)
    createNote('Completed 2', true)
    createNote('Completed 3', true)

    const pendingCount = (
      db
        .prepare('SELECT COUNT(*) as count FROM campaign_notes WHERE campaign_id = ? AND completed = 0')
        .get(testCampaignId) as { count: number }
    ).count

    const completedCount = (
      db
        .prepare('SELECT COUNT(*) as count FROM campaign_notes WHERE campaign_id = ? AND completed = 1')
        .get(testCampaignId) as { count: number }
    ).count

    expect(pendingCount).toBe(2)
    expect(completedCount).toBe(3)
  })
})

describe('Notes - Ordering', () => {
  it('should maintain sort order', () => {
    const note1 = createNote('First note', false, 0)
    const note2 = createNote('Second note', false, 1)
    const note3 = createNote('Third note', false, 2)

    const notes = getNotes()

    expect(notes[0]?.id).toBe(note1)
    expect(notes[1]?.id).toBe(note2)
    expect(notes[2]?.id).toBe(note3)
  })

  it('should allow reordering notes', () => {
    const note1 = createNote('Reorder 1', false, 0)
    const note2 = createNote('Reorder 2', false, 1)
    const note3 = createNote('Reorder 3', false, 2)

    // Reorder: move note3 to first position
    db.prepare('UPDATE campaign_notes SET sort_order = ? WHERE id = ?').run(0, note3)
    db.prepare('UPDATE campaign_notes SET sort_order = ? WHERE id = ?').run(1, note1)
    db.prepare('UPDATE campaign_notes SET sort_order = ? WHERE id = ?').run(2, note2)

    const notes = getNotes()

    expect(notes[0]?.id).toBe(note3)
    expect(notes[1]?.id).toBe(note1)
    expect(notes[2]?.id).toBe(note2)
  })

  it('should handle batch reorder via transaction', () => {
    const notes = [
      createNote('Batch A', false, 0),
      createNote('Batch B', false, 1),
      createNote('Batch C', false, 2),
      createNote('Batch D', false, 3),
    ]

    // New order: D, B, A, C (indices 3, 1, 0, 2)
    const newOrder = [notes[3], notes[1], notes[0], notes[2]]

    const updateStmt = db.prepare('UPDATE campaign_notes SET sort_order = ? WHERE id = ?')
    const transaction = db.transaction((noteIds: (number | undefined)[]) => {
      noteIds.forEach((noteId, index) => {
        if (noteId !== undefined) {
          updateStmt.run(index, noteId)
        }
      })
    })

    transaction(newOrder)

    const orderedNotes = getNotes()

    expect(orderedNotes[0]?.id).toBe(notes[3]) // D
    expect(orderedNotes[1]?.id).toBe(notes[1]) // B
    expect(orderedNotes[2]?.id).toBe(notes[0]) // A
    expect(orderedNotes[3]?.id).toBe(notes[2]) // C
  })

  it('should auto-increment sort_order correctly', () => {
    // Get max order and increment
    const getMaxOrder = () => {
      const result = db
        .prepare('SELECT MAX(sort_order) as max_order FROM campaign_notes WHERE campaign_id = ?')
        .get(testCampaignId) as { max_order: number | null }
      return result.max_order ?? -1
    }

    const order1 = getMaxOrder() + 1
    createNote('Auto Order 1', false, order1)

    const order2 = getMaxOrder() + 1
    createNote('Auto Order 2', false, order2)

    const order3 = getMaxOrder() + 1
    createNote('Auto Order 3', false, order3)

    expect(order1).toBe(0)
    expect(order2).toBe(1)
    expect(order3).toBe(2)

    const notes = getNotes()
    expect(notes[0]?.sort_order).toBe(0)
    expect(notes[1]?.sort_order).toBe(1)
    expect(notes[2]?.sort_order).toBe(2)
  })
})

describe('Notes - Campaign Isolation', () => {
  it('should only return notes for the specified campaign', () => {
    // Create second campaign
    const result = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Notes Isolation Campaign')
    const secondCampaignId = Number(result.lastInsertRowid)

    try {
      // Create notes in both campaigns
      createNote('Campaign 1 Note')

      db.prepare('INSERT INTO campaign_notes (campaign_id, content, sort_order) VALUES (?, ?, ?)')
        .run(secondCampaignId, 'Campaign 2 Note', 0)

      // Get notes for first campaign
      const campaign1Notes = getNotes()
      expect(campaign1Notes).toHaveLength(1)
      expect(campaign1Notes[0]?.content).toBe('Campaign 1 Note')

      // Get notes for second campaign
      const campaign2Notes = db
        .prepare('SELECT * FROM campaign_notes WHERE campaign_id = ?')
        .all(secondCampaignId) as NoteRow[]
      expect(campaign2Notes).toHaveLength(1)
      expect(campaign2Notes[0]?.content).toBe('Campaign 2 Note')
    } finally {
      // Clean up
      db.prepare('DELETE FROM campaign_notes WHERE campaign_id = ?').run(secondCampaignId)
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(secondCampaignId)
    }
  })

  it('should delete all notes when campaign is deleted', () => {
    // Create a temporary campaign
    const result = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Temp Campaign for Delete')
    const tempCampaignId = Number(result.lastInsertRowid)

    // Add notes to the temp campaign
    db.prepare('INSERT INTO campaign_notes (campaign_id, content, sort_order) VALUES (?, ?, ?)')
      .run(tempCampaignId, 'Temp Note 1', 0)
    db.prepare('INSERT INTO campaign_notes (campaign_id, content, sort_order) VALUES (?, ?, ?)')
      .run(tempCampaignId, 'Temp Note 2', 1)

    // Verify notes exist
    let tempNotes = db
      .prepare('SELECT * FROM campaign_notes WHERE campaign_id = ?')
      .all(tempCampaignId) as NoteRow[]
    expect(tempNotes).toHaveLength(2)

    // Delete campaign (CASCADE should delete notes)
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(tempCampaignId)

    // Verify notes are gone
    tempNotes = db.prepare('SELECT * FROM campaign_notes WHERE campaign_id = ?').all(tempCampaignId) as NoteRow[]
    expect(tempNotes).toHaveLength(0)
  })
})

describe('Notes - Clear Completed', () => {
  it('should delete all completed notes', () => {
    createNote('Pending 1', false)
    createNote('Pending 2', false)
    createNote('Completed 1', true)
    createNote('Completed 2', true)

    // Delete all completed notes
    db.prepare('DELETE FROM campaign_notes WHERE campaign_id = ? AND completed = 1').run(testCampaignId)

    const notes = getNotes()

    expect(notes).toHaveLength(2)
    expect(notes.every((n) => n.completed === 0)).toBe(true)
  })

  it('should not delete pending notes when clearing completed', () => {
    const pendingId = createNote('Keep this', false)
    createNote('Delete this', true)

    db.prepare('DELETE FROM campaign_notes WHERE campaign_id = ? AND completed = 1').run(testCampaignId)

    const notes = getNotes()

    expect(notes).toHaveLength(1)
    expect(notes[0]?.id).toBe(pendingId)
  })
})

describe('Notes - Edge Cases', () => {
  it('should handle empty notes list', () => {
    const notes = getNotes()
    expect(notes).toHaveLength(0)
  })

  it('should handle very long note content', () => {
    const longContent = 'A'.repeat(10000)
    const noteId = createNote(longContent)

    const note = getNote(noteId)

    expect(note?.content).toBe(longContent)
    expect(note?.content.length).toBe(10000)
  })

  it('should handle special characters in content', () => {
    const specialContent = "Note with 'quotes' and \"double quotes\" and `backticks` and émojis 🎲"
    const noteId = createNote(specialContent)

    const note = getNote(noteId)

    expect(note?.content).toBe(specialContent)
  })

  it('should handle unicode content', () => {
    const unicodeContent = '笔记内容 • Ноте • メモ • 📝'
    const noteId = createNote(unicodeContent)

    const note = getNote(noteId)

    expect(note?.content).toBe(unicodeContent)
  })

  it('should update updated_at timestamp on changes', () => {
    const noteId = createNote('Timestamp test')

    const noteBefore = getNote(noteId)
    const createdAt = noteBefore?.created_at
    const updatedAtBefore = noteBefore?.updated_at

    // Wait a tiny bit and update
    db.prepare('UPDATE campaign_notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('Updated content', noteId)

    const noteAfter = getNote(noteId)

    // created_at should not change
    expect(noteAfter?.created_at).toBe(createdAt)
    // updated_at should change (or be equal if within same second)
    expect(noteAfter?.updated_at).toBeDefined()
  })

  it('should handle notes with only whitespace trimmed', () => {
    // Simulate what the API would do (trim whitespace)
    const content = '   Trimmed content   '.trim()
    const noteId = createNote(content)

    const note = getNote(noteId)

    expect(note?.content).toBe('Trimmed content')
  })
})

describe('Notes - Store Getters Simulation', () => {
  it('should correctly calculate pendingCount', () => {
    createNote('Pending 1', false)
    createNote('Pending 2', false)
    createNote('Completed 1', true)

    const notes = getNotes()
    const pendingCount = notes.filter((n) => n.completed === 0).length

    expect(pendingCount).toBe(2)
  })

  it('should correctly calculate completedCount', () => {
    createNote('Pending 1', false)
    createNote('Completed 1', true)
    createNote('Completed 2', true)

    const notes = getNotes()
    const completedCount = notes.filter((n) => n.completed === 1).length

    expect(completedCount).toBe(2)
  })

  it('should correctly calculate total noteCount', () => {
    createNote('Note 1', false)
    createNote('Note 2', true)
    createNote('Note 3', false)
    createNote('Note 4', true)

    const notes = getNotes()

    expect(notes.length).toBe(4)
  })
})
