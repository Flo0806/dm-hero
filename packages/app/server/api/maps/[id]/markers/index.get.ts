import { getDb } from '../../../../utils/db'
import type { MapMarker } from '../../../../../types/map'

export default defineEventHandler((event) => {
  const db = getDb()
  const mapId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const entityId = query.entityId ? Number(query.entityId) : undefined

  if (!mapId) {
    throw createError({
      statusCode: 400,
      message: 'Map ID is required',
    })
  }

  let sql = `
    SELECT
      m.id,
      m.map_id,
      m.entity_id,
      m.x,
      m.y,
      m.custom_icon,
      m.custom_color,
      m.custom_label,
      m.notes,
      m.created_at,
      m.updated_at,
      e.name as entity_name,
      et.name as entity_type,
      e.image_url as entity_image_url
    FROM map_markers m
    JOIN entities e ON m.entity_id = e.id
    JOIN entity_types et ON e.type_id = et.id
    WHERE m.map_id = ?
  `

  const params: (string | number)[] = [mapId]

  if (entityId !== undefined) {
    sql += ' AND m.entity_id = ?'
    params.push(entityId)
  }

  sql += ' ORDER BY m.created_at DESC'

  const markers = db.prepare<(string | number)[], MapMarker>(sql).all(...params)

  return markers
})
