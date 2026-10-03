import { describe, it, expect } from 'vitest'
import { getTestDb } from '../utils/test-db'
import { getShareDefaults, saveShareDefaults } from '../../server/utils/share/defaults'

// Remembered ticks per share type (global, settings table)
describe('share defaults', () => {
  it('start empty, survive saving and are stored encrypted', () => {
    const db = getTestDb()
    expect(getShareDefaults(db)).toEqual({})

    saveShareDefaults(db, { npc: ['image', 'description'] })
    expect(getShareDefaults(db)).toEqual({ npc: ['image', 'description'] })

    const raw = (db.prepare('SELECT value FROM settings WHERE key = ?').get('share_defaults') as { value: string }).value
    expect(raw).not.toContain('description')
  })
})
