import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import {
  normaliseTagName,
  isValidTagName,
  isValidTagColor,
  type Tag,
} from '../../../types/tag'

export default defineEventHandler(async (event): Promise<Tag> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }

  const body = await readBody<{ name?: string, color?: string }>(event)
  const db = getDb()

  const existing = db.prepare('SELECT id, name, color FROM tags WHERE id = ? AND deleted_at IS NULL').get(id) as Tag | undefined
  if (!existing) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.NOT_FOUND, message: 'tag not found' })
  }

  const updates: string[] = []
  const params: (string | number)[] = []

  if (body?.name !== undefined) {
    const name = normaliseTagName(body.name)
    if (!isValidTagName(name)) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid tag name' })
    }
    if (name !== existing.name) {
      const dup = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(name, id) as { id: number } | undefined
      if (dup) {
        throw createApiError({ statusCode: 409, code: ErrorCodes.VALIDATION_FAILED, message: 'tag name already exists' })
      }
      updates.push('name = ?')
      params.push(name)
    }
  }

  if (body?.color !== undefined) {
    if (!isValidTagColor(body.color)) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid tag color' })
    }
    updates.push('color = ?')
    params.push(body.color)
  }

  if (updates.length === 0) return existing

  params.push(id)
  db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  return db.prepare('SELECT id, name, color FROM tags WHERE id = ?').get(id) as Tag
})
