import { query, queryOne } from '../../../utils/db'
import { requireAuth } from '../../../utils/requireAuth'

interface ActionBody {
  action: 'delete'
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const adventureId = Number(getRouterParam(event, 'id'))
  const body = await readBody<ActionBody>(event)

  if (!adventureId || isNaN(adventureId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid adventure ID',
    })
  }

  // Check if user owns this adventure
  const adventure = await queryOne<{ id: number; author_id: number }>(
    'SELECT id, author_id FROM adventures WHERE id = ?',
    [adventureId],
  )

  if (!adventure) {
    throw createError({
      statusCode: 404,
      message: 'Adventure not found',
    })
  }

  if (adventure.author_id !== user.id) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to modify this adventure',
    })
  }

  if (body.action === 'delete') {
    // Delete the adventure (cascade will handle related records)
    await query('DELETE FROM adventures WHERE id = ?', [adventureId])

    return {
      success: true,
      message: 'Adventure deleted successfully',
    }
  }

  throw createError({
    statusCode: 400,
    message: 'Invalid action',
  })
})
