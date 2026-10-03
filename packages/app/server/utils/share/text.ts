import type Database from 'better-sqlite3'

// Names of OTHER entities inside a share (links, "lies in", factions ...).
// If that entity is shared under an alias, players see the alias - never the
// real name behind "The mysterious man".

/** Alias of an entity in this game, or its real name */
export function sharedName(db: Database.Database, tableId: number, entityId: number, name: string): string {
  const alias = db.prepare('SELECT display_name FROM game_table_shares WHERE game_table_id = ? AND entity_id = ? AND display_name IS NOT NULL')
    .get(tableId, entityId) as { display_name: string } | undefined
  return alias?.display_name ?? name
}

/** Name of a (not deleted) entity as players may see it, or null */
export function sharedEntityName(db: Database.Database, tableId: number, entityId: number | null | undefined): string | null {
  if (!entityId) return null
  const entity = db.prepare('SELECT name FROM entities WHERE id = ? AND deleted_at IS NULL').get(entityId) as { name: string } | undefined
  return entity ? sharedName(db, tableId, entityId, entity.name) : null
}

// Entity link formats in DM Hero texts (same as extract-mentions.ts)
const NEW_FORMAT = /\{\{(\w+):(\d+)\}\}/g
const LEGACY_FORMAT = /\[([^\]]+)\]\((\w+):(\d+)\)/g

/** {{npc:12}} / [Gandalf](npc:12) -> the name players may see. Links to deleted entities disappear. */
export function resolveEntityLinks(db: Database.Database, tableId: number, text: string): string {
  return text
    .replace(NEW_FORMAT, (_, _type: string, id: string) => sharedEntityName(db, tableId, Number(id)) ?? '')
    .replace(LEGACY_FORMAT, (_, name: string, _type: string, id: string) => sharedName(db, tableId, Number(id), name))
    .replace(/ {2,}/g, ' ')
    .trim()
}
