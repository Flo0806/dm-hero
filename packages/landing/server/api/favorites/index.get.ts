import { query } from '../../utils/db'
import { requireAuth } from '../../utils/requireAuth'

interface FavoriteAdventure {
  id: number
  adventureId: number
  title: string
  slug: string
  coverImageUrl: string | null
  authorName: string | null
  priceCents: number
  currency: string
  createdAt: string
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const favorites = await query<FavoriteAdventure[]>(
    `SELECT
       f.id,
       f.adventure_id as adventureId,
       a.title,
       a.slug,
       a.cover_image_url as coverImageUrl,
       a.author_name as authorName,
       a.price_cents as priceCents,
       a.currency,
       f.created_at as createdAt
     FROM user_favorites f
     JOIN adventures a ON a.id = f.adventure_id
     WHERE f.user_id = ? AND a.status = 'published'
     ORDER BY f.created_at DESC`,
    [user.id],
  )

  return { favorites }
})
