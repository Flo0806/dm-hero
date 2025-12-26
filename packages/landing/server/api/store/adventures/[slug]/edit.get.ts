import { queryOne } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/requireAuth'

interface AdventureRow {
  id: number
  slug: string
  author_id: number
}

interface VersionRow {
  id: number
  version_number: number
  title: string
  short_description: string | null
  description: string | null
  cover_image_url: string | null
  highlights: string | null
  system: string
  language: string
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: number
  tags: string | null
  author_name: string | null
  author_discord: string | null
}

interface FileRow {
  file_path: string
  version_number: number
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = Number(getRouterParam(event, 'slug'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  // Fetch adventure identity
  const adventure = await queryOne<AdventureRow>(
    'SELECT id, slug, author_id FROM adventures WHERE id = ?',
    [id],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Check ownership
  if (adventure.author_id !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own adventures' })
  }

  // Get the latest version (for editing)
  const latestVersion = await queryOne<VersionRow>(
    `SELECT
      id, version_number, title, short_description, description, cover_image_url,
      highlights, \`system\`, language, difficulty,
      players_min, players_max, level_min, level_max,
      duration_hours, tags, author_name, author_discord
    FROM adventure_versions
    WHERE adventure_id = ?
    ORDER BY version_number DESC
    LIMIT 1`,
    [id],
  )

  if (!latestVersion) {
    throw createError({ statusCode: 404, message: 'No version found for this adventure' })
  }

  // Get the latest file for this version
  const latestFile = await queryOne<FileRow>(
    `SELECT file_path, version_number FROM adventure_files
     WHERE version_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [latestVersion.id],
  )

  // Parse JSON fields (MySQL may return as object or string)
  let highlights: string[] = []
  let tags: string[] = []
  try {
    highlights = typeof latestVersion.highlights === 'string'
      ? JSON.parse(latestVersion.highlights)
      : (latestVersion.highlights || [])
    tags = typeof latestVersion.tags === 'string'
      ? JSON.parse(latestVersion.tags)
      : (latestVersion.tags || [])
  } catch {
    // Ignore parse errors
  }

  // Extract filename from file path
  let currentFileName: string | null = null
  let currentVersion: number | null = null
  if (latestFile) {
    const pathParts = latestFile.file_path.split('/')
    currentFileName = pathParts[pathParts.length - 1]
    currentVersion = latestFile.version_number
  }

  return {
    id: adventure.id,
    title: latestVersion.title,
    shortDescription: latestVersion.short_description || '',
    description: latestVersion.description || '',
    coverImageUrl: latestVersion.cover_image_url,
    highlights,
    system: latestVersion.system,
    language: latestVersion.language,
    difficulty: latestVersion.difficulty,
    playersMin: latestVersion.players_min,
    playersMax: latestVersion.players_max,
    levelMin: latestVersion.level_min,
    levelMax: latestVersion.level_max,
    durationHours: Number(latestVersion.duration_hours),
    tags,
    authorName: latestVersion.author_name,
    authorDiscord: latestVersion.author_discord,
    authorId: adventure.author_id,
    currentFileName,
    currentVersion,
    versionNumber: latestVersion.version_number,
  }
})
