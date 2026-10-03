import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { deleteRelayShare, getRelayAuth } from '../../../utils/relay'

// Stop sharing - players lose it right away
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'share id')
  const share = db.prepare('SELECT game_table_id, share_key FROM game_table_shares WHERE id = ?')
    .get(id) as { game_table_id: number, share_key: string } | undefined
  if (!share) throw createError({ statusCode: 404, message: 'Share not found' })

  const auth = getRelayAuth(db, share.game_table_id)
  if (auth) await deleteRelayShare(auth, share.share_key)
  db.prepare('DELETE FROM game_table_shares WHERE id = ?').run(id)
  return { success: true }
})
