/**
 * Extract entity mentions from markdown notes
 * Supports two formats:
 * - New format: {{type:id}} (preferred, name resolved dynamically)
 * - Legacy format: [Entity Name](type:id) (for backwards compatibility)
 * Returns array of { entityId, type } objects
 */
export interface EntityMention {
  entityId: number
  type: string
}

// New format: {{type:id}}
const NEW_FORMAT_REGEX = /\{\{(\w+):(\d+)\}\}/g
// Legacy format: [Name](type:id)
const LEGACY_FORMAT_REGEX = /\[([^\]]+)\]\((\w+):(\d+)\)/g

export function extractMentionsFromMarkdown(notes: string | null | undefined): EntityMention[] {
  if (!notes) return []

  const mentions: EntityMention[] = []
  const seen = new Set<number>()

  // Parse new format {{type:id}}
  let match
  while ((match = NEW_FORMAT_REGEX.exec(notes)) !== null) {
    const type = match[1]!
    const entityId = parseInt(match[2]!, 10)

    if (!seen.has(entityId)) {
      seen.add(entityId)
      mentions.push({ entityId, type })
    }
  }

  // Also parse legacy format [Name](type:id) for backwards compatibility
  while ((match = LEGACY_FORMAT_REGEX.exec(notes)) !== null) {
    const type = match[2]!
    const entityId = parseInt(match[3]!, 10)

    if (!seen.has(entityId)) {
      seen.add(entityId)
      mentions.push({ entityId, type })
    }
  }

  return mentions
}

/** Mention marker type -> entity_types.name (sessions aren't entities, so they're not here) */
export const MENTION_ENTITY_TYPES: Record<string, string> = {
  npc: 'NPC',
  location: 'Location',
  item: 'Item',
  faction: 'Faction',
  lore: 'Lore',
  player: 'Player',
  story: 'StoryNode',
}

/** Where a mention list is stored: the table and the column pointing at its owner */
interface MentionTable {
  table: 'session_mentions' | 'story_node_mentions'
  ownerColumn: 'session_id' | 'node_id'
}

/**
 * Remove ids absent from supported markers and add new ids only for live entities
 * matching the marker's type. Existing ids are not revalidated or given new context.
 * Empty text clears the owner's mentions. Database errors propagate; callers that
 * need atomic changes must supply a transaction.
 */
function syncMentions(
  db: import('better-sqlite3').Database,
  { table, ownerColumn }: MentionTable,
  ownerId: number,
  markdown: string | null | undefined,
): void {
  const mentions = extractMentionsFromMarkdown(markdown).filter(m => MENTION_ENTITY_TYPES[m.type])

  // Get current mentions from DB
  const currentMentions = db
    .prepare(`SELECT entity_id FROM ${table} WHERE ${ownerColumn} = ?`)
    .all(ownerId) as Array<{ entity_id: number }>

  const currentIds = new Set(currentMentions.map(m => m.entity_id))
  const newIds = new Set(mentions.map(m => m.entityId))

  // Delete mentions that are no longer in the text
  const toDelete = [...currentIds].filter(id => !newIds.has(id))
  if (toDelete.length > 0) {
    const deleteStmt = db.prepare(`DELETE FROM ${table} WHERE ${ownerColumn} = ? AND entity_id = ?`)
    for (const entityId of toDelete) {
      deleteStmt.run(ownerId, entityId)
    }
  }

  // Add new mentions
  const toAdd = mentions.filter(m => !currentIds.has(m.entityId))
  if (toAdd.length > 0) {
    // Validate that the entities exist and match the marker's type
    const placeholders = toAdd.map(() => '?').join(',')
    const existingEntities = db
      .prepare(`
        SELECT e.id, et.name AS type_name FROM entities e
        JOIN entity_types et ON et.id = e.type_id
        WHERE e.id IN (${placeholders}) AND e.deleted_at IS NULL
      `)
      .all(...toAdd.map(m => m.entityId)) as Array<{ id: number, type_name: string }>
    const typeById = new Map(existingEntities.map(e => [e.id, e.type_name]))

    const validMentions = toAdd.filter(m => typeById.get(m.entityId) === MENTION_ENTITY_TYPES[m.type])

    if (validMentions.length > 0) {
      const insertStmt = db.prepare(
        `INSERT OR IGNORE INTO ${table} (${ownerColumn}, entity_id, context) VALUES (?, ?, ?)`,
      )
      for (const mention of validMentions) {
        // Context: Just store the type - name is resolved dynamically
        insertStmt.run(ownerId, mention.entityId, mention.type)
      }
    }
  }
}

/** Sync session_mentions with the mentions in a session's notes */
export function syncSessionMentions(
  db: import('better-sqlite3').Database,
  sessionId: number,
  notes: string | null | undefined,
): void {
  syncMentions(db, { table: 'session_mentions', ownerColumn: 'session_id' }, sessionId, notes)
}

/**
 * Sync story_node_mentions from the supplied combined body and prep texts.
 * Empty text clears mentions; database errors propagate.
 */
export function syncStoryNodeMentions(
  db: import('better-sqlite3').Database,
  nodeId: number,
  markdown: string | null | undefined,
): void {
  syncMentions(db, { table: 'story_node_mentions', ownerColumn: 'node_id' }, nodeId, markdown)
}
