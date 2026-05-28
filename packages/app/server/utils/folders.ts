import type Database from 'better-sqlite3'
import { uniqueFolderName, type EntityFolderType } from '../../types/folder'

/**
 * Helpers for entity_folders that are shared across:
 *  - POST /api/folders (create)
 *  - PATCH /api/folders/[id] (rename)
 *  - import.post.ts (folder import with conflict rename)
 *
 * Keep all "unique name within (campaign, entity_type)" logic here so the
 * three call sites stay consistent.
 */

export function getExistingFolderNames(
  db: Database.Database,
  campaignId: number,
  entityType: EntityFolderType,
  excludeFolderId?: number,
): string[] {
  const rows = excludeFolderId
    ? db.prepare(
      'SELECT name FROM entity_folders WHERE campaign_id = ? AND entity_type = ? AND id != ? AND deleted_at IS NULL',
    ).all(campaignId, entityType, excludeFolderId) as Array<{ name: string }>
    : db.prepare(
      'SELECT name FROM entity_folders WHERE campaign_id = ? AND entity_type = ? AND deleted_at IS NULL',
    ).all(campaignId, entityType) as Array<{ name: string }>
  return rows.map(r => r.name)
}

/**
 * Resolve a desired folder name to one that won't collide with active folders
 * in the same (campaign, entity_type). Appends " (1)", " (2)"… as needed.
 */
export function resolveUniqueFolderName(
  db: Database.Database,
  campaignId: number,
  entityType: EntityFolderType,
  desired: string,
  excludeFolderId?: number,
): string {
  const existing = getExistingFolderNames(db, campaignId, entityType, excludeFolderId)
  return uniqueFolderName(existing, desired)
}

/**
 * Map an entity_types.name (e.g. "NPC") to a folder entity_type key ("npc").
 * Returns null for types that don't support folders (location, player, group).
 */
const FOLDER_TYPE_MAP: Record<string, EntityFolderType> = {
  npc: 'npc',
  item: 'item',
  faction: 'faction',
  lore: 'lore',
}

export function entityTypeToFolderType(typeName: string | null | undefined): EntityFolderType | null {
  if (!typeName) return null
  return FOLDER_TYPE_MAP[typeName.toLowerCase()] ?? null
}
