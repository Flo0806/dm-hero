import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { deleteRelayGame, getRelayAuth } from '../../../utils/relay'
import { stopPresence } from '../../../utils/relay-presence'

// Close the game: removes it on the relay (players get kicked) and locally for good
export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  const auth = getRelayAuth(db, id)

  stopPresence(id)
  if (auth) {
    // Relay down must not block closing locally - its games expire there anyway
    await deleteRelayGame(auth).catch(error => console.error('[Relay] Delete failed:', error))
  }

  const result = db.prepare('DELETE FROM game_tables WHERE id = ?').run(id)
  if (result.changes === 0) throw createError({ statusCode: 404, message: 'Game not found' })
  return { success: true }
})
