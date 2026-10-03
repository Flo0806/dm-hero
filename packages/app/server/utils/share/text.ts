import type Database from 'better-sqlite3'

// DM Hero text contains entity links that only make sense inside the app.
// For players they become plain names (same formats as extract-mentions.ts).
const NEW_FORMAT = /\{\{(\w+):(\d+)\}\}/g
const LEGACY_FORMAT = /\[([^\]]+)\]\((\w+):(\d+)\)/g

/** {{npc:12}} -> "Gandalf", [Gandalf](npc:12) -> "Gandalf". Links to deleted entities disappear. */
export function resolveEntityLinks(db: Database.Database, text: string): string {
  const nameOf = db.prepare('SELECT name FROM entities WHERE id = ? AND deleted_at IS NULL')
  return text
    .replace(NEW_FORMAT, (_, _type: string, id: string) => (nameOf.get(Number(id)) as { name: string } | undefined)?.name ?? '')
    .replace(LEGACY_FORMAT, (_, name: string) => name)
    .replace(/ {2,}/g, ' ')
    .trim()
}
