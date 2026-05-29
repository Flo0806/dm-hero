import { getDb } from '~~/server/utils/db'

/**
 * Lists / searches entities that ALREADY EXIST in a campaign, so an AI can
 * resolve names to ids (e.g. a PDF's "lives in Eichwald" → find Eichwald's id)
 * and then link to it (relation "existing:<id>") or edit it (update_entities).
 *
 * GET /api/import/entities?campaignId=18&q=eich&type=Location&limit=50
 *   - q:    optional case-insensitive substring match on the name
 *   - type: optional entity type filter (NPC | Location | Item | Faction | Lore)
 *   - limit: capped at 500 (default 100)
 */
export default defineEventHandler((event) => {
  const db = getDb()
  const q = getQuery(event)

  const campaignId = Number(q.campaignId)
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    throw createError({ statusCode: 400, message: 'campaignId is required' })
  }

  const type = typeof q.type === 'string' && q.type.trim() ? q.type.trim() : undefined
  const search = typeof q.q === 'string' ? q.q.trim() : ''
  const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500)

  const where: string[] = ['e.campaign_id = ?', 'e.deleted_at IS NULL']
  const params: unknown[] = [campaignId]
  if (type) {
    where.push('t.name = ?')
    params.push(type)
  }
  if (search) {
    // Escape LIKE wildcards so a literal % or _ in the query isn't a wildcard.
    const escaped = search.replace(/[\\%_]/g, c => `\\${c}`)
    where.push('e.name LIKE ? ESCAPE \'\\\'')
    params.push(`%${escaped}%`)
  }

  const rows = db
    .prepare(`
      SELECT e.id, t.name AS type, e.name, ef.name AS folder
      FROM entities e
      JOIN entity_types t ON t.id = e.type_id
      LEFT JOIN entity_folders ef ON ef.id = e.folder_id
      WHERE ${where.join(' AND ')}
      ORDER BY e.name COLLATE NOCASE
      LIMIT ?
    `)
    .all(...params, limit) as { id: number, type: string, name: string, folder: string | null }[]

  return {
    campaignId,
    count: rows.length,
    truncated: rows.length === limit,
    entities: rows,
  }
})
