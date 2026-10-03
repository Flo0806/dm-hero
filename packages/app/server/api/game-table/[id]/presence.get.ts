import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { watchPresence } from '../../../utils/relay-presence'

// Live "who is online" for the game table page (relay connection + online player ids)
export default defineEventHandler((event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  if (!getDb().prepare('SELECT 1 FROM game_tables WHERE id = ?').get(id)) {
    throw createError({ statusCode: 404, message: 'Game not found' })
  }

  const stream = createEventStream(event)
  const unwatch = watchPresence(id, state => void stream.push(JSON.stringify(state)))
  stream.onClosed(async () => {
    unwatch()
    await stream.close()
  })
  return stream.send()
})
