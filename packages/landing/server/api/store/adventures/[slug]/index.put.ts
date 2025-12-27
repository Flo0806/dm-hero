import { query, queryOne } from '../../../../utils/db'
import { requireAuthWithTos } from '../../../../utils/requireAuth'
import { ADVENTURE_STATUS, determineVersionAction } from '../../../../utils/adventureStatus'
import { createHash } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

interface AdventureRow {
  id: number
  slug: string
  author_id: number
}

interface LatestVersionRow {
  id: number
  version_number: number
  cover_image_url: string | null
  status: string
  validated_at: Date | null
}

export default defineEventHandler(async (event) => {
  // Require ToS acceptance for updating content
  const user = await requireAuthWithTos(event)
  const id = Number(getRouterParam(event, 'slug'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid adventure ID' })
  }

  // Fetch existing adventure (identity only)
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

  // Get the latest version to determine next version number and status
  const latestVersion = await queryOne<LatestVersionRow>(
    `SELECT id, version_number, cover_image_url, status, validated_at
     FROM adventure_versions
     WHERE adventure_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [adventure.id],
  )

  const currentVersionNumber = latestVersion?.version_number || 0
  const newVersionNumber = currentVersionNumber + 1

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

  // Parse JSON fields
  let highlights: string[] = []
  let tags: string[] = []
  try {
    highlights = JSON.parse(fields.highlights || '[]')
    tags = JSON.parse(fields.tags || '[]')
  } catch {
    // Ignore parse errors
  }

  // Determine version action using extracted logic (single source of truth, tested)
  const versionAction = determineVersionAction(
    latestVersion?.status || ADVENTURE_STATUS.DRAFT,
    latestVersion?.validated_at !== null,
  )

  // Determine which version number to use for file names
  const targetVersionNumber = versionAction.action === 'update'
    ? (latestVersion?.version_number || 1)  // Keep same version for updates
    : newVersionNumber                       // New version for creates

  // Handle cover image (save with version suffix for versioning)
  let coverImageUrl = latestVersion?.cover_image_url || null
  if (coverImageFile) {
    const ext = coverImageFile.filename.split('.').pop() || 'jpg'
    const coverFilename = `${adventure.slug}-v${targetVersionNumber}.${ext}`
    const coverPath = join(coversDir, coverFilename)
    await writeFile(coverPath, coverImageFile.data)
    coverImageUrl = `/api/uploads/covers/${coverFilename}`
  }

  let versionId: number
  let finalVersionNumber: number
  const isDraftUpdate = versionAction.action === 'update'

  if (versionAction.action === 'update' && latestVersion) {
    // UPDATE same version (subsequent draft edits)
    await query(
      `UPDATE adventure_versions SET
        title = ?, description = ?, short_description = ?, cover_image_url = ?,
        \`system\` = ?, difficulty = ?, players_min = ?, players_max = ?,
        level_min = ?, level_max = ?, duration_hours = ?,
        highlights = ?, tags = ?, price_cents = ?, currency = ?, language = ?,
        author_name = ?, author_discord = ?
      WHERE id = ?`,
      [
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
        latestVersion.id,
      ],
    )
    versionId = latestVersion.id
    finalVersionNumber = latestVersion.version_number
  } else {
    // CREATE new version (first draft edit after unpublish, or published/pending/rejected)
    const insertValidatedAt = versionAction.clearValidatedAt ? ', validated_at' : ''
    const insertValidatedAtValue = versionAction.clearValidatedAt ? ', NULL' : ''
    const versionResult = await query<{ insertId: number }>(
      `INSERT INTO adventure_versions (
        adventure_id, version_number, title, description, short_description, cover_image_url,
        \`system\`, difficulty, players_min, players_max, level_min, level_max, duration_hours,
        highlights, tags, price_cents, currency, language, author_name, author_discord, status${insertValidatedAt}
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${insertValidatedAtValue})`,
      [
        adventure.id,
        newVersionNumber,
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
        versionAction.resultStatus,
      ],
    )
    versionId = (versionResult as unknown as { insertId: number }).insertId
    finalVersionNumber = newVersionNumber
  }

  // Handle adventure file
  // isDraftUpdate is already set above based on the update mode

  if (adventureFile) {
    // New file uploaded - save it
    const adventureFilename = `${adventure.slug}-v${finalVersionNumber}.dmhero`
    const adventurePath = join(filesDir, adventureFilename)
    await writeFile(adventurePath, adventureFile.data)
    const checksum = createHash('sha256').update(adventureFile.data).digest('hex')

    if (isDraftUpdate) {
      // Update existing file record for draft
      await query(
        `UPDATE adventure_files SET
          file_path = ?, original_filename = ?, file_size = ?, checksum = ?
        WHERE version_id = ?`,
        [
          `/api/uploads/adventures/${adventureFilename}`,
          adventureFile.filename,
          adventureFile.data.length,
          checksum,
          versionId,
        ],
      )
    } else {
      // Insert new file record for new version
      await query(
        `INSERT INTO adventure_files (version_id, file_path, original_filename, file_size, version_number, checksum)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          `/api/uploads/adventures/${adventureFilename}`,
          adventureFile.filename,
          adventureFile.data.length,
          finalVersionNumber,
          checksum,
        ],
      )
    }
  } else if (!isDraftUpdate && latestVersion) {
    // No new file and creating new version - copy file reference from previous version
    const previousFile = await queryOne<{
      file_path: string
      original_filename: string | null
      file_size: number
      checksum: string | null
    }>(
      `SELECT file_path, original_filename, file_size, checksum
       FROM adventure_files
       WHERE version_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [latestVersion.id],
    )

    if (previousFile) {
      await query(
        `INSERT INTO adventure_files (version_id, file_path, original_filename, file_size, version_number, checksum)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          versionId,
          previousFile.file_path,
          previousFile.original_filename,
          previousFile.file_size,
          finalVersionNumber,
          previousFile.checksum,
        ],
      )
    }
  }
  // If draft update with no new file, keep existing file reference (no action needed)

  // versionAction.resultStatus already contains the correct final status
  const finalStatus = versionAction.resultStatus

  return {
    success: true,
    slug: adventure.slug,
    adventureId: adventure.id,
    versionNumber: finalVersionNumber,
    status: finalStatus,
    message: finalStatus === ADVENTURE_STATUS.DRAFT
      ? 'Adventure saved as draft.'
      : 'Adventure updated successfully. The new version will be reviewed before publishing.',
  }
})
