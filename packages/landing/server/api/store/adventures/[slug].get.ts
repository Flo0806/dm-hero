import { query, queryOne } from '../../../utils/db'
import type { AdventureWithAuthor, AdventureFile, AdventureDetailResponse } from '~~/types/store'

export default defineEventHandler(async (event): Promise<AdventureDetailResponse> => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  // Fetch adventure with author info and ratings
  // Show adventure if it has a published_file_version (even if current status is pending_review for a new update)
  const adventure = await queryOne<AdventureWithAuthor>(
    `SELECT
      a.*,
      u.display_name,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(DISTINCT r.id) as rating_count
    FROM adventures a
    JOIN users u ON a.author_id = u.id
    LEFT JOIN adventure_ratings r ON a.id = r.adventure_id
    WHERE a.slug = ? AND a.published_file_version IS NOT NULL
    GROUP BY a.id`,
    [slug],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Fetch only published adventure files (version <= published_file_version)
  const files = await query<Pick<AdventureFile, 'id' | 'file_path' | 'file_size' | 'version_number'>[]>(
    `SELECT id, file_path, file_size, version_number
     FROM adventure_files
     WHERE adventure_id = ? AND version_number <= ?
     ORDER BY version_number DESC`,
    [adventure.id, adventure.published_file_version],
  )

  // Parse JSON fields
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
      ...adventure,
      highlights,
      tags,
      author: adventure.author_name || adventure.display_name,
    },
    files,
  }
})
