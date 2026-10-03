import { getDb } from '../../utils/db'
import { getGameTableById, requireNumericParam } from '../../utils/game-table'
import { createGameKeys } from '@dm-hero/seal'
import { createRelayGame, endGameTable } from '../../utils/relay'
import { stopPresence } from '../../utils/relay-presence'

// Start a game for a campaign. Only one per campaign: an existing game is ended first.
// The relay registers the new game and hands out the code.
export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<{ campaignId?: number }>(event)
  const campaignId = requireNumericParam(String(body?.campaignId ?? ''), 'campaignId')

  // Keys + relay registration first: if the relay is down, the old game stays untouched.
  // E2E keys are created here and stay here - only the public halves go to the relay.
  const keys = await createGameKeys()
  const relay = await createRelayGame({ signing: keys.signing.publicKey, exchange: keys.exchange.publicKey })

  const existing = db.prepare('SELECT id FROM game_tables WHERE campaign_id = ?').get(campaignId) as { id: number } | undefined
  if (existing) {
    stopPresence(existing.id)
    await endGameTable(db, existing.id)
  }
  const id = Number(
    db.prepare('INSERT INTO game_tables (campaign_id, code, relay_game_id, relay_dm_token, e2e_keys) VALUES (?, ?, ?, ?, ?)')
      .run(campaignId, relay.code, relay.gameId, relay.dmToken, JSON.stringify(keys)).lastInsertRowid,
  )
  return getGameTableById(db, id)
})
