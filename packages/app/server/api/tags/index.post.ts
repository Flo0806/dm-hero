import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import {
  normaliseTagName,
  isValidTagName,
  isValidTagColor,
  DEFAULT_TAG_COLOR,
  type Tag,
} from '../../../types/tag'

export default defineEventHandler(async (event): Promise<Tag> => {
  const body = await readBody<{ name?: string, color?: string }>(event)
  const name = normaliseTagName(body?.name ?? '')
  if (!isValidTagName(name)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid tag name' })
  }

  const color = body?.color && isValidTagColor(body.color) ? body.color : DEFAULT_TAG_COLOR

  const db = getDb()

  // If a soft-deleted tag with the same name exists, revive it instead of failing the UNIQUE constraint.
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number } | undefined
  if (existing) {
    db.prepare('UPDATE tags SET color = ?, deleted_at = NULL WHERE id = ?').run(color, existing.id)
    return db.prepare('SELECT id, name, color FROM tags WHERE id = ?').get(existing.id) as Tag
  }

  const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color)
  return db.prepare('SELECT id, name, color FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag
})
