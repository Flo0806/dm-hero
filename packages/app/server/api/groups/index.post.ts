import { getDb } from '../../utils/db'
import { createApiError, ErrorCodes } from '../../utils/errors'
import type { EntityGroup } from '~~/types/group'

interface CreateGroupBody {
  campaignId: number
  name: string
  description?: string
  color?: string
  icon?: string
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<CreateGroupBody>(event)

  if (!body.campaignId) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.CAMPAIGN_ID_REQUIRED })
  }

  if (!body.name?.trim()) {
    throw createApiError({ statusCode: 400, code: ErrorCodes.GROUP_NAME_REQUIRED })
  }

  const result = db
    .prepare(
      `
      INSERT INTO entity_groups (campaign_id, name, description, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(body.campaignId, body.name.trim(), body.description?.trim() || null, body.color || null, body.icon || null)

  const group = db
    .prepare(
      `
      SELECT * FROM entity_groups WHERE id = ?
    `,
    )
    .get(result.lastInsertRowid) as EntityGroup

  return {
    ...group,
    _counts: { total: 0, byType: {} },
  }
})
