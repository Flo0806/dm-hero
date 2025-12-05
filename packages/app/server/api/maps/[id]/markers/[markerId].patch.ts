import { getDb } from '~~/server/utils/db'
import type { MapMarker, UpdateMarkerPayload } from '~~/types/map'

interface MarkerRow {
  id: number
  map_id: number
  entity_id: number
  x: number
  y: number
  custom_icon: string | null
  custom_color: string | null
  custom_label: string | null
  notes: string | null
  created_at: string
  updated_at: string
  entity_name: string
  entity_type: string
  entity_type_id: number
  entity_image_url: string | null
  entity_description: string | null
}

export default defineEventHandler(async (event) => {
  const db = getDb()
  const mapId = getRouterParam(event, 'id')
  const markerId = getRouterParam(event, 'markerId')
  const body = await readBody<UpdateMarkerPayload>(event)

  if (!mapId || !markerId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID and Marker ID are required',
    })
  }

  // Check if marker exists and belongs to this map
  const existing = db
    .prepare('SELECT id FROM map_markers WHERE id = ? AND map_id = ?')
    .get(Number(markerId), Number(mapId))

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Marker not found',
    })
  }

  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (body.x !== undefined) {
    updates.push('x = ?')
    values.push(body.x)
  }
  if (body.y !== undefined) {
    updates.push('y = ?')
    values.push(body.y)
  }
  if (body.custom_icon !== undefined) {
    updates.push('custom_icon = ?')
    values.push(body.custom_icon)
  }
  if (body.custom_color !== undefined) {
    updates.push('custom_color = ?')
    values.push(body.custom_color)
  }
  if (body.custom_label !== undefined) {
    updates.push('custom_label = ?')
    values.push(body.custom_label)
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?')
    values.push(body.notes)
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(Number(markerId))

    db.prepare(
      `UPDATE map_markers SET ${updates.join(', ')} WHERE id = ?`,
    ).run(...values)
  }

  // Get updated marker with entity details
  const marker = db
    .prepare(
      `
      SELECT
        mm.*,
        e.name as entity_name,
        et.name as entity_type,
        e.type_id as entity_type_id,
        e.image_url as entity_image_url,
        e.description as entity_description
      FROM map_markers mm
      JOIN entities e ON mm.entity_id = e.id
      JOIN entity_types et ON e.type_id = et.id
      WHERE mm.id = ?
    `,
    )
    .get(Number(markerId)) as MarkerRow

  return marker as MapMarker
})
