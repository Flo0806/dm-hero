import { query } from '../../utils/db'

// DB row type (snake_case from MySQL)
interface AdventureRow {
  id: number
  title: string
  slug: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  price_cents: number
  currency: string
  download_count: number
  language: string
  tags: string | null
  author_name: string | null
  display_name: string
  avg_rating: number | null
  rating_count: number
}

// Transform to camelCase for frontend
function transformAdventure(row: AdventureRow) {
  let tags: string[] = []
  try {
    tags = row.tags ? JSON.parse(row.tags) : []
  } catch { /* ignore */ }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description,
    coverImageUrl: row.cover_image_url,
    priceCents: row.price_cents,
    currency: row.currency,
    downloadCount: row.download_count,
    language: row.language,
    tags,
    authorName: row.author_name || row.display_name,
    avgRating: row.avg_rating,
    ratingCount: row.rating_count,
  }
}

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)

  const page = Math.max(1, Number(queryParams.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(queryParams.limit) || 20))
  const offset = (page - 1) * limit

  const search = queryParams.search as string | undefined
  const language = queryParams.language as string | undefined
  const sortBy = queryParams.sort as string || 'newest'

  // Build query
  let sql = `
    SELECT
      a.*,
      u.display_name as author_name,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(DISTINCT r.id) as rating_count
    FROM adventures a
    JOIN users u ON a.author_id = u.id
    LEFT JOIN adventure_ratings r ON a.id = r.adventure_id
    WHERE a.status = 'published'
  `

  const params: unknown[] = []

  if (search) {
    sql += ` AND MATCH(a.title, a.description) AGAINST(? IN NATURAL LANGUAGE MODE)`
    params.push(search)
  }

  if (language) {
    sql += ` AND a.language = ?`
    params.push(language)
  }

  sql += ` GROUP BY a.id`

  // Sorting
  switch (sortBy) {
    case 'popular':
      sql += ` ORDER BY a.download_count DESC`
      break
    case 'rating':
      sql += ` ORDER BY avg_rating DESC, rating_count DESC`
      break
    case 'oldest':
      sql += ` ORDER BY a.published_at ASC`
      break
    case 'newest':
    default:
      sql += ` ORDER BY a.published_at DESC`
  }

  // LIMIT/OFFSET use string interpolation (safe - already validated integers)
  // MySQL prepared statements have known issues with these parameters
  sql += ` LIMIT ${limit} OFFSET ${offset}`

  const rows = await query<AdventureRow[]>(sql, params)

  // Get total count
  let countSql = `SELECT COUNT(*) as total FROM adventures WHERE status = 'published'`
  const countParams: unknown[] = []

  if (search) {
    countSql += ` AND MATCH(title, description) AGAINST(? IN NATURAL LANGUAGE MODE)`
    countParams.push(search)
  }

  if (language) {
    countSql += ` AND language = ?`
    countParams.push(language)
  }

  const [countResult] = await query<{ total: number }[]>(countSql, countParams)
  const total = countResult?.total || 0

  return {
    adventures: rows.map(transformAdventure),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
})
