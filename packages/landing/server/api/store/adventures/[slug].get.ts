import { query, queryOne } from '../../../utils/db'
import type { AdventureDetailResponse } from '~~/types/store'

interface AdventureRow {
  // From adventures
  id: number
  slug: string
  download_count: number
  published_version_id: number
  // From adventure_versions
  version_id: number
  version_number: number
  title: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  system: string
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: number
  highlights: string | null
  tags: string | null
  price_cents: number
  currency: string
  language: string
  author_name: string | null
  author_discord: string | null
  published_at: string | null
  // From users
  display_name: string
  // Computed
  avg_rating: number
  rating_count: number
}

interface FileRow {
  id: number
  file_path: string
  file_size: number
  version_number: number
}

export default defineEventHandler(async (event): Promise<AdventureDetailResponse> => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  // Fetch adventure with published version, author info and ratings
  const adventure = await queryOne<AdventureRow>(
    `SELECT
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
      av.system,
      av.difficulty,
      av.players_min,
      av.players_max,
      av.level_min,
      av.level_max,
      av.duration_hours,
      av.highlights,
      av.tags,
      av.price_cents,
      av.currency,
      av.language,
      av.author_name,
      av.author_discord,
      av.published_at,
      u.display_name,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(DISTINCT r.id) as rating_count
    FROM adventures a
    JOIN adventure_versions av ON a.published_version_id = av.id
    JOIN users u ON a.author_id = u.id
    LEFT JOIN adventure_ratings r ON a.id = r.adventure_id
    WHERE a.slug = ? AND a.published_version_id IS NOT NULL
    GROUP BY a.id, av.id`,
    [slug],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Fetch files for this published version
  const files = await query<FileRow[]>(
    `SELECT id, file_path, file_size, version_number
     FROM adventure_files
     WHERE version_id = ?
     ORDER BY version_number DESC`,
    [adventure.version_id],
  )

  // Parse JSON fields (MySQL may return as object or string)
  let highlights: string[] = []
  let tags: string[] = []
  try {
    highlights = typeof adventure.highlights === 'string' ? JSON.parse(adventure.highlights) : (adventure.highlights || [])
    tags = typeof adventure.tags === 'string' ? JSON.parse(adventure.tags) : (adventure.tags || [])
  } catch {
    // Ignore parse errors
  }

  return {
    adventure: {
      id: adventure.id,
      author_id: 0, // Not exposed publicly
      slug: adventure.slug,
      download_count: adventure.download_count,
      published_version_id: adventure.published_version_id,
      created_at: '',
      version_id: adventure.version_id,
      version_number: adventure.version_number,
      title: adventure.title,
      description: adventure.description,
      short_description: adventure.short_description,
      cover_image_url: adventure.cover_image_url,
      system: adventure.system,
      difficulty: adventure.difficulty,
      players_min: adventure.players_min,
      players_max: adventure.players_max,
      level_min: adventure.level_min,
      level_max: adventure.level_max,
      duration_hours: adventure.duration_hours,
      price_cents: adventure.price_cents,
      currency: adventure.currency,
      language: adventure.language,
      author_name: adventure.author_name,
      author_discord: adventure.author_discord,
      published_at: adventure.published_at,
      display_name: adventure.display_name,
      avg_rating: adventure.avg_rating,
      rating_count: adventure.rating_count,
      highlights,
      tags,
      author: adventure.author_name || adventure.display_name,
    },
    files,
  }
})
