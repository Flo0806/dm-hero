import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { watchMessages } from '../../../utils/relay-presence'

// Live "a player wrote" for open pages (they reload the messages)
export default defineEventHandler((event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  if (!getDb().prepare('SELECT 1 FROM game_tables WHERE id = ?').get(id)) {
    throw createError({ statusCode: 404, message: 'Game not found' })
  }
  const stream = createEventStream(event)
  const unwatch = watchMessages(id, playerId => void stream.push(JSON.stringify({ playerId })))
  stream.onClosed(async () => {
    unwatch()
    await stream.close()
  })
  return stream.send()
})
