import { getDb } from '../../../utils/db'

// Place an entity marker inside an area circle, finding a free spot
export default defineEventHandler(async (event) => {
  const db = getDb()
  const mapId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!mapId) {
    throw createError({
      statusCode: 400,
      message: 'Map ID is required',
    })
  }

  const { entity_id, area_id } = body as {
    entity_id: number
    area_id: number
  }

  if (!entity_id || !area_id) {
    throw createError({
      statusCode: 400,
      message: 'Entity ID and Area ID are required',
    })
  }

  // Get the area details
  interface AreaRow {
    id: number
    center_x: number
    center_y: number
    radius: number
  }

  const area = db
    .prepare<[number, string], AreaRow>(
      'SELECT id, center_x, center_y, radius FROM map_areas WHERE id = ? AND map_id = ?',
    )
    .get(area_id, mapId)

  if (!area) {
    throw createError({
      statusCode: 404,
      message: 'Area not found',
    })
  }

  // Get existing markers in this area to find a free spot
  interface MarkerRow {
    x: number
    y: number
  }

  const existingMarkers = db
    .prepare<[string], MarkerRow>(
      'SELECT x, y FROM map_markers WHERE map_id = ?',
    )
    .all(mapId)

  // Find markers that are inside this circle
  const markersInCircle = existingMarkers.filter((m) => {
    const dx = m.x - area.center_x
    const dy = m.y - area.center_y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance <= area.radius
  })

  // Find a free spot in the circle using spiral pattern
  const position = findFreeSpotInCircle(
    area.center_x,
    area.center_y,
    area.radius,
    markersInCircle,
  )

  // Check if marker already exists for this entity on this map
  const existingMarker = db
    .prepare<[string, number], { id: number }>(
      'SELECT id FROM map_markers WHERE map_id = ? AND entity_id = ?',
    )
    .get(mapId, entity_id)

  if (existingMarker) {
    // Update existing marker position
    db.prepare(
      'UPDATE map_markers SET x = ?, y = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(position.x, position.y, existingMarker.id)

    return {
      id: existingMarker.id,
      x: position.x,
      y: position.y,
      action: 'moved',
    }
  } else {
    // Create new marker
    const result = db
      .prepare(
        'INSERT INTO map_markers (map_id, entity_id, x, y) VALUES (?, ?, ?, ?)',
      )
      .run(mapId, entity_id, position.x, position.y)

    return {
      id: result.lastInsertRowid,
      x: position.x,
      y: position.y,
      action: 'created',
    }
  }
})

// Find a free spot in a circle using spiral pattern from center
function findFreeSpotInCircle(
  centerX: number,
  centerY: number,
  radius: number,
  existingMarkers: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  const minDistance = 3 // Minimum distance between markers (in %)

  // Start from center and spiral outward
  const spiralPoints = generateSpiralPoints(centerX, centerY, radius, 20)

  for (const point of spiralPoints) {
    // Check if this point is far enough from all existing markers
    const isFree = existingMarkers.every((m) => {
      const dx = point.x - m.x
      const dy = point.y - m.y
      return Math.sqrt(dx * dx + dy * dy) >= minDistance
    })

    if (isFree) {
      return point
    }
  }

  // If no free spot found, return center (will overlap, but better than nothing)
  return { x: centerX, y: centerY }
}

// Generate points in a spiral pattern starting from center
function generateSpiralPoints(
  centerX: number,
  centerY: number,
  radius: number,
  numRings: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []

  // Start with center
  points.push({ x: centerX, y: centerY })

  // Generate rings
  for (let ring = 1; ring <= numRings; ring++) {
    const ringRadius = (radius * ring) / numRings * 0.8 // 80% of radius to stay inside
    const numPointsInRing = Math.max(6, ring * 6) // More points in outer rings

    for (let i = 0; i < numPointsInRing; i++) {
      const angle = (2 * Math.PI * i) / numPointsInRing
      const x = centerX + ringRadius * Math.cos(angle)
      const y = centerY + ringRadius * Math.sin(angle)

      // Make sure point is inside the circle
      const dx = x - centerX
      const dy = y - centerY
      if (Math.sqrt(dx * dx + dy * dy) <= radius * 0.9) {
        points.push({ x, y })
      }
    }
  }

  return points
}
