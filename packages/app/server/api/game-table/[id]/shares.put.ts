import { randomBytes } from 'node:crypto'
import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { getShareKind } from '../../../utils/share/registry'
import { syncTableShares } from '../../../utils/share/sync'

// Share something (or change which fields are shared). Players get it right away.
export default defineEventHandler(async (event) => {
  const db = getDb()
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  const body = await readBody<{ type?: string, entityId?: number, fields?: string[], displayName?: string | null }>(event)
  const kind = getShareKind(String(body?.type))
  const entityId = requireNumericParam(String(body?.entityId ?? ''), 'entityId')

  // Only fields the kind allows - anything else is silently impossible to share
  const fields = Array.isArray(body?.fields) ? kind.fields.filter(f => body!.fields!.includes(f)) : []
  if (!fields.length) throw createError({ statusCode: 400, message: 'Choose at least one field' })
  if (!db.prepare('SELECT 1 FROM game_tables WHERE id = ?').get(tableId)) throw createError({ statusCode: 404, message: 'Game not found' })
  if (!kind.build(db, entityId, fields)) throw createError({ statusCode: 404, message: 'Nothing to share' })
  // Alias instead of the real name (empty = real name)
  const displayName = typeof body?.displayName === 'string' && body.displayName.trim() ? body.displayName.trim().slice(0, 120) : null

  db.prepare(`
    INSERT INTO game_table_shares (game_table_id, share_key, entity_type, entity_id, fields, display_name) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (game_table_id, entity_type, entity_id)
    DO UPDATE SET fields = excluded.fields, display_name = excluded.display_name, content_hash = NULL, updated_at = CURRENT_TIMESTAMP
  `).run(tableId, randomBytes(12).toString('hex'), body!.type, entityId, JSON.stringify(fields), displayName)

  await syncTableShares(db, tableId)
  return { success: true }
})
