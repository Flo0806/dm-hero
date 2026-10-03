import { getDb } from '../../../utils/db'
import { requireNumericParam } from '../../../utils/game-table'
import { watchPings } from '../../../utils/relay-presence'

// Live pings of the players for the map page
export default defineEventHandler((event) => {
  const id = requireNumericParam(getRouterParam(event, 'id'), 'game table id')
  if (!getDb().prepare('SELECT 1 FROM game_tables WHERE id = ?').get(id)) {
    throw createError({ statusCode: 404, message: 'Game not found' })
  }

  const stream = createEventStream(event)
  const unwatch = watchPings(id, ping => void stream.push(JSON.stringify(ping)))
  stream.onClosed(async () => {
    unwatch()
    await stream.close()
  })
  return stream.send()
})
