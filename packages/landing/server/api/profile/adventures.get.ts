import { query } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'

interface AdventureRow {
  id: number
  title: string
  slug: string
  cover_image_url: string | null
  download_count: number
  status: string
  created_at: Date
}

interface RatingRow {
  adventure_id: number
  avg_rating: number
  rating_count: number
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Get user's adventures
  const adventures = await query<AdventureRow[]>(
    `SELECT id, title, slug, cover_image_url, download_count, status, created_at
     FROM adventures
     WHERE author_id = ?
     ORDER BY created_at DESC`,
    [user.id],
  )

  // Get ratings for all adventures
  const adventureIds = adventures.map((a) => a.id)
  let ratings: RatingRow[] = []

  if (adventureIds.length > 0) {
    ratings = await query<RatingRow[]>(
      `SELECT adventure_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
       FROM adventure_ratings
       WHERE adventure_id IN (${adventureIds.map(() => '?').join(',')})
       GROUP BY adventure_id`,
      adventureIds,
    )
  }

  const ratingsMap = new Map(ratings.map((r) => [r.adventure_id, r]))

  // Calculate total stats
  const totalDownloads = adventures.reduce((sum, a) => sum + a.download_count, 0)
  const allRatings = ratings.flatMap((r) => [r])
  const avgRating =
    allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + Number(r.avg_rating), 0) / allRatings.length
      : 0
  const totalRatings = ratings.reduce((sum, r) => sum + Number(r.rating_count), 0)

  return {
    adventures: adventures.map((a) => {
      const ratingInfo = ratingsMap.get(a.id)
      return {
        id: a.id,
        title: a.title,
        slug: a.slug,
        coverImageUrl: a.cover_image_url,
        downloadCount: a.download_count,
        avgRating: ratingInfo ? Number(ratingInfo.avg_rating) : null,
        status: a.status,
      }
    }),
    stats: {
      totalAdventures: adventures.length,
      totalDownloads,
      avgRating,
      totalRatings,
    },
  }
})
