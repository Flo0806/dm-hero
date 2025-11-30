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

/**
 * Sync session_mentions table with extracted mentions from notes
 * Deletes removed mentions, adds new ones
 */
export function syncSessionMentions(
  db: import('better-sqlite3').Database,
  sessionId: number,
  notes: string | null | undefined,
): void {
  const mentions = extractMentionsFromMarkdown(notes)

  // Get current mentions from DB
  const currentMentions = db
    .prepare('SELECT entity_id FROM session_mentions WHERE session_id = ?')
    .all(sessionId) as Array<{ entity_id: number }>

  const currentIds = new Set(currentMentions.map((m) => m.entity_id))
  const newIds = new Set(mentions.map((m) => m.entityId))

  // Delete mentions that are no longer in notes
  const toDelete = [...currentIds].filter((id) => !newIds.has(id))
  if (toDelete.length > 0) {
    const deleteStmt = db.prepare(
      'DELETE FROM session_mentions WHERE session_id = ? AND entity_id = ?',
    )
    for (const entityId of toDelete) {
      deleteStmt.run(sessionId, entityId)
    }
  }

  // Add new mentions
  const toAdd = mentions.filter((m) => !currentIds.has(m.entityId))
  if (toAdd.length > 0) {
    // Validate that entity_ids actually exist in entities table
    const placeholders = toAdd.map(() => '?').join(',')
    const existingEntities = db
      .prepare(`SELECT id FROM entities WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
      .all(...toAdd.map((m) => m.entityId)) as Array<{ id: number }>
    const validIds = new Set(existingEntities.map((e) => e.id))

    // Filter to only valid mentions
    const validMentions = toAdd.filter((m) => validIds.has(m.entityId))

    if (validMentions.length > 0) {
      const insertStmt = db.prepare(
        'INSERT OR IGNORE INTO session_mentions (session_id, entity_id, context) VALUES (?, ?, ?)',
      )
      for (const mention of validMentions) {
        // Context: Just store the type - name is resolved dynamically
        insertStmt.run(sessionId, mention.entityId, mention.type)
      }
    }
  }
}
