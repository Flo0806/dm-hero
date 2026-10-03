import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { approveDevice, isKnownPlayer, rejectDevice } from '../../../utils/relay-keys'
import { resolvePending } from '../../../utils/relay-presence'

// DM decides on a new player device: approve (gets the game key) or reject (kicked)
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  const body = await readBody<{ playerId?: number, publicKey?: string, approve?: boolean }>(event)
  const playerId = Number(body?.playerId)
  if (typeof body?.publicKey !== 'string' || typeof body.approve !== 'boolean') {
    throw createError({ statusCode: 400, message: 'playerId, publicKey and approve required' })
  }
  if (!getDb().prepare('SELECT 1 FROM game_tables WHERE id = ?').get(tableId) || !isKnownPlayer(tableId, playerId)) {
    throw createError({ statusCode: 404, message: 'Player not found at this table' })
  }

  if (body.approve) await approveDevice(tableId, playerId, body.publicKey)
  else await rejectDevice(tableId, playerId, body.publicKey)
  resolvePending(tableId, body.publicKey)
  return { success: true }
})
