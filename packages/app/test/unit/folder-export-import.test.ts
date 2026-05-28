import { describe, it, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import { getTestDb } from '../utils/test-db'
import { resolveUniqueFolderName } from '../../server/utils/folders'
import type { EntityFolderType } from '../../types/folder'

/**
 * Roundtrip-style test for the folder export/import logic.
 *
 * Mirrors the production SQL from:
 *  - server/api/campaigns/[id]/export.post.ts (folder collection pass)
 *  - server/api/campaigns/import.post.ts      (fourth pass: folders)
 *
 * Folder rules (per user spec — export/import is HIGH critical):
 *  1. Folder names are unique per (campaign, entity_type). Name collision in
 *     the target on import → silent rename ("Loot" → "Loot (1)") via
 *     resolveUniqueFolderName. NEVER merge.
 *  2. `manifest.folders` absent → noop (full backwards compat with v1.x exports).
 *  3. Entity with folder_name but no matching manifest folder → stays folder-less.
 *  4. Renaming on collision must not lose entity → key by (entity_type, original_name).
 *  5. Per-type isolation: NPC "Misc" and Item "Misc" are independent folders.
 */

interface FakeFolder {
  entity_type: EntityFolderType
  name: string
  parent_name?: string | null
  color?: string | null
  icon?: string | null
  easter_egg?: string | null
}

interface FakeEntity {
  _exportId: string
  type_name: string
  name: string
  folder_name?: string | null
}

interface FakeManifest {
  entities: FakeEntity[]
  folders?: FakeFolder[]
}

const TYPE_KEY_TO_DB_NAME: Record<EntityFolderType, string> = {
  npc: 'NPC',
  item: 'Item',
  faction: 'Faction',
  lore: 'Lore',
}

function getEntityTypeId(db: Database.Database, key: EntityFolderType): number {
  const row = db.prepare('SELECT id FROM entity_types WHERE name = ?').get(TYPE_KEY_TO_DB_NAME[key]) as { id: number }
  return row.id
}

function insertEntity(
  db: Database.Database,
  campaignId: number,
  type: EntityFolderType,
  name: string,
  folderId?: number | null,
): number {
  const typeId = getEntityTypeId(db, type)
  const result = db.prepare(
    'INSERT INTO entities (campaign_id, type_id, name, folder_id) VALUES (?, ?, ?, ?)',
  ).run(campaignId, typeId, name, folderId ?? null)
  return Number(result.lastInsertRowid)
}

function insertFolder(
  db: Database.Database,
  campaignId: number,
  type: EntityFolderType,
  name: string,
  extras: { color?: string | null, icon?: string | null, easter_egg?: string | null } = {},
): number {
  const result = db.prepare(`
    INSERT INTO entity_folders (campaign_id, entity_type, name, color, icon, easter_egg)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    type,
    name,
    extras.color ?? null,
    extras.icon ?? null,
    extras.easter_egg ?? null,
  )
  return Number(result.lastInsertRowid)
}

/** Mirrors the export-side folder collection (export.post.ts). */
function exportFolders(db: Database.Database, entityIds: number[]): FakeFolder[] | undefined {
  if (entityIds.length === 0) return undefined
  const placeholders = entityIds.map(() => '?').join(',')
  const referenced = db.prepare(`
    SELECT DISTINCT folder_id FROM entities
    WHERE id IN (${placeholders}) AND folder_id IS NOT NULL
  `).all(...entityIds) as Array<{ folder_id: number }>
  if (referenced.length === 0) return undefined
  const ids = referenced.map(r => r.folder_id)
  const idPlaceholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT entity_type, name, color, icon, easter_egg
    FROM entity_folders
    WHERE id IN (${idPlaceholders}) AND deleted_at IS NULL
  `).all(...ids) as Array<{
    entity_type: string
    name: string
    color: string | null
    icon: string | null
    easter_egg: string | null
  }>
  return rows.map(r => ({
    entity_type: r.entity_type as EntityFolderType,
    name: r.name,
    parent_name: null,
    color: r.color,
    icon: r.icon,
    easter_egg: r.easter_egg,
  }))
}

/** Mirrors the import-side fourth pass (import.post.ts). */
function importFolders(
  db: Database.Database,
  targetCampaignId: number,
  manifest: FakeManifest,
  newEntityIdByExportId: Map<string, number>,
) {
  if (!manifest.folders || manifest.folders.length === 0) return

  const newFolderIdByKey = new Map<string, number>()
  for (const folder of manifest.folders) {
    const finalName = resolveUniqueFolderName(db, targetCampaignId, folder.entity_type, folder.name)
    const result = db.prepare(`
      INSERT INTO entity_folders (campaign_id, entity_type, name, color, icon, easter_egg)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      targetCampaignId,
      folder.entity_type,
      finalName,
      folder.color ?? null,
      folder.icon ?? null,
      folder.easter_egg ?? null,
    )
    newFolderIdByKey.set(`${folder.entity_type}:${folder.name}`, Number(result.lastInsertRowid))
  }

  for (const entity of manifest.entities) {
    if (!entity.folder_name) continue
    const newId = newEntityIdByExportId.get(entity._exportId)
    if (!newId) continue
    const typeKey = (entity.type_name || '').toLowerCase() as EntityFolderType
    const folderId = newFolderIdByKey.get(`${typeKey}:${entity.folder_name}`)
    if (folderId) {
      db.prepare('UPDATE entities SET folder_id = ? WHERE id = ?').run(folderId, newId)
    }
  }
}

describe('folder export/import roundtrip', () => {
  let db: Database.Database
  let sourceCampaignId: number
  let targetCampaignId: number

  beforeEach(() => {
    db = getTestDb()
    sourceCampaignId = (db.prepare('SELECT id FROM campaigns ORDER BY id LIMIT 1').get() as { id: number }).id
    const result = db.prepare('INSERT INTO campaigns (name) VALUES (?)').run('Target Campaign')
    targetCampaignId = Number(result.lastInsertRowid)
  })

  it('rule 1: name collision in target renames to "(1)" — never merges', () => {
    insertFolder(db, targetCampaignId, 'npc', 'Loot')
    const npcId = insertEntity(db, targetCampaignId, 'npc', 'Stub')
    const manifest: FakeManifest = {
      entities: [{ _exportId: 'entity:1', type_name: 'NPC', name: 'Imported', folder_name: 'Loot' }],
      folders: [{ entity_type: 'npc', name: 'Loot', color: '#E57373' }],
    }
    const importedId = insertEntity(db, targetCampaignId, 'npc', 'Imported')

    importFolders(db, targetCampaignId, manifest, new Map([['entity:1', importedId]]))

    const folders = db.prepare(
      'SELECT id, name FROM entity_folders WHERE campaign_id = ? AND entity_type = ? AND deleted_at IS NULL ORDER BY id',
    ).all(targetCampaignId, 'npc') as Array<{ id: number, name: string }>
    expect(folders.map(f => f.name)).toEqual(['Loot', 'Loot (1)'])
    // Imported entity went into "Loot (1)" (the new one), not the existing "Loot"
    const linked = db.prepare('SELECT folder_id FROM entities WHERE id = ?').get(importedId) as { folder_id: number }
    expect(folders.find(f => f.id === linked.folder_id)!.name).toBe('Loot (1)')
    // Existing folder is untouched
    expect(npcId).toBeDefined()
  })

  it('rule 1: multi-collision renames to next free index', () => {
    insertFolder(db, targetCampaignId, 'npc', 'Loot')
    insertFolder(db, targetCampaignId, 'npc', 'Loot (1)')
    const manifest: FakeManifest = {
      entities: [],
      folders: [{ entity_type: 'npc', name: 'Loot' }],
    }
    importFolders(db, targetCampaignId, manifest, new Map())

    const names = (db.prepare(
      'SELECT name FROM entity_folders WHERE campaign_id = ? AND deleted_at IS NULL ORDER BY name',
    ).all(targetCampaignId) as Array<{ name: string }>).map(r => r.name)
    expect(names).toEqual(['Loot', 'Loot (1)', 'Loot (2)'])
  })

  it('rule 2: manifest without folders runs through cleanly (backwards compat)', () => {
    const importedId = insertEntity(db, targetCampaignId, 'npc', 'Imported')
    const manifest: FakeManifest = {
      entities: [{ _exportId: 'entity:1', type_name: 'NPC', name: 'Imported' /* no folder_name */ }],
      // no folders field at all
    }
    expect(() => importFolders(db, targetCampaignId, manifest, new Map([['entity:1', importedId]]))).not.toThrow()
    const folderCount = db.prepare(
      'SELECT COUNT(*) as c FROM entity_folders WHERE campaign_id = ?',
    ).get(targetCampaignId) as { c: number }
    expect(folderCount.c).toBe(0)
  })

  it('rule 3: entity with folder_name but no matching folder entry stays folder-less', () => {
    const importedId = insertEntity(db, targetCampaignId, 'npc', 'Imported')
    const manifest: FakeManifest = {
      entities: [{ _exportId: 'entity:1', type_name: 'NPC', name: 'Imported', folder_name: 'Ghost' }],
      folders: [], // Ghost is referenced but not declared
    }
    importFolders(db, targetCampaignId, manifest, new Map([['entity:1', importedId]]))
    const npc = db.prepare('SELECT folder_id FROM entities WHERE id = ?').get(importedId) as { folder_id: number | null }
    expect(npc.folder_id).toBeNull()
  })

  it('rule 4: rename preserves entity link — key by original name', () => {
    insertFolder(db, targetCampaignId, 'npc', 'Loot')
    const a = insertEntity(db, targetCampaignId, 'npc', 'A')
    const b = insertEntity(db, targetCampaignId, 'npc', 'B')
    const manifest: FakeManifest = {
      entities: [
        { _exportId: 'entity:1', type_name: 'NPC', name: 'A', folder_name: 'Loot' },
        { _exportId: 'entity:2', type_name: 'NPC', name: 'B', folder_name: 'Loot' },
      ],
      folders: [{ entity_type: 'npc', name: 'Loot' }],
    }
    importFolders(db, targetCampaignId, manifest, new Map([['entity:1', a], ['entity:2', b]]))
    const folder = db.prepare(
      'SELECT id FROM entity_folders WHERE campaign_id = ? AND name = ?',
    ).get(targetCampaignId, 'Loot (1)') as { id: number }
    const count = db.prepare('SELECT COUNT(*) as c FROM entities WHERE folder_id = ?').get(folder.id) as { c: number }
    expect(count.c).toBe(2)
  })

  it('rule 5: per-type isolation — NPC "Misc" and Item "Misc" are independent', () => {
    const manifest: FakeManifest = {
      entities: [
        { _exportId: 'entity:1', type_name: 'NPC', name: 'N', folder_name: 'Misc' },
        { _exportId: 'entity:2', type_name: 'Item', name: 'I', folder_name: 'Misc' },
      ],
      folders: [
        { entity_type: 'npc', name: 'Misc' },
        { entity_type: 'item', name: 'Misc' },
      ],
    }
    const npcId = insertEntity(db, targetCampaignId, 'npc', 'N')
    const itemId = insertEntity(db, targetCampaignId, 'item', 'I')
    importFolders(db, targetCampaignId, manifest, new Map([['entity:1', npcId], ['entity:2', itemId]]))

    const npcFolder = db.prepare(
      'SELECT entity_type FROM entity_folders f JOIN entities e ON e.folder_id = f.id WHERE e.id = ?',
    ).get(npcId) as { entity_type: string }
    const itemFolder = db.prepare(
      'SELECT entity_type FROM entity_folders f JOIN entities e ON e.folder_id = f.id WHERE e.id = ?',
    ).get(itemId) as { entity_type: string }
    expect(npcFolder.entity_type).toBe('npc')
    expect(itemFolder.entity_type).toBe('item')
  })

  it('full roundtrip: source folders survive export + import into empty target', () => {
    const npcFolderId = insertFolder(db, sourceCampaignId, 'npc', 'Loot', { color: '#D4A574' })
    const itemFolderId = insertFolder(db, sourceCampaignId, 'item', 'Quest Items')
    const srcA = insertEntity(db, sourceCampaignId, 'npc', 'Alpha', npcFolderId)
    const srcB = insertEntity(db, sourceCampaignId, 'item', 'Map', itemFolderId)

    // Export
    const folders = exportFolders(db, [srcA, srcB])
    const manifest: FakeManifest = {
      entities: [
        { _exportId: 'entity:1', type_name: 'NPC', name: 'Alpha', folder_name: 'Loot' },
        { _exportId: 'entity:2', type_name: 'Item', name: 'Map', folder_name: 'Quest Items' },
      ],
      folders,
    }
    expect(folders).toHaveLength(2)

    // Import into clean target
    const importedNpc = insertEntity(db, targetCampaignId, 'npc', 'Alpha')
    const importedItem = insertEntity(db, targetCampaignId, 'item', 'Map')
    importFolders(db, targetCampaignId, manifest, new Map([
      ['entity:1', importedNpc],
      ['entity:2', importedItem],
    ]))

    // Both entities are in the correct folder (no collisions → original names kept)
    const npc = db.prepare(`
      SELECT f.name, f.entity_type FROM entities e JOIN entity_folders f ON f.id = e.folder_id WHERE e.id = ?
    `).get(importedNpc) as { name: string, entity_type: string }
    const item = db.prepare(`
      SELECT f.name, f.entity_type FROM entities e JOIN entity_folders f ON f.id = e.folder_id WHERE e.id = ?
    `).get(importedItem) as { name: string, entity_type: string }
    expect(npc).toEqual({ name: 'Loot', entity_type: 'npc' })
    expect(item).toEqual({ name: 'Quest Items', entity_type: 'item' })
  })
})
