import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { normaliseTagName, DEFAULT_TAG_COLOR } from '../../types/tag'
import { entityTypeToFolderType } from '../../server/utils/folders'

/**
 * Bulk-import commit logic (mirrors server/api/import/bulk.post.ts) against the
 * real migrated schema: entities + ref-resolved relations + tag reuse/create +
 * folder reuse/create. The endpoint's validation + dry-run are covered live via
 * curl; this locks down the write path + ref resolution + FK integrity.
 */
interface Ent { ref: string, type: string, name: string, description?: string, metadata?: Record<string, unknown>, tags?: string[], folder?: string }
interface Rel { from: string, to: string, type: string }

function commit(db: Database.Database, campaignId: number, entities: Ent[], relations: Rel[]) {
  const typeRow = (n: string) => db.prepare('SELECT id FROM entity_types WHERE name = ?').get(n) as { id: number }
  const insEntity = db.prepare('INSERT INTO entities (type_id, campaign_id, name, description, metadata, folder_id) VALUES (?, ?, ?, ?, ?, ?)')
  const findFolder = db.prepare('SELECT id FROM entity_folders WHERE campaign_id = ? AND entity_type = ? AND name = ? AND deleted_at IS NULL')
  const insFolder = db.prepare('INSERT INTO entity_folders (campaign_id, entity_type, name) VALUES (?, ?, ?)')
  const findTag = db.prepare('SELECT id, deleted_at FROM tags WHERE name = ?')
  const insTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
  const attachTag = db.prepare('INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)')
  const insRel = db.prepare('INSERT OR IGNORE INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')

  const refToId = new Map<string, number>()
  for (const e of entities) {
    let folderId: number | null = null
    if (e.folder) {
      const ft = entityTypeToFolderType(e.type)
      if (ft) {
        const ex = findFolder.get(campaignId, ft, e.folder) as { id: number } | undefined
        folderId = ex ? ex.id : Number(insFolder.run(campaignId, ft, e.folder).lastInsertRowid)
      }
    }
    const id = Number(insEntity.run(typeRow(e.type).id, campaignId, e.name, e.description ?? null, e.metadata ? JSON.stringify(e.metadata) : null, folderId).lastInsertRowid)
    refToId.set(e.ref, id)
    for (const raw of e.tags ?? []) {
      const name = normaliseTagName(raw)
      const found = findTag.get(name) as { id: number, deleted_at: string | null } | undefined
      const tagId = found ? found.id : Number(insTag.run(name, DEFAULT_TAG_COLOR).lastInsertRowid)
      attachTag.run(id, tagId)
    }
  }
  let rels = 0
  for (const r of relations) {
    const f = refToId.get(r.from)
    const t = refToId.get(r.to)
    if (f && t) {
      insRel.run(f, t, r.type)
      rels++
    }
  }
  return { refToId, rels }
}

describe('bulk-import commit', () => {
  let db: Database.Database
  let campaignId: number

  beforeEach(() => {
    db = getTestDb()
    campaignId = Number(db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Import').lastInsertRowid)
  })

  it('creates entities and resolves relation refs to real ids', () => {
    const { refToId, rels } = commit(db, campaignId, [
      { ref: 'npc:1', type: 'NPC', name: 'Gandalf' },
      { ref: 'item:1', type: 'Item', name: 'Glamdring' },
    ], [{ from: 'npc:1', to: 'item:1', type: 'owns' }])

    expect(refToId.size).toBe(2)
    expect(rels).toBe(1)
    const rel = db.prepare('SELECT from_entity_id, to_entity_id, relation_type FROM entity_relations').get() as { from_entity_id: number, to_entity_id: number, relation_type: string }
    expect(rel.from_entity_id).toBe(refToId.get('npc:1'))
    expect(rel.to_entity_id).toBe(refToId.get('item:1'))
    expect(rel.relation_type).toBe('owns')
  })

  it('reuses an existing folder by name, creates a missing one', () => {
    // Pre-create the NPC folder "Crew"
    db.prepare('INSERT INTO entity_folders (campaign_id, entity_type, name) VALUES (?, ?, ?)').run(campaignId, 'npc', 'Crew')
    commit(db, campaignId, [
      { ref: 'npc:1', type: 'NPC', name: 'A', folder: 'Crew' }, // reuse
      { ref: 'npc:2', type: 'NPC', name: 'B', folder: 'Loot' }, // create
    ], [])
    const folders = db.prepare('SELECT name FROM entity_folders WHERE campaign_id = ? AND entity_type = ? ORDER BY name').all(campaignId, 'npc') as Array<{ name: string }>
    expect(folders.map(f => f.name)).toEqual(['Crew', 'Loot'])
  })

  it('reuses an existing tag, creates missing ones, and attaches', () => {
    db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('wichtig', '#81C784')
    const { refToId } = commit(db, campaignId, [
      { ref: 'npc:1', type: 'NPC', name: 'A', tags: ['wichtig', 'magier'] },
    ], [])
    const tags = db.prepare('SELECT COUNT(*) c FROM tags').get() as { c: number }
    expect(tags.c).toBe(2) // existing "wichtig" reused, "magier" created
    const links = db.prepare('SELECT COUNT(*) c FROM entity_tags WHERE entity_id = ?').get(refToId.get('npc:1')) as { c: number }
    expect(links.c).toBe(2)
    // existing tag kept its color (not overwritten)
    const w = db.prepare('SELECT color FROM tags WHERE name = ?').get('wichtig') as { color: string }
    expect(w.color).toBe('#81C784')
  })

  it('stores metadata as given (keys) on the entity', () => {
    const { refToId } = commit(db, campaignId, [
      { ref: 'npc:1', type: 'NPC', name: 'A', metadata: { race: 'human', class: 'wizard' } },
    ], [])
    const row = db.prepare('SELECT metadata FROM entities WHERE id = ?').get(refToId.get('npc:1')) as { metadata: string }
    expect(JSON.parse(row.metadata)).toEqual({ race: 'human', class: 'wizard' })
  })

  it('duplicate relation (same from/to/type) is ignored, not errored', () => {
    const { refToId } = commit(db, campaignId, [
      { ref: 'a', type: 'NPC', name: 'A' },
      { ref: 'b', type: 'NPC', name: 'B' },
    ], [{ from: 'a', to: 'b', type: 'knows' }])
    // second identical relation
    db.prepare('INSERT OR IGNORE INTO entity_relations (from_entity_id, to_entity_id, relation_type) VALUES (?, ?, ?)')
      .run(refToId.get('a'), refToId.get('b'), 'knows')
    const count = db.prepare('SELECT COUNT(*) c FROM entity_relations').get() as { c: number }
    expect(count.c).toBe(1)
  })
})
