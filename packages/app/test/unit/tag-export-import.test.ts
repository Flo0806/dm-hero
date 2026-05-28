import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'

/**
 * Roundtrip-style test for the tag export/import logic.
 *
 * We don't go through the HTTP handlers because the SQL pieces in
 * `server/api/campaigns/[id]/export.post.ts` and `import.post.ts` are the only
 * non-trivial parts. This test mirrors that exact SQL on a fresh in-memory DB
 * so we can verify the rules quickly without spinning up Nuxt.
 *
 * Rules under test (per user spec):
 *  1. Same tag name already in target → silent reuse, keep target's color
 *  2. Tag name not in target → create with exported color
 *  3. Export has no tags at all → import runs through cleanly
 *  4. Soft-deleted target tag → revive (don't INSERT-and-fail unique)
 */

interface FakeManifest {
  entities: Array<{ _exportId: string, name: string, tags?: string[] }>
  tags?: Array<{ name: string, color: string | null }>
}

/** Insert an NPC entity in the campaign and return its id. */
function insertNpc(db: Database.Database, campaignId: number, name: string): number {
  const npcType = db.prepare('SELECT id FROM entity_types WHERE name = ?').get('NPC') as { id: number }
  const result = db.prepare('INSERT INTO entities (campaign_id, type_id, name) VALUES (?, ?, ?)').run(campaignId, npcType.id, name)
  return Number(result.lastInsertRowid)
}

/** Re-create the export-side tag pull (see export.post.ts: tagsByEntity + tagPalette). */
function exportTags(db: Database.Database, entityIds: number[]): FakeManifest['tags'] & object {
  if (entityIds.length === 0) return undefined as never
  const placeholders = entityIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT et.entity_id, t.name, t.color
    FROM entity_tags et
    JOIN tags t ON t.id = et.tag_id
    WHERE et.entity_id IN (${placeholders}) AND t.deleted_at IS NULL
  `).all(...entityIds) as Array<{ entity_id: number, name: string, color: string | null }>
  const palette = new Map<string, string | null>()
  for (const row of rows) if (!palette.has(row.name)) palette.set(row.name, row.color)
  return palette.size > 0
    ? [...palette.entries()].map(([name, color]) => ({ name, color }))
    : undefined as never
}

/** Re-create the import-side tag attachment (see import.post.ts: third pass). */
function importTags(
  db: Database.Database,
  manifest: FakeManifest,
  newIdByExportId: Map<string, number>,
) {
  const referenced = new Set<string>()
  for (const entity of manifest.entities) {
    if (entity.tags?.length) for (const name of entity.tags) referenced.add(name)
  }
  const palette = new Map<string, string | null>()
  if (manifest.tags) for (const t of manifest.tags) palette.set(t.name, t.color)

  if (referenced.size === 0) return

  const tagIdByName = new Map<string, number>()
  for (const name of referenced) {
    const existing = db.prepare('SELECT id, deleted_at FROM tags WHERE name = ?').get(name) as { id: number, deleted_at: string | null } | undefined
    if (existing) {
      if (existing.deleted_at) db.prepare('UPDATE tags SET deleted_at = NULL WHERE id = ?').run(existing.id)
      tagIdByName.set(name, existing.id)
    }
    else {
      const exportedColor = palette.get(name) ?? '#D4A574'
      const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, exportedColor)
      tagIdByName.set(name, Number(result.lastInsertRowid))
    }
  }

  for (const entity of manifest.entities) {
    if (!entity.tags?.length) continue
    const newId = newIdByExportId.get(entity._exportId)
    if (!newId) continue
    for (const name of entity.tags) {
      const tagId = tagIdByName.get(name)
      if (tagId) db.prepare('INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)').run(newId, tagId)
    }
  }
}

describe('tag export/import roundtrip', () => {
  let db: Database.Database
  let sourceCampaignId: number
  let targetCampaignId: number

  beforeEach(() => {
    db = getTestDb()
    // getTestDb already seeds a default campaign — call it the "source".
    sourceCampaignId = (db.prepare('SELECT id FROM campaigns ORDER BY id LIMIT 1').get() as { id: number }).id
    const result = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Target Campaign')
    targetCampaignId = Number(result.lastInsertRowid)
  })

  it('exports per-entity names + a deduped color palette', () => {
    const npcA = insertNpc(db, sourceCampaignId, 'A')
    const npcB = insertNpc(db, sourceCampaignId, 'B')
    const kuhTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('kuh', '#E57373')
    const grumpyTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('grumpy', '#64B5F6')
    db.prepare('INSERT INTO entity_tags (entity_id, tag_id) VALUES (?, ?), (?, ?), (?, ?)').run(
      npcA, Number(kuhTag.lastInsertRowid),
      npcA, Number(grumpyTag.lastInsertRowid),
      npcB, Number(kuhTag.lastInsertRowid),
    )

    const palette = exportTags(db, [npcA, npcB])
    expect(palette).toHaveLength(2)
    const names = (palette as Array<{ name: string }>).map(t => t.name).sort()
    expect(names).toEqual(['grumpy', 'kuh'])
  })

  it('rule 1: existing tag with same name is silently reused — color stays', () => {
    // Target already has #kuh in green
    db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('kuh', '#81C784')

    const npcId = insertNpc(db, targetCampaignId, 'Imported NPC')
    const manifest: FakeManifest = {
      entities: [{ _exportId: 'entity:1', name: 'X', tags: ['kuh'] }],
      tags: [{ name: 'kuh', color: '#E57373' }], // would create red — but it's silently ignored
    }
    importTags(db, manifest, new Map([['entity:1', npcId]]))

    const tags = db.prepare('SELECT * FROM tags WHERE name = ?').all('kuh') as Array<{ id: number, color: string | null }>
    expect(tags).toHaveLength(1)
    expect(tags[0]!.color).toBe('#81C784') // user's green kept

    // Attached?
    const link = db.prepare('SELECT 1 FROM entity_tags WHERE entity_id = ? AND tag_id = ?').get(npcId, tags[0]!.id)
    expect(link).toBeTruthy()
  })

  it('rule 2: missing tag is created with exported color', () => {
    const npcId = insertNpc(db, targetCampaignId, 'X')
    const manifest: FakeManifest = {
      entities: [{ _exportId: 'entity:1', name: 'X', tags: ['fresh'] }],
      tags: [{ name: 'fresh', color: '#BA68C8' }],
    }
    importTags(db, manifest, new Map([['entity:1', npcId]]))

    const tag = db.prepare('SELECT id, color FROM tags WHERE name = ?').get('fresh') as { id: number, color: string }
    expect(tag).toBeDefined()
    expect(tag.color).toBe('#BA68C8')
  })

  it('rule 3: manifest without any tags field runs through cleanly (backwards compat)', () => {
    const npcId = insertNpc(db, targetCampaignId, 'X')
    const manifest: FakeManifest = {
      entities: [{ _exportId: 'entity:1', name: 'X' /* no tags field */ }],
      // no manifest.tags either
    }
    expect(() => importTags(db, manifest, new Map([['entity:1', npcId]]))).not.toThrow()
    const count = db.prepare('SELECT COUNT(*) as c FROM entity_tags').get() as { c: number }
    expect(count.c).toBe(0)
  })

  it('rule 4: soft-deleted target tag is revived rather than colliding on unique name', () => {
    const inserted = db.prepare("INSERT INTO tags (name, color, deleted_at) VALUES (?, ?, datetime('now'))").run('zombie', '#FFB74D')
    const tagId = Number(inserted.lastInsertRowid)

    const npcId = insertNpc(db, targetCampaignId, 'X')
    const manifest: FakeManifest = {
      entities: [{ _exportId: 'entity:1', name: 'X', tags: ['zombie'] }],
      tags: [{ name: 'zombie', color: '#9575CD' }],
    }
    importTags(db, manifest, new Map([['entity:1', npcId]]))

    const tag = db.prepare('SELECT id, color, deleted_at FROM tags WHERE name = ?').get('zombie') as { id: number, color: string, deleted_at: string | null }
    expect(tag.id).toBe(tagId) // same row revived
    expect(tag.deleted_at).toBeNull()
    expect(tag.color).toBe('#FFB74D') // exported color is ignored, original kept
  })

  it('full roundtrip: export from source then import into target preserves attachments', () => {
    // Source: 2 NPCs with overlapping tags
    const srcA = insertNpc(db, sourceCampaignId, 'Alpha')
    const srcB = insertNpc(db, sourceCampaignId, 'Beta')
    const tKuh = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('kuh', '#E57373')
    const tGrumpy = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('grumpy', '#4FC3F7')
    db.prepare('INSERT INTO entity_tags VALUES (?, ?), (?, ?), (?, ?)').run(
      srcA, Number(tKuh.lastInsertRowid),
      srcA, Number(tGrumpy.lastInsertRowid),
      srcB, Number(tKuh.lastInsertRowid),
    )

    // Export
    const palette = exportTags(db, [srcA, srcB])
    const manifest: FakeManifest = {
      entities: [
        { _exportId: 'entity:1', name: 'Alpha', tags: ['kuh', 'grumpy'] },
        { _exportId: 'entity:2', name: 'Beta', tags: ['kuh'] },
      ],
      tags: palette,
    }

    // Import into a fresh target campaign
    const newA = insertNpc(db, targetCampaignId, 'Alpha')
    const newB = insertNpc(db, targetCampaignId, 'Beta')
    importTags(db, manifest, new Map([['entity:1', newA], ['entity:2', newB]]))

    const aTags = db.prepare(`
      SELECT t.name FROM entity_tags et JOIN tags t ON t.id = et.tag_id
      WHERE et.entity_id = ? ORDER BY t.name
    `).all(newA) as Array<{ name: string }>
    const bTags = db.prepare(`
      SELECT t.name FROM entity_tags et JOIN tags t ON t.id = et.tag_id
      WHERE et.entity_id = ? ORDER BY t.name
    `).all(newB) as Array<{ name: string }>

    expect(aTags.map(t => t.name)).toEqual(['grumpy', 'kuh'])
    expect(bTags.map(t => t.name)).toEqual(['kuh'])
  })
})
