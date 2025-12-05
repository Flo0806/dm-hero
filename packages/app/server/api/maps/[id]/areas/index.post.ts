import { getDb } from '~~/server/utils/db'
import type { MapArea, CreateMapAreaPayload } from '~~/types/map'

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
  const body = await readBody<CreateMapAreaPayload>(event)

  if (!mapId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Map ID is required',
    })
  }

  if (!body.location_id || body.center_x === undefined || body.center_y === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'location_id, center_x, and center_y are required',
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

  // Check if location entity exists and is of type Location
  const location = db
    .prepare(`
      SELECT e.id FROM entities e
      JOIN entity_types et ON e.type_id = et.id
      WHERE e.id = ? AND e.deleted_at IS NULL AND et.name = 'Location'
    `)
    .get(body.location_id)

  if (!location) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Location not found or entity is not a Location type',
    })
  }

  // Check if location already has an area on this map
  const existingArea = db
    .prepare('SELECT id FROM map_areas WHERE map_id = ? AND location_id = ?')
    .get(Number(mapId), body.location_id)

  if (existingArea) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Location already has an area on this map',
    })
  }

  const result = db
    .prepare(
      `
      INSERT INTO map_areas (
        map_id, location_id, center_x, center_y, radius, color
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      Number(mapId),
      body.location_id,
      body.center_x,
      body.center_y,
      body.radius ?? 5.0,
      body.color || null,
    )

  // Get area with location details
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
    .get(result.lastInsertRowid) as AreaRow

  return area as MapArea
})
