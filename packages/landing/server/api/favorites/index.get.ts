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

  // Join with adventure_versions to get published version data
  const favorites = await query<FavoriteAdventure[]>(
    `SELECT
       f.id,
       f.adventure_id as adventureId,
       av.title,
       a.slug,
       av.cover_image_url as coverImageUrl,
       av.author_name as authorName,
       av.price_cents as priceCents,
       av.currency,
       f.created_at as createdAt
     FROM user_favorites f
     JOIN adventures a ON a.id = f.adventure_id
     JOIN adventure_versions av ON a.published_version_id = av.id
     WHERE f.user_id = ? AND a.published_version_id IS NOT NULL
     ORDER BY f.created_at DESC`,
    [user.id],
  )

  return { favorites }
})
