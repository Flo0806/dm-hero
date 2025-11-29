import { getDb } from '../../../utils/db'

interface DbConnection {
  relation_id: number
  entity_id: number
  entity_name: string
  entity_type: string
  entity_type_id: number
  entity_icon: string
  entity_color: string
  entity_image_url: string | null
  relation_type: string
  relation_notes: string | null
  direction: 'outgoing' | 'incoming'
}

export default defineEventHandler((event) => {
  const db = getDb()
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid entity ID',
    })
  }

  // Get outgoing relations (this entity -> other entities)
  const outgoing = db
    .prepare<unknown[], DbConnection>(
      `
      SELECT
        er.id as relation_id,
        e.id as entity_id,
        e.name as entity_name,
        et.name as entity_type,
        et.id as entity_type_id,
        et.icon as entity_icon,
        et.color as entity_color,
        e.image_url as entity_image_url,
        er.relation_type,
        er.notes as relation_notes,
        'outgoing' as direction
      FROM entity_relations er
      INNER JOIN entities e ON er.to_entity_id = e.id
      INNER JOIN entity_types et ON e.type_id = et.id
      WHERE er.from_entity_id = ?
        AND e.deleted_at IS NULL
      ORDER BY et.name, e.name
    `,
    )
    .all(id)

  // Get incoming relations (other entities -> this entity)
  const incoming = db
    .prepare<unknown[], DbConnection>(
      `
      SELECT
        er.id as relation_id,
        e.id as entity_id,
        e.name as entity_name,
        et.name as entity_type,
        et.id as entity_type_id,
        et.icon as entity_icon,
        et.color as entity_color,
        e.image_url as entity_image_url,
        er.relation_type,
        er.notes as relation_notes,
        'incoming' as direction
      FROM entity_relations er
      INNER JOIN entities e ON er.from_entity_id = e.id
      INNER JOIN entity_types et ON e.type_id = et.id
      WHERE er.to_entity_id = ?
        AND e.deleted_at IS NULL
      ORDER BY et.name, e.name
    `,
    )
    .all(id)

  // Combine and deduplicate (same entity might have multiple relation types)
  const allConnections = [...outgoing, ...incoming]

  // Parse notes and return
  return allConnections.map((conn) => {
    let parsedNotes = null
    if (conn.relation_notes) {
      try {
        parsedNotes = JSON.parse(conn.relation_notes)
      } catch {
        parsedNotes = conn.relation_notes
      }
    }

    return {
      relationId: conn.relation_id,
      entityId: conn.entity_id,
      entityName: conn.entity_name,
      entityType: conn.entity_type,
      entityTypeId: conn.entity_type_id,
      entityIcon: conn.entity_icon,
      entityColor: conn.entity_color,
      entityImageUrl: conn.entity_image_url,
      relationType: conn.relation_type,
      relationNotes: parsedNotes,
      direction: conn.direction,
    }
  })
})
