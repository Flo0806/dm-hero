import { query } from '../../utils/db'

// DB row type (snake_case from MySQL)
interface AdventureRow {
  id: number
  slug: string
  download_count: number
  published_version_id: number
  // From adventure_versions (published)
  version_id: number
  version_number: number
  title: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  price_cents: number
  currency: string
  language: string
  tags: string | null
  system: string | null
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: number
  highlights: string | null
  author_name: string | null
  published_at: string | null
  // From users
  display_name: string
  // Computed
  avg_rating: number | null
  rating_count: number
}

// Transform to camelCase for frontend
function transformAdventure(row: AdventureRow) {
  let tags: string[] = []
  let highlights: string[] = []
  try {
    tags = row.tags ? JSON.parse(row.tags) : []
  } catch { /* ignore */ }
  try {
    highlights = row.highlights ? JSON.parse(row.highlights) : []
  } catch { /* ignore */ }

  return {
    id: row.id,
    slug: row.slug,
    downloadCount: row.download_count,
    versionId: row.version_id,
    versionNumber: row.version_number,
    title: row.title,
    description: row.description,
    shortDescription: row.short_description,
    coverImageUrl: row.cover_image_url,
    priceCents: row.price_cents,
    currency: row.currency,
    language: row.language,
    tags,
    system: row.system || 'dnd5e',
    difficulty: row.difficulty || 3,
    playersMin: row.players_min || 3,
    playersMax: row.players_max || 5,
    levelMin: row.level_min || 1,
    levelMax: row.level_max || 5,
    durationHours: row.duration_hours || 4,
    highlights,
    authorName: row.author_name || row.display_name,
    avgRating: row.avg_rating,
    ratingCount: row.rating_count,
    publishedAt: row.published_at,
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

  // Build query - join adventures with published version
  let sql = `
    SELECT
      a.id,
      a.slug,
      a.download_count,
      a.published_version_id,
      av.id as version_id,
      av.version_number,
      av.title,
      av.description,
      av.short_description,
      av.cover_image_url,
      av.price_cents,
      av.currency,
      av.language,
      av.tags,
      av.system,
      av.difficulty,
      av.players_min,
      av.players_max,
      av.level_min,
      av.level_max,
      av.duration_hours,
      av.highlights,
      av.author_name,
      av.published_at,
      u.display_name,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(DISTINCT r.id) as rating_count
    FROM adventures a
    JOIN adventure_versions av ON a.published_version_id = av.id
    JOIN users u ON a.author_id = u.id
    LEFT JOIN adventure_ratings r ON a.id = r.adventure_id
    WHERE a.published_version_id IS NOT NULL
  `

  const params: unknown[] = []

  if (search) {
    sql += ' AND MATCH(av.title, av.description) AGAINST(? IN NATURAL LANGUAGE MODE)'
    params.push(search)
  }

  if (language) {
    sql += ' AND av.language = ?'
    params.push(language)
  }

  sql += ' GROUP BY a.id, av.id'

  // Sorting
  switch (sortBy) {
    case 'popular':
      sql += ' ORDER BY a.download_count DESC'
      break
    case 'rating':
      sql += ' ORDER BY avg_rating DESC, rating_count DESC'
      break
    case 'oldest':
      sql += ' ORDER BY av.published_at ASC'
      break
    case 'newest':
    default:
      sql += ' ORDER BY av.published_at DESC'
  }

  // LIMIT/OFFSET use string interpolation (safe - already validated integers)
  sql += ` LIMIT ${limit} OFFSET ${offset}`

  const rows = await query<AdventureRow[]>(sql, params)

  // Get total count
  let countSql = `
    SELECT COUNT(*) as total
    FROM adventures a
    JOIN adventure_versions av ON a.published_version_id = av.id
    WHERE a.published_version_id IS NOT NULL
  `
  const countParams: unknown[] = []

  if (search) {
    countSql += ' AND MATCH(av.title, av.description) AGAINST(? IN NATURAL LANGUAGE MODE)'
    countParams.push(search)
  }

  if (language) {
    countSql += ' AND av.language = ?'
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
