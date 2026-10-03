import { loadGameKeys, seal, type StoredGameKeys } from '@dm-hero/seal'
import { isPingContent } from '~~/types/fog'
import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { getRelayAuth, postRelayDmPing } from '../../../utils/relay'

// The DM pings a spot on the map the players see (signed - players know it's the DM)
export default defineEventHandler(async (event) => {
  const tableId = requireNumericParam(getRouterParam(event, 'id'), 'id')
  const body = await readBody(event)
  if (!isPingContent(body)) throw createError({ statusCode: 400, message: 'mapId, x and y (0-100) required, text max 80 characters' })
  const text = body.text?.trim() || undefined

  const db = getDb()
  const table = db.prepare('SELECT relay_game_id, e2e_keys, shown_map_id FROM game_tables WHERE id = ?')
    .get(tableId) as { relay_game_id: string, e2e_keys: string | null, shown_map_id: number | null } | undefined
  if (!table) throw createError({ statusCode: 404, message: 'Game not found' })
  if (table.shown_map_id !== body.mapId) throw createError({ statusCode: 409, message: 'Map is not shown to the players' })
  const auth = getRelayAuth(db, tableId)
  if (!auth || !table.e2e_keys) throw createError({ statusCode: 409, message: 'Game not ready' })

  const keys = await loadGameKeys(JSON.parse(table.e2e_keys) as StoredGameKeys)
  const envelope = await seal(
    keys.gameKey,
    { v: 1, gameId: table.relay_game_id, from: 'dm', to: 'all', epoch: keys.epoch, seq: Date.now() },
    { mapId: body.mapId, x: body.x, y: body.y, ...(text && { text }) },
    keys.signingKey,
  )
  await postRelayDmPing(auth, envelope)
  return { ok: true }
})
