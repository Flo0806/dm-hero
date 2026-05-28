import { getDb } from '../../../utils/db'
import { createApiError, ErrorCodes } from '../../../utils/errors'
import {
  normaliseTagName,
  isValidTagName,
  isValidTagColor,
  DEFAULT_TAG_COLOR,
  type Tag,
} from '../../../../types/tag'

/**
 * Attach a tag to an entity. Accepts either an existing tag id OR a free-text
 * name (the picker creates new tags on the fly). Returns the resolved tag.
 */
export default defineEventHandler(async (event): Promise<Tag> => {
  const entityId = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(entityId)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid entity id' })
  }

  const body = await readBody<{ tagId?: number, name?: string, color?: string }>(event)
  const db = getDb()

  // Guard: tags only work on rows from the `entities` table.
  // Groups (and similar containers in their own tables) would otherwise hit
  // the entity_tags foreign-key constraint and return a confusing 500.
  const entityExists = db.prepare('SELECT 1 FROM entities WHERE id = ? AND deleted_at IS NULL').get(entityId)
  if (!entityExists) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.NOT_FOUND, message: 'entity not found' })
  }

  let tagRow: Tag | undefined

  if (body?.tagId) {
    tagRow = db.prepare('SELECT id, name, color FROM tags WHERE id = ? AND deleted_at IS NULL').get(body.tagId) as Tag | undefined
    if (!tagRow) {
      throw createApiError({ statusCode: 404, code: ErrorCodes.NOT_FOUND, message: 'tag not found' })
    }
  }
  else {
    const name = normaliseTagName(body?.name ?? '')
    if (!isValidTagName(name)) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid tag name' })
    }
    const color = body?.color && isValidTagColor(body.color) ? body.color : DEFAULT_TAG_COLOR

    const existing = db.prepare('SELECT id, name, color, deleted_at FROM tags WHERE name = ?').get(name) as (Tag & { deleted_at?: string | null }) | undefined
    if (existing) {
      // Revive if soft-deleted
      if (existing.deleted_at) {
        db.prepare('UPDATE tags SET color = ?, deleted_at = NULL WHERE id = ?').run(color, existing.id)
      }
      tagRow = { id: existing.id, name: existing.name, color: existing.color }
    }
    else {
      const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color)
      tagRow = { id: Number(result.lastInsertRowid), name, color }
    }
  }

  db.prepare('INSERT OR IGNORE INTO entity_tags (entity_id, tag_id) VALUES (?, ?)').run(entityId, tagRow.id)

  return tagRow
})
