import { getDb } from '../../../utils/db'

/**
 * Get the full hierarchical path (breadcrumb) for a location
 * Returns array from root to current location
 * Example: [Region, City, District, Tavern]
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const locationId = getRouterParam(event, 'id')

  if (!locationId) {
    throw createError({
      statusCode: 400,
      message: 'Location ID is required',
    })
  }

  interface PathItem {
    id: number
    name: string
    depth: number
  }

  // Recursive CTE to get full path from root to current location
  // Max depth limited to 10 to prevent infinite loops
  const path = db
    .prepare(
      `
    WITH RECURSIVE location_path AS (
      -- Base case: Start with the requested location
      SELECT
        id,
        name,
        parent_entity_id,
        1 as depth
      FROM entities
      WHERE id = ? AND deleted_at IS NULL

      UNION ALL

      -- Recursive case: Get parent locations
      SELECT
        e.id,
        e.name,
        e.parent_entity_id,
        lp.depth + 1
      FROM entities e
      INNER JOIN location_path lp ON e.id = lp.parent_entity_id
      WHERE lp.depth < 10 AND e.deleted_at IS NULL
    )
    SELECT id, name, depth
    FROM location_path
    ORDER BY depth DESC
  `,
    )
    .all(Number(locationId)) as PathItem[]

  return path
})
