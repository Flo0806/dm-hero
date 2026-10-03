import { getDb } from '../../utils/db'
import { getGameTableById, requireNumericParam } from '../../utils/game-table'
import { createGameKeys } from '@dm-hero/seal'
import { createRelayGame } from '../../utils/relay'

// Start a game for a campaign - only one per campaign. The relay registers it and hands out the code.
export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<{ campaignId?: number }>(event)
  const campaignId = requireNumericParam(String(body?.campaignId ?? ''), 'campaignId')

  if (db.prepare('SELECT 1 FROM game_tables WHERE campaign_id = ?').get(campaignId)) {
    throw createError({ statusCode: 409, message: 'A game is already running for this campaign' })
  }

  // E2E keys are created here and stay here - only the public halves go to the relay
  const keys = await createGameKeys()
  const relay = await createRelayGame({ signing: keys.signing.publicKey, exchange: keys.exchange.publicKey })
  const id = Number(
    db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
      .run(campaignId, relay.code, relay.gameId, relay.dmToken, JSON.stringify(keys)).lastInsertRowid,
  )
  return getGameTableById(db, id)
})
