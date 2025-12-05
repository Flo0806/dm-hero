import { getDb } from '~~/server/utils/db'
import type { MapArea, UpdateMapAreaPayload } from '~~/types/map'

interface AreaRow {
  id: number
  map_id: number
  location_id: number
  center_x: number
  center_y: number
  radius: number
  color: string | null
  created_at: string
  updated_at: string
  location_name: string
  location_description: string | null
  location_image_url: string | null
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const mapId = getRouterParam(event, 'id')
  const areaId = getRouterParam(event, 'areaId')
  const body = await readBody<UpdateMapAreaPayload>(event)

  if (!mapId || !areaId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID and Area ID are required',
    })
  }

  // Check if area exists
  const existing = db
    .prepare('SELECT * FROM map_areas WHERE id = ? AND map_id = ?')
    .get(Number(areaId), Number(mapId))

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Area not found',
    })
  }

  // Build update query dynamically
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (body.center_x !== undefined) {
    updates.push('center_x = ?')
    values.push(body.center_x)
  }
  if (body.center_y !== undefined) {
    updates.push('center_y = ?')
    values.push(body.center_y)
  }
  if (body.radius !== undefined) {
    updates.push('radius = ?')
    values.push(body.radius)
  }
  if (body.color !== undefined) {
    updates.push('color = ?')
    values.push(body.color)
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(Number(areaId))

    db.prepare(`UPDATE map_areas SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  // Get updated area with location details
  const area = db
    .prepare(
      `
      SELECT
        ma.*,
        e.name as location_name,
        e.description as location_description,
        e.image_url as location_image_url
      FROM map_areas ma
      JOIN entities e ON ma.location_id = e.id
      WHERE ma.id = ?
    `,
    )
    .get(Number(areaId)) as AreaRow

  return area as MapArea
})
