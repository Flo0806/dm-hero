import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { hasImportableCalendar } from '../../server/utils/calendarImport'

/**
 * Regression suite for #297: a merge-import whose export carries an "empty"
 * calendar (a default config row but ZERO months) must NOT wipe the target
 * campaign's calendar. Import/export is the highest-blast-radius area, so this
 * exercises the real guard (`hasImportableCalendar`) plus a faithful mirror of
 * the endpoint's guarded DELETE+INSERT against the real migrated schema.
 */

type ManifestCalendar = {
  config?: { current_year?: number, current_month?: number, current_day?: number }
  months?: Array<{ name: string, days: number, sort_order: number }>
} | null | undefined

// Mirror of import.post.ts' calendar section: the SAME guard, the SAME ordered
// DELETEs across all calendar_* tables, then re-insert config + months.
function runCalendarImport(
  db: Database.Database,
  campaignId: number,
  cal: ManifestCalendar,
  resolution?: 'keep' | 'overwrite',
): boolean {
  const shouldImport = hasImportableCalendar(cal) && resolution !== 'keep'
  if (!shouldImport) return false

  db.prepare('DELETE FROM calendar_event_entities WHERE event_id IN (SELECT id FROM calendar_events WHERE campaign_id = ?)').run(campaignId)
  for (const t of ['calendar_events', 'calendar_weather', 'calendar_seasons', 'calendar_moons', 'calendar_weekdays', 'calendar_months', 'calendar_config']) {
    db.prepare(`DELETE FROM ${t} WHERE campaign_id = ?`).run(campaignId)
  }

  if (cal!.config) {
    db.prepare('INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day) VALUES (?, ?, ?, ?)')
      .run(campaignId, cal!.config.current_year ?? 1, cal!.config.current_month ?? 1, cal!.config.current_day ?? 1)
  }
  for (const m of cal!.months ?? []) {
    db.prepare('INSERT INTO calendar_months (campaign_id, name, days, sort_order) VALUES (?, ?, ?, ?)')
      .run(campaignId, m.name, m.days, m.sort_order)
  }
  return true
}

// Mirror of the merge-mode conflict check (import.post.ts ~519).
function detectsCalendarConflict(
  db: Database.Database,
  targetCampaignId: number,
  cal: ManifestCalendar,
  resolution?: 'keep' | 'overwrite',
): boolean {
  if (!hasImportableCalendar(cal)) return false
  const existing = (db.prepare('SELECT COUNT(*) AS c FROM calendar_months WHERE campaign_id = ?').get(targetCampaignId) as { c: number }).c
  return existing > 0 && !resolution
}

function seedFullCalendar(db: Database.Database, campaignId: number) {
  db.prepare('INSERT INTO calendar_config (campaign_id, current_year, current_month, current_day) VALUES (?, 5, 3, 12)').run(campaignId)
  db.prepare('INSERT INTO calendar_months (campaign_id, name, days, sort_order) VALUES (?, ?, ?, ?)').run(campaignId, 'Hammer', 30, 0)
  db.prepare('INSERT INTO calendar_months (campaign_id, name, days, sort_order) VALUES (?, ?, ?, ?)').run(campaignId, 'Alturiak', 30, 1)
  db.prepare('INSERT INTO calendar_weekdays (campaign_id, name, sort_order) VALUES (?, ?, ?)').run(campaignId, 'Sul', 0)
  db.prepare('INSERT INTO calendar_seasons (campaign_id, name, start_month, start_day, sort_order) VALUES (?, ?, ?, ?, ?)').run(campaignId, 'Winter', 1, 1, 0)
  db.prepare('INSERT INTO calendar_weather (campaign_id, year, month, day, weather_type) VALUES (?, 5, 3, 12, ?)').run(campaignId, 'snow')
  db.prepare('INSERT INTO calendar_events (campaign_id, title, month, day) VALUES (?, ?, 1, 1)').run(campaignId, 'Midwinter')
}

function calendarSnapshot(db: Database.Database, campaignId: number) {
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${t} WHERE campaign_id = ?`).get(campaignId) as { c: number }).c
  return {
    config: count('calendar_config'),
    months: count('calendar_months'),
    weekdays: count('calendar_weekdays'),
    seasons: count('calendar_seasons'),
    weather: count('calendar_weather'),
    events: count('calendar_events'),
  }
}

describe('hasImportableCalendar (#297)', () => {
  it('is false for an empty calendar (config but no months)', () => {
    expect(hasImportableCalendar({ config: {}, months: [] } as ManifestCalendar)).toBe(false)
  })
  it('is false when calendar is missing/undefined/null', () => {
    expect(hasImportableCalendar(undefined)).toBe(false)
    expect(hasImportableCalendar(null)).toBe(false)
  })
  it('is false when months is not a non-empty array', () => {
    expect(hasImportableCalendar({ months: undefined } as ManifestCalendar)).toBe(false)
    expect(hasImportableCalendar({} as ManifestCalendar)).toBe(false)
  })
  it('is true only when the calendar actually has months', () => {
    expect(hasImportableCalendar({ months: [{ name: 'Hammer', days: 30, sort_order: 0 }] })).toBe(true)
  })
})

describe('calendar import guard — target calendar preservation (#297)', () => {
  let db: Database.Database
  let target: number

  beforeEach(() => {
    db = getTestDb()
    target = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Target').lastInsertRowid)
    seedFullCalendar(db, target)
  })

  it('preserves the WHOLE target calendar when the import carries an empty calendar', () => {
    const before = calendarSnapshot(db, target)
    const applied = runCalendarImport(db, target, { config: { current_year: 1 }, months: [] })
    expect(applied).toBe(false) // guard skipped — no DELETE ran
    expect(calendarSnapshot(db, target)).toEqual(before)
    // The bug was data loss: every calendar table must still have its rows.
    expect(before.months).toBe(2)
    expect(before.weather).toBe(1)
    expect(before.events).toBe(1)
  })

  it('preserves the target calendar when the manifest has no calendar at all', () => {
    const before = calendarSnapshot(db, target)
    expect(runCalendarImport(db, target, undefined)).toBe(false)
    expect(runCalendarImport(db, target, null)).toBe(false)
    expect(calendarSnapshot(db, target)).toEqual(before)
  })

  it('preserves the target calendar when resolution is "keep" even with a real import calendar', () => {
    const before = calendarSnapshot(db, target)
    const applied = runCalendarImport(db, target, { months: [{ name: 'NewMonth', days: 28, sort_order: 0 }] }, 'keep')
    expect(applied).toBe(false)
    expect(calendarSnapshot(db, target)).toEqual(before)
  })

  it('replaces the target calendar when the import carries a real calendar', () => {
    const applied = runCalendarImport(db, target, {
      config: { current_year: 99, current_month: 2, current_day: 4 },
      months: [
        { name: 'Frostfall', days: 31, sort_order: 0 },
        { name: 'Sunpeak', days: 30, sort_order: 1 },
        { name: 'Harvest', days: 29, sort_order: 2 },
      ],
    })
    expect(applied).toBe(true)
    const snap = calendarSnapshot(db, target)
    expect(snap.months).toBe(3) // old 2 deleted, new 3 inserted
    expect(snap.weather).toBe(0) // old calendar fully cleared
    expect(snap.events).toBe(0)
    const names = (db.prepare('SELECT name FROM calendar_months WHERE campaign_id = ? ORDER BY sort_order').all(target) as Array<{ name: string }>).map(r => r.name)
    expect(names).toEqual(['Frostfall', 'Sunpeak', 'Harvest'])
    const cfg = db.prepare('SELECT current_year FROM calendar_config WHERE campaign_id = ?').get(target) as { current_year: number }
    expect(cfg.current_year).toBe(99)
  })

  it('does not touch OTHER campaigns calendars', () => {
    const other = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Other').lastInsertRowid)
    seedFullCalendar(db, other)
    runCalendarImport(db, target, { months: [{ name: 'X', days: 30, sort_order: 0 }] })
    expect(calendarSnapshot(db, other).months).toBe(2) // untouched
  })
})

describe('calendar conflict detection consistency (#297)', () => {
  let db: Database.Database
  let target: number

  beforeEach(() => {
    db = getTestDb()
    target = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Target').lastInsertRowid)
    seedFullCalendar(db, target) // target already has months
  })

  it('flags NO conflict for an empty import calendar (so no false prompt, and import is skipped)', () => {
    expect(detectsCalendarConflict(db, target, { config: {}, months: [] })).toBe(false)
  })

  it('flags a conflict when the import has a real calendar and the target already has one', () => {
    expect(detectsCalendarConflict(db, target, { months: [{ name: 'X', days: 30, sort_order: 0 }] })).toBe(true)
  })

  it('flags NO conflict once the user has chosen a resolution', () => {
    expect(detectsCalendarConflict(db, target, { months: [{ name: 'X', days: 30, sort_order: 0 }] }, 'overwrite')).toBe(false)
  })
})
