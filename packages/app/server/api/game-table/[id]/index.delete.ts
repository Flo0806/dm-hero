import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { endGameTable } from '../../../utils/relay'
import { stopPresence } from '../../../utils/relay-presence'

// Close the game: removes it on the relay (players get kicked) and locally for good
export default defineEventHandler(async (event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  stopPresence(id)
  if (!await endGameTable(getDb(), id)) throw createError({ statusCode: 404, message: 'Game not found' })
  return { success: true }
})
