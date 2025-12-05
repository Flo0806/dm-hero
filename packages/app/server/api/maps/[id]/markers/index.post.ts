import { getDb } from '~~/server/utils/db'
import type { MapMarker, CreateMarkerPayload } from '~~/types/map'

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
  const body = await readBody<CreateMarkerPayload>(event)

  if (!mapId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID is required',
    })
  }

  if (!body.entity_id || body.x === undefined || body.y === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'entity_id, x, and y are required',
    })
  }

  // Check if map exists
  const map = db
    .prepare('SELECT id FROM campaign_maps WHERE id = ? AND deleted_at IS NULL')
    .get(Number(mapId))

  if (!map) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Map not found',
    })
  }

  // Check if entity exists
  const entity = db
    .prepare('SELECT id FROM entities WHERE id = ? AND deleted_at IS NULL')
    .get(body.entity_id)

  if (!entity) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Entity not found',
    })
  }

  // Check if entity already has a marker on this map (for warning)
  const existingMarker = db
    .prepare('SELECT id, x, y FROM map_markers WHERE map_id = ? AND entity_id = ?')
    .get(Number(mapId), body.entity_id) as { id: number; x: number; y: number } | undefined

  const result = db
    .prepare(
      `
      INSERT INTO map_markers (
        map_id, entity_id, x, y,
        custom_icon, custom_color, custom_label, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      Number(mapId),
      body.entity_id,
      body.x,
      body.y,
      body.custom_icon || null,
      body.custom_color || null,
      body.custom_label || null,
      body.notes || null,
    )

  // Get marker with entity details
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
    .get(result.lastInsertRowid) as MarkerRow

  return {
    marker: marker as MapMarker,
    warning: existingMarker
      ? `Entity already has a marker at position (${existingMarker.x.toFixed(1)}%, ${existingMarker.y.toFixed(1)}%)`
      : null,
  }
})
