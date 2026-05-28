import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import { resolveUniqueFolderName } from '../../utils/folders'
import {
  FOLDER_ENTITY_TYPES,
  isValidFolderName,
  isValidEasterEgg,
  type EntityFolder,
  type EntityFolderType,
} from '../../../types/folder'

interface CreateBody {
  campaignId?: number
  entityType?: string
  name?: string
  parent_folder_id?: number | null
  color?: string | null
  icon?: string | null
  easter_egg?: string | null
}

export default defineEventHandler(async (event): Promise<EntityFolder> => {
  const body = await readBody<CreateBody>(event)
  const campaignId = Number(body?.campaignId)
  const entityType = String(body?.entityType ?? '') as EntityFolderType
  const rawName = (body?.name ?? '').trim()

  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }
  if (!(FOLDER_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid entityType' })
  }
  if (!isValidFolderName(rawName)) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid folder name' })
  }

  const db = getDb()

  // Phase 1: parent_folder_id is allowed but UI enforces NULL. If provided,
  // verify it belongs to the same campaign+type so callers can't graft a
  // folder into another tree.
  let parentId: number | null = null
  if (body?.parent_folder_id != null) {
    const parent = db.prepare(
      'SELECT id FROM entity_folders WHERE id = ? AND campaign_id = ? AND entity_type = ? AND deleted_at IS NULL',
    ).get(body.parent_folder_id, campaignId, entityType) as { id: number } | undefined
    if (!parent) {
      throw createApiError({ statusCode: 400, code: ErrorCodes.VALIDATION_FAILED, message: 'invalid parent_folder_id' })
    }
    parentId = parent.id
  }

  const name = resolveUniqueFolderName(db, campaignId, entityType, rawName)

  const easterEgg = isValidEasterEgg(body?.easter_egg ?? undefined) ? body!.easter_egg : null
  const color = body?.color ?? null
  const icon = body?.icon ?? null

  const result = db.prepare(`
    INSERT INTO entity_folders (campaign_id, entity_type, name, parent_folder_id, color, icon, easter_egg)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(campaignId, entityType, name, parentId, color, icon, easterEgg)

  return db.prepare('SELECT * FROM entity_folders WHERE id = ?').get(result.lastInsertRowid) as EntityFolder
})
