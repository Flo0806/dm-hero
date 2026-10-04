import { randomUUID } from 'node:crypto'
import { HANDOUTS_PER_GAME } from '@dm-hero/seal'
import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { syncTableHandouts } from '../../../utils/share/handouts'

// Hand a document out (or change who gets it). recipients: 'all' or player ids.
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const body = await readBody<{ documentId?: number, recipients?: unknown }>(event)
  const documentId = Number(body?.documentId)
  const recipients = body?.recipients
  const validRecipients = recipients === 'all'
    || (Array.isArray(recipients) && recipients.length > 0 && recipients.every(id => Number.isInteger(id)))
  if (!Number.isInteger(documentId) || !validRecipients) {
    throw createError({ statusCode: 400, message: 'documentId and recipients (\'all\' or player ids) required' })
  }

  const db = getDb()
  // Only documents of this game's campaign
  const sameCampaign = db.prepare(`
    SELECT 1 FROM entity_documents d
    JOIN entities e ON e.id = d.entity_id AND e.deleted_at IS NULL
    JOIN game_tables g ON g.campaign_id = e.campaign_id
    WHERE d.id = ? AND g.id = ?
  `).get(documentId, tableId)
  if (!sameCampaign) throw createError({ statusCode: 400, message: 'Document belongs to another campaign' })

  if (Array.isArray(recipients)) {
    const known = db.prepare(`SELECT COUNT(*) AS n FROM game_table_players WHERE game_table_id = ? AND id IN (${recipients.map(() => '?').join(',')})`)
      .get(tableId, ...recipients) as { n: number }
    if (known.n !== recipients.length) throw createError({ statusCode: 400, message: 'Unknown player' })
  }

  const existing = db.prepare('SELECT id, recipients, content_hash FROM game_table_handouts WHERE game_table_id = ? AND document_id = ?')
    .get(tableId, documentId) as { id: number, recipients: string, content_hash: string | null } | undefined
  if (!existing) {
    const count = (db.prepare('SELECT COUNT(*) AS n FROM game_table_handouts WHERE game_table_id = ?').get(tableId) as { n: number }).n
    if (count >= HANDOUTS_PER_GAME) throw createError({ statusCode: 413, message: `At most ${HANDOUTS_PER_GAME} handouts per game` })
  }
  const stored = recipients === 'all' ? 'all' : JSON.stringify(recipients)
  const handoutId = existing?.id ?? Number(db.prepare('INSERT INTO game_table_handouts (game_table_id, handout_key, document_id, recipients) VALUES (?, ?, ?, ?)')
    .run(tableId, randomUUID(), documentId, stored).lastInsertRowid)
  if (existing) db.prepare('UPDATE game_table_handouts SET recipients = ?, content_hash = NULL WHERE id = ?').run(stored, existing.id)

  // Only this handout's problem is the caller's business:
  // too large -> refused (a new one isn't kept); relay unreachable -> kept, the timer retries
  const error = (await syncTableHandouts(db, tableId)).get(handoutId)
  if (error && (error as { statusCode?: number }).statusCode === 413) {
    // Refused: a new one isn't kept, an existing one keeps its previous recipients
    if (!existing) db.prepare('DELETE FROM game_table_handouts WHERE id = ?').run(handoutId)
    else db.prepare('UPDATE game_table_handouts SET recipients = ?, content_hash = ? WHERE id = ?').run(existing.recipients, existing.content_hash, existing.id)
    throw error
  }
  return { id: handoutId, pending: !!error }
})
