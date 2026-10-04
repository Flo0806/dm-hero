import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { getRelayAuth } from '../../../utils/relay'
import { withdrawHandout, type HandoutRow } from '../../../utils/share/handouts'
import { withTableLock } from '../../../utils/share/sync'

// Withdraw a handout - its recipients lose it right away
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'handout id')
  const row = db.prepare('SELECT * FROM game_table_handouts WHERE id = ?').get(id) as (HandoutRow & { game_table_id: number }) | undefined
  if (!row) throw createError({ statusCode: 404, message: 'Handout not found' })

  await withTableLock(row.game_table_id, () => withdrawHandout(db, getRelayAuth(db, row.game_table_id), row))
  return { success: true }
})
