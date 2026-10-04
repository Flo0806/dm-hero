import { createGameKeys } from '@dm-hero/seal'
import { getDb } from '../../../utils/db'
import { getGameTableById, requireNumericParam } from '../../../utils/game-table'
import { createRelayGame, syncRelayPlayers } from '../../../utils/relay'
import { restartPresence } from '../../../utils/relay-presence'
import { forgetTableInfo } from '../../../utils/share/info'
import { forgetThreads } from '../../../utils/share/messages'
import { withTableLock } from '../../../utils/share/sync'

// The player server no longer knows this game (expired, or another server):
// register it there again. Nothing in DM Hero is deleted - players, PINs, shares
// and the shown map stay. New code + keys; players join again with their PIN.
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const db = getDb()
  if (!db.prepare('SELECT 1 FROM game_tables WHERE id = ?').get(tableId)) throw createError({ statusCode: 404, message: 'Game not found' })

  const keys = await createGameKeys()
  const relay = await createRelayGame({ signing: keys.signing.publicKey, exchange: keys.exchange.publicKey })

  await withTableLock(tableId, async () => {
    db.prepare(`
      UPDATE game_tables SET code = ?, relay_game_id = ?, relay_dm_token = ?, e2e_keys = ?,
        map_state = NULL, map_hash = NULL, fog_hash = NULL
      WHERE id = ?
    `).run(relay.code, relay.gameId, relay.dmToken, JSON.stringify(keys), tableId)
    // Everything on the old server is gone: devices approve again, shares + files go up again
    db.prepare('DELETE FROM game_table_devices WHERE game_table_id = ?').run(tableId)
    db.prepare('DELETE FROM game_table_share_files WHERE share_id IN (SELECT id FROM game_table_shares WHERE game_table_id = ?)').run(tableId)
    db.prepare('UPDATE game_table_shares SET content_hash = NULL WHERE game_table_id = ?').run(tableId)
    db.prepare('UPDATE game_table_handouts SET content_hash = NULL, file_source = NULL, file_ref = NULL WHERE game_table_id = ?').run(tableId)
  })

  forgetTableInfo(tableId)
  forgetThreads(tableId)
  await syncRelayPlayers(db, tableId)
  // New connection to the new game - shares and map are sent once it's up
  restartPresence(tableId)
  return getGameTableById(db, tableId)
})
