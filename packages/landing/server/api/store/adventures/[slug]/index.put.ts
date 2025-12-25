import { query, queryOne } from '../../../../utils/db'
import { requireAuthWithTos } from '../../../../utils/requireAuth'
import { ADVENTURE_STATUS } from '../../../../utils/adventureStatus'
import { createHash } from 'crypto'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'

interface Adventure {
  id: number
  slug: string
  author_id: number
  cover_image_url: string | null
  version_number: number
}

export default defineEventHandler(async (event) => {
  // Require ToS acceptance for updating content
  const user = await requireAuthWithTos(event)
  const id = Number(getRouterParam(event, 'slug'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  // Fetch existing adventure
  const adventure = await queryOne<Adventure>(
    'SELECT id, slug, author_id, cover_image_url, version_number FROM adventures WHERE id = ?',
    [id],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Check ownership
  if (adventure.author_id !== user.id) {
    throw createError({ statusCode: 403, message: 'You can only edit your own adventures' })
  }

  // Parse multipart form data
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, message: 'No form data provided' })
  }

  // Extract fields
  const fields: Record<string, string> = {}
  let coverImageFile: { data: Buffer; filename: string; type: string } | null = null
  let adventureFile: { data: Buffer; filename: string } | null = null

  for (const field of formData) {
    if (field.name === 'coverImage' && field.data.length > 0) {
      coverImageFile = {
        data: field.data,
        filename: field.filename || 'cover.jpg',
        type: field.type || 'image/jpeg',
      }
    } else if (field.name === 'adventureFile' && field.data.length > 0) {
      adventureFile = {
        data: field.data,
        filename: field.filename || 'adventure.dmhero',
      }
    } else if (field.name && field.data) {
      fields[field.name] = field.data.toString()
    }
  }

  // Validate required fields
  if (!fields.title) {
    throw createError({ statusCode: 400, message: 'Title is required' })
  }

  // Prepare upload directories
  const uploadsBase = join(process.cwd(), 'uploads')
  const coversDir = join(uploadsBase, 'covers')
  const filesDir = join(uploadsBase, 'adventures')

  await mkdir(coversDir, { recursive: true })
  await mkdir(filesDir, { recursive: true })

  // Handle cover image update
  let coverImageUrl = adventure.cover_image_url
  if (coverImageFile) {
    // Delete old cover if exists
    if (adventure.cover_image_url) {
      const oldCoverPath = join(process.cwd(), adventure.cover_image_url.replace('/api/', ''))
      try {
        await unlink(oldCoverPath)
      } catch {
        // Ignore if file doesn't exist
      }
    }

    // Save new cover
    const ext = coverImageFile.filename.split('.').pop() || 'jpg'
    const coverFilename = `${adventure.slug}.${ext}`
    const coverPath = join(coversDir, coverFilename)
    await writeFile(coverPath, coverImageFile.data)
    coverImageUrl = `/api/uploads/covers/${coverFilename}`
  }

  // Handle adventure file update
  let newVersion = adventure.version_number
  if (adventureFile) {
    newVersion = adventure.version_number + 1
    const adventureFilename = `${adventure.slug}-v${newVersion}.dmhero`
    const adventurePath = join(filesDir, adventureFilename)
    await writeFile(adventurePath, adventureFile.data)
    const checksum = createHash('sha256').update(adventureFile.data).digest('hex')

    // Insert new file version (store original filename for content validation)
    await query(
      `INSERT INTO adventure_files (adventure_id, file_path, original_filename, file_size, version_number, checksum)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adventure.id,
        `/api/uploads/adventures/${adventureFilename}`,
        adventureFile.filename,
        adventureFile.data.length,
        newVersion,
        checksum,
      ],
    )
  }

  // Parse JSON fields
  let highlights: string[] = []
  let tags: string[] = []
  try {
    highlights = JSON.parse(fields.highlights || '[]')
    tags = JSON.parse(fields.tags || '[]')
  } catch {
    // Ignore parse errors
  }

  // Always reset to pending_review on any edit (text changes also need re-validation)
  const newStatus = ADVENTURE_STATUS.PENDING_REVIEW

  await query(
    `UPDATE adventures SET
      title = ?,
      description = ?,
      short_description = ?,
      cover_image_url = ?,
      version_number = ?,
      \`system\` = ?,
      difficulty = ?,
      players_min = ?,
      players_max = ?,
      level_min = ?,
      level_max = ?,
      duration_hours = ?,
      highlights = ?,
      tags = ?,
      author_name = ?,
      author_discord = ?,
      price_cents = ?,
      language = ?,
      status = ?,
      validation_result = NULL,
      validated_at = NULL,
      updated_at = NOW()
    WHERE id = ?`,
    [
      fields.title,
      fields.description || null,
      fields.shortDescription || null,
      coverImageUrl,
      newVersion,
      fields.system || 'dnd5e',
      Number(fields.difficulty) || 3,
      Number(fields.playersMin) || 3,
      Number(fields.playersMax) || 5,
      Number(fields.levelMin) || 1,
      Number(fields.levelMax) || 5,
      Number(fields.durationHours) || 4,
      JSON.stringify(highlights),
      JSON.stringify(tags),
      fields.authorName || null,
      fields.authorDiscord || null,
      Number(fields.priceCents) || 0,
      fields.language || 'de',
      newStatus,
      adventure.id,
    ],
  )

  return {
    success: true,
    slug: adventure.slug,
    adventureId: adventure.id,
    message: 'Adventure updated successfully.',
  }
})
