import { getDb } from '../../../utils/db'

interface MentionRow {
  id: number
  session_id: number
  entity_id: number
  context: string | null
  created_at: string
  entity_name: string
  entity_type: string
  entity_image: string | null
  entity_description: string | null
}

export default defineEventHandler((event) => {
  const db = getDb()
  const sessionId = getRouterParam(event, 'id')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  // Get mentions with entity info
  const mentions = db
    .prepare(
      `
    SELECT
      sm.id,
      sm.session_id,
      sm.entity_id,
      sm.context,
      sm.created_at,
      e.name as entity_name,
      et.name as entity_type,
      e.image_url as entity_image,
      e.description as entity_description
    FROM session_mentions sm
    INNER JOIN entities e ON e.id = sm.entity_id
    INNER JOIN entity_types et ON et.id = e.type_id
    WHERE sm.session_id = ?
      AND e.deleted_at IS NULL
    ORDER BY et.name, e.name
  `,
    )
    .all(sessionId) as MentionRow[]

  // Group by entity type
  const grouped: Record<string, MentionRow[]> = {}
  for (const mention of mentions) {
    const type = mention.entity_type.toLowerCase()
    if (!grouped[type]) {
      grouped[type] = []
    }
    grouped[type].push(mention)
  }

  return { mentions, grouped }
})
