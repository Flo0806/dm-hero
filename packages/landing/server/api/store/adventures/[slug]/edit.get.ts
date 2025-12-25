import { queryOne } from '../../../../utils/db'
import { requireAuth } from '../../../../utils/requireAuth'

interface Adventure {
  id: number
  title: string
  short_description: string
  description: string
  cover_image_url: string | null
  highlights: string
  system: string
  language: string
  difficulty: number
  players_min: number
  players_max: number
  level_min: number
  level_max: number
  duration_hours: number
  tags: string
  author_name: string | null
  author_discord: string | null
  author_id: number
}

interface AdventureFile {
  file_path: string
  version_number: number
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = Number(getRouterParam(event, 'slug'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  // Fetch adventure with author check
  const adventure = await queryOne<Adventure>(
    `SELECT
      id, title, short_description, description, cover_image_url,
      highlights, \`system\`, language, difficulty,
      players_min, players_max, level_min, level_max,
      duration_hours, tags, author_name, author_discord, author_id
    FROM adventures
    WHERE id = ?`,
    [id],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Check ownership
  if (adventure.author_id !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own adventures' })
  }

  // Get the latest adventure file
  const latestFile = await queryOne<AdventureFile>(
    `SELECT file_path, version_number FROM adventure_files
     WHERE adventure_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [id],
  )

  // Parse JSON fields
  let highlights: string[] = []
  let tags: string[] = []
  try {
    highlights = JSON.parse(adventure.highlights || '[]')
    tags = JSON.parse(adventure.tags || '[]')
  } catch {
    // Ignore parse errors
  }

  // Extract filename from file path (e.g., "/api/uploads/adventures/slug-v1.dmhero" -> "slug-v1.dmhero")
  let currentFileName: string | null = null
  let currentVersion: number | null = null
  if (latestFile) {
    const pathParts = latestFile.file_path.split('/')
    currentFileName = pathParts[pathParts.length - 1]
    currentVersion = latestFile.version_number
  }

  return {
    id: adventure.id,
    title: adventure.title,
    shortDescription: adventure.short_description,
    description: adventure.description,
    coverImageUrl: adventure.cover_image_url,
    highlights,
    system: adventure.system,
    language: adventure.language,
    difficulty: adventure.difficulty,
    playersMin: adventure.players_min,
    playersMax: adventure.players_max,
    levelMin: adventure.level_min,
    levelMax: adventure.level_max,
    durationHours: adventure.duration_hours,
    tags,
    authorName: adventure.author_name,
    authorDiscord: adventure.author_discord,
    authorId: adventure.author_id,
    currentFileName,
    currentVersion,
  }
})
