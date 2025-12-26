import { query, queryOne } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/requireAuth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const adventureId = getRouterParam(event, 'slug')
  const body = await readBody<{ rating: number }>(event)

  if (!adventureId || isNaN(Number(adventureId))) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  const rating = body.rating
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, message: 'Rating must be between 1 and 5' })
  }

  // Check adventure exists and has a published version
  const adventure = await queryOne<{ id: number }>(
    'SELECT id FROM adventures WHERE id = ? AND published_version_id IS NOT NULL',
    [adventureId],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Upsert rating (insert or update)
  await query(
    `INSERT INTO adventure_ratings (adventure_id, user_id, rating)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = ?, updated_at = CURRENT_TIMESTAMP`,
    [adventureId, user.id, rating, rating],
  )

  // Get updated average
  const result = await queryOne<{ avg_rating: number; rating_count: number }>(
    `SELECT
       COALESCE(AVG(rating), 0) as avg_rating,
       COUNT(*) as rating_count
     FROM adventure_ratings
     WHERE adventure_id = ?`,
    [adventureId],
  )

  return {
    success: true,
    avgRating: result?.avg_rating || 0,
    ratingCount: result?.rating_count || 0,
    userRating: rating,
  }
})
