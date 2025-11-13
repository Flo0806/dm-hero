import { getDb } from '../../../utils/db'

/**
 * GET /api/factions/:id/counts
 * Returns counts for members (NPCs), lore, documents, and images for a Faction
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const factionId = getRouterParam(event, 'id')

  if (!factionId) {
    throw createError({
      statusCode: 400,
      message: 'Faction ID is required',
    })
  }

  // Get NPCs count (members of this faction)
  const npcTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'NPC'").get() as
    | { id: number }
    | undefined

  let membersCount = 0
  if (npcTypeId) {
    const membersResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(factionId), npcTypeId.id) as { count: number }
    membersCount = membersResult.count
  }

  // Get lore count (Lore entries related to this faction)
  const loreTypeId = db.prepare("SELECT id FROM entity_types WHERE name = 'Lore'").get() as
    | { id: number }
    | undefined

  let loreCount = 0
  if (loreTypeId) {
    const loreResult = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM entity_relations er
      INNER JOIN entities e ON e.id = er.from_entity_id
      WHERE er.to_entity_id = ?
        AND e.type_id = ?
        AND e.deleted_at IS NULL
    `,
      )
      .get(Number(factionId), loreTypeId.id) as { count: number }
    loreCount = loreResult.count
  }

  // Get documents count
  const documentsCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_documents
    WHERE entity_id = ?
  `,
    )
    .get(Number(factionId)) as { count: number }

  // Get images count
  const imagesCount = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM entity_images
    WHERE entity_id = ?
  `,
    )
    .get(Number(factionId)) as { count: number }

  return {
    members: membersCount,
    lore: loreCount,
    documents: documentsCount.count,
    images: imagesCount.count,
  }
})
