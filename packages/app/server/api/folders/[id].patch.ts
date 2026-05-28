import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import { resolveUniqueFolderName } from '../../utils/folders'
import {
  isValidFolderName,
  isValidEasterEgg,
  type EntityFolder,
  type EntityFolderType,
} from '../../../types/folder'

interface PatchBody {
  name?: string
  color?: string | null
  icon?: string | null
  easter_egg?: string | null
}

export default defineEventHandler(async (event): Promise<EntityFolder> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid id' })
  }
  const body = await readBody<PatchBody>(event)

  const db = getDb()
  const folder = db.prepare(
    'SELECT id, campaign_id, entity_type, name FROM entity_folders WHERE id = ? AND deleted_at IS NULL',
  ).get(id) as { id: number, campaign_id: number, entity_type: string, name: string } | undefined
  if (!folder) {
    throw createApiError({ statusCode: 404, code: ErrorCodes.NOT_FOUND, message: 'folder not found' })
  }

  const updates: string[] = []
  const params: unknown[] = []

  if (body?.name !== undefined) {
    const desired = body.name.trim()
    if (!isValidFolderName(desired)) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid folder name' })
    }
    if (desired !== folder.name) {
      const unique = resolveUniqueFolderName(
        db,
        folder.campaign_id,
        folder.entity_type as EntityFolderType,
        desired,
        id,
      )
      updates.push('name = ?')
      params.push(unique)
    }
  }
  if (body?.color !== undefined) {
    updates.push('color = ?')
    params.push(body.color ?? null)
  }
  if (body?.icon !== undefined) {
    updates.push('icon = ?')
    params.push(body.icon ?? null)
  }
  if (body?.easter_egg !== undefined) {
    const egg = body.easter_egg && isValidEasterEgg(body.easter_egg) ? body.easter_egg : null
    updates.push('easter_egg = ?')
    params.push(egg)
  }

  if (updates.length === 0) {
    return db.prepare('SELECT * FROM entity_folders WHERE id = ?').get(id) as EntityFolder
  }

  updates.push('updated_at = datetime(\'now\')')
  params.push(id)
  db.prepare(`UPDATE entity_folders SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  return db.prepare('SELECT * FROM entity_folders WHERE id = ?').get(id) as EntityFolder
})
