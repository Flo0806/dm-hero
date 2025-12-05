import { getDb } from '../../../utils/db'

// Returns all maps that have an area (circle) for this location
export default defineEventHandler((event) => {
  const db = getDb()
  const locationId = getRouterParam(event, 'id')

  if (!locationId) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  interface MapWithArea {
    map_id: number
    map_name: string
    area_id: number
    center_x: number
    center_y: number
    radius: number
  }

  const mapsWithArea = db
    .prepare<[string], MapWithArea>(
      `
      SELECT
        m.id as map_id,
        m.name as map_name,
        a.id as area_id,
        a.center_x,
        a.center_y,
        a.radius
      FROM map_areas a
      JOIN campaign_maps m ON a.map_id = m.id
      WHERE a.location_id = ?
        AND m.deleted_at IS NULL
      ORDER BY m.name
    `,
    )
    .all(locationId)

  return mapsWithArea
})
