import { describe, it, expect, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { migrations } from '../../server/utils/migrations'
import { setVersion } from '../../server/utils/db'

/**
 * entities_fts is an external-content FTS5 table. Wrong UPDATE/DELETE triggers
 * corrupt it ("database disk image is malformed") - but only on a file DB in
 * WAL mode like the app uses, not on the :memory: DB the other tests use.
 */

const dir = mkdtempSync(join(tmpdir(), 'dmhero-fts-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

/** A migrated database in a temp file with WAL, like the app uses. */
function fileDb(): Database.Database {
  const db = new Database(join(dir, `${Math.random().toString(36).slice(2)}.db`))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  for (const m of migrations) {
    m.up(db)
    setVersion(db, m.version)
  }
  return db
}

/** Ids of the entities the full-text index finds for q. */
const search = (db: Database.Database, q: string) =>
  (db.prepare('SELECT rowid FROM entities_fts WHERE entities_fts MATCH ?').all(q) as Array<{ rowid: number }>).map(r => r.rowid)

describe('entities_fts triggers', () => {
  it('keeps the index consistent through updates and deletes', () => {
    const db = fileDb()
    const campaignId = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('FTS').lastInsertRowid
    const typeId = (db.prepare('SELECT id FROM entity_types WHERE name = ?').get('Lore') as { id: number }).id
    const id = Number(db.prepare('INSERT INTO entities (type_id, campaign_id, name) VALUES (?, ?, ?)').run(typeId, campaignId, 'Old legend').lastInsertRowid)

    // From no description to one, then a different one
    db.prepare('UPDATE entities SET description = ? WHERE id = ?').run('A ghost haunts the cliff house', id)
    db.prepare('UPDATE entities SET description = ?, metadata = ? WHERE id = ?').run('Smugglers use the cellar', '{"type":"myth"}', id)

    expect(search(db, 'smugglers')).toEqual([id])
    expect(search(db, 'ghost')).toEqual([])
    expect(search(db, 'myth')).toEqual([id])

    db.prepare('DELETE FROM entities WHERE id = ?').run(id)
    expect(search(db, 'smugglers')).toEqual([])

    expect(() => db.prepare('INSERT INTO entities_fts(entities_fts) VALUES (\'integrity-check\')').run()).not.toThrow()
    db.close()
  })
})
