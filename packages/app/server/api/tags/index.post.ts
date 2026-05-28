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

  // If an *active* tag with this name already exists → just return it.
  // Do NOT overwrite its color silently — color changes go through PATCH.
  const active = db.prepare('SELECT id, name, color FROM tags WHERE name = ? AND deleted_at IS NULL').get(name) as Tag | undefined
  if (active) return active

  // Otherwise check for a soft-deleted row with the same name → revive it
  // (avoids hitting the UNIQUE constraint on `tags.name`).
  const buried = db.prepare('SELECT id FROM tags WHERE name = ? AND deleted_at IS NOT NULL').get(name) as { id: number } | undefined
  if (buried) {
    db.prepare('UPDATE tags SET color = ?, deleted_at = NULL WHERE id = ?').run(color, buried.id)
    return db.prepare('SELECT id, name, color FROM tags WHERE id = ?').get(buried.id) as Tag
  }

  const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color)
  return db.prepare('SELECT id, name, color FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag
})
