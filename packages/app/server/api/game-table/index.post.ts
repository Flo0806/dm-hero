import { getDb } from '../../utils/db'
import { generateGameCode, getGameTableById, requireNumericParam } from '../../utils/game-table'

// Start a game for a campaign - only one per campaign
export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody<{ campaignId?: number }>(event)
  const campaignId = requireNumericParam(String(body?.campaignId ?? ''), 'campaignId')

  if (db.prepare('SELECT 1 FROM game_tables WHERE campaign_id = ?').get(campaignId)) {
    throw createError({ statusCode: 409, message: 'A game is already running for this campaign' })
  }

  let code = generateGameCode()
  while (db.prepare('SELECT 1 FROM game_tables WHERE code = ?').get(code)) code = generateGameCode()

  const id = Number(db.prepare('INSERT INTO game_tables (campaign_id, code) VALUES (?, ?)').run(campaignId, code).lastInsertRowid)
  return getGameTableById(db, id)
})
