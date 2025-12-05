import { getDb } from '~~/server/utils/db'
import type { CampaignMap, UpdateMapPayload } from '~~/types/map'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateMapPayload>(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID is required',
    })
  }

  // Check if map exists
  const existing = db
    .prepare('SELECT id FROM campaign_maps WHERE id = ? AND deleted_at IS NULL')
    .get(Number(id))

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Map not found',
    })
  }

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }
  if (body.description !== undefined) {
    updates.push('description = ?')
    values.push(body.description)
  }
  if (body.parent_map_id !== undefined) {
    updates.push('parent_map_id = ?')
    values.push(body.parent_map_id)
  }
  if (body.version_name !== undefined) {
    updates.push('version_name = ?')
    values.push(body.version_name)
  }
  if (body.default_zoom !== undefined) {
    updates.push('default_zoom = ?')
    values.push(body.default_zoom)
  }
  if (body.min_zoom !== undefined) {
    updates.push('min_zoom = ?')
    values.push(body.min_zoom)
  }
  if (body.max_zoom !== undefined) {
    updates.push('max_zoom = ?')
    values.push(body.max_zoom)
  }
  if (body.scale_value !== undefined) {
    updates.push('scale_value = ?')
    values.push(body.scale_value)
  }
  if (body.scale_unit !== undefined) {
    updates.push('scale_unit = ?')
    values.push(body.scale_unit)
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(Number(id))

    db.prepare(
      `UPDATE campaign_maps SET ${updates.join(', ')} WHERE id = ?`,
    ).run(...values)
  }

  const map = db
    .prepare('SELECT * FROM campaign_maps WHERE id = ?')
    .get(Number(id)) as CampaignMap

  return map
})
