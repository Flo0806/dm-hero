import { query } from '../../utils/db'
import { requireAuthWithTos } from '../../utils/requireAuth'
import { ADVENTURE_STATUS } from '../../utils/adventureStatus'
import { createHash } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)
}

export default defineEventHandler(async (event) => {
  // Require ToS acceptance for uploading content
  const user = await requireAuthWithTos(event)

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
  if (!adventureFile) {
    throw createError({ statusCode: 400, message: 'Adventure file is required' })
  }

  // Generate unique slug
  let slug = generateSlug(fields.title)
  const existingSlug = await query<{ id: number }[]>(
    'SELECT id FROM adventures WHERE slug = ?',
    [slug],
  )
  if (existingSlug.length > 0) {
    slug = `${slug}-${Date.now()}`
  }

  // Prepare upload directories
  const uploadsBase = join(process.cwd(), 'uploads')
  const coversDir = join(uploadsBase, 'covers')
  const filesDir = join(uploadsBase, 'adventures')

  await mkdir(coversDir, { recursive: true })
  await mkdir(filesDir, { recursive: true })

  // Save cover image
  let coverImageUrl: string | null = null
  if (coverImageFile) {
    const ext = coverImageFile.filename.split('.').pop() || 'jpg'
    const coverFilename = `${slug}.${ext}`
    const coverPath = join(coversDir, coverFilename)
    await writeFile(coverPath, coverImageFile.data)
    coverImageUrl = `/api/uploads/covers/${coverFilename}`
  }

  // Save adventure file
  const adventureFilename = `${slug}-v1.dmhero`
  const adventurePath = join(filesDir, adventureFilename)
  await writeFile(adventurePath, adventureFile.data)
  const checksum = createHash('sha256').update(adventureFile.data).digest('hex')

  // Parse JSON fields
  let highlights: string[] = []
  let tags: string[] = []
  try {
    highlights = JSON.parse(fields.highlights || '[]')
    tags = JSON.parse(fields.tags || '[]')
  } catch {
    // Ignore parse errors
  }

  // Step 1: Insert adventure (identity only)
  const adventureResult = await query<{ insertId: number }>(
    `INSERT INTO adventures (author_id, slug)
     VALUES (?, ?)`,
    [user.id, slug],
  )
  const adventureId = (adventureResult as unknown as { insertId: number }).insertId

  // Step 2: Insert adventure version (all content)
  const versionResult = await query<{ insertId: number }>(
    `INSERT INTO adventure_versions (
      adventure_id, version_number, title, description, short_description, cover_image_url,
      \`system\`, difficulty, players_min, players_max, level_min, level_max, duration_hours,
      highlights, tags, price_cents, currency, language, author_name, author_discord, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adventureId,
      1, // version_number starts at 1
      fields.title,
      fields.description || null,
      fields.shortDescription || null,
      coverImageUrl,
      fields.system || 'dnd5e',
      Number(fields.difficulty) || 3,
      Number(fields.playersMin) || 3,
      Number(fields.playersMax) || 5,
      Number(fields.levelMin) || 1,
      Number(fields.levelMax) || 5,
      Number(fields.durationHours) || 4,
      JSON.stringify(highlights),
      JSON.stringify(tags),
      Number(fields.priceCents) || 0,
      'EUR',
      fields.language || 'de',
      fields.authorName || null,
      fields.authorDiscord || null,
      ADVENTURE_STATUS.PENDING_REVIEW,
    ],
  )
  const versionId = (versionResult as unknown as { insertId: number }).insertId

  // Step 3: Insert adventure file record (linked to version)
  await query(
    `INSERT INTO adventure_files (version_id, file_path, original_filename, file_size, version_number, checksum)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      `/api/uploads/adventures/${adventureFilename}`,
      adventureFile.filename,
      adventureFile.data.length,
      1,
      checksum,
    ],
  )

  return {
    success: true,
    slug,
    adventureId,
    message: 'Adventure uploaded successfully. It will be reviewed before publishing.',
  }
})
