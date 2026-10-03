import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { deleteRelayShare, getRelayAuth } from '../../../utils/relay'
import { removeShareFiles } from '../../../utils/share/files'
import { withTableLock } from '../../../utils/share/sync'

// Stop sharing - players lose it right away
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'share id')
  const share = db.prepare('SELECT game_table_id, share_key FROM game_table_shares WHERE id = ?')
    .get(id) as { game_table_id: number, share_key: string } | undefined
  if (!share) throw createError({ statusCode: 404, message: 'Share not found' })

  // Same lock as the sync - never withdraw while a sync is re-sending it
  await withTableLock(share.game_table_id, async () => {
    const auth = getRelayAuth(db, share.game_table_id)
    if (auth) {
      // Share first (players drop it), then its files - never a share pointing at deleted files
      await deleteRelayShare(auth, share.share_key)
      await removeShareFiles(db, auth, id)
    }
    db.prepare('DELETE FROM game_table_shares WHERE id = ?').run(id)
  })
  return { success: true }
})
