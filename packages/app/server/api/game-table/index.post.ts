import { getDb } from '../../utils/db'
import { getGameTableById, requireNumericParam } from '../../utils/game-table'
import { createRelayGame } from '../../utils/relay'

// Start a game for a campaign - only one per campaign. The relay registers it and hands out the code.
export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<{ campaignId?: number }>(event)
  const campaignId = requireNumericParam(String(body?.campaignId ?? ''), 'campaignId')

  if (db.prepare('SELECT 1 FROM game_tables WHERE campaign_id = ?').get(campaignId)) {
    throw createError({ statusCode: 409, message: 'A game is already running for this campaign' })
  }

  const relay = await createRelayGame()
  const id = Number(
    db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token) VALUES (?, ?, ?, ?)')
      .run(campaignId, relay.code, relay.gameId, relay.dmToken).lastInsertRowid,
  )
  return getGameTableById(db, id)
})
