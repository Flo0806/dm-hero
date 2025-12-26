import { readFile } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'
import { query, queryOne } from '../../../../utils/db'
import { getAuthUser } from '../../../../utils/requireAuth'

interface AdventureRow {
  id: number
  slug: string
  download_count: number
  published_version_id: number
}

interface VersionRow {
  id: number
  version_number: number
}

interface FileRow {
  id: number
  file_path: string
  version_number: number
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  // Get adventure with published version
  const adventure = await queryOne<AdventureRow>(
    `SELECT id, slug, download_count, published_version_id
     FROM adventures
     WHERE slug = ? AND published_version_id IS NOT NULL`,
    [slug],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Get published version info
  const version = await queryOne<VersionRow>(
    'SELECT id, version_number FROM adventure_versions WHERE id = ?',
    [adventure.published_version_id],
  )

  if (!version) {
    throw createError({ statusCode: 404, message: 'No published version found' })
  }

  // Get the file for this version
  const file = await queryOne<FileRow>(
    `SELECT id, file_path, version_number FROM adventure_files
     WHERE version_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [version.id],
  )

  if (!file) {
    throw createError({ statusCode: 404, message: 'No file available' })
  }

  // Increment download count
  await query(
    'UPDATE adventures SET download_count = download_count + 1 WHERE id = ?',
    [adventure.id],
  )

  // Track user download if logged in (optional)
  const user = await getAuthUser(event)
  if (user) {
    try {
      const ip = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
        || getHeader(event, 'x-real-ip')
        || event.node.req.socket.remoteAddress
        || null

      await query(
        `INSERT INTO user_downloads (user_id, adventure_id, ip_address)
         VALUES (?, ?, ?)`,
        [user.id, adventure.id, ip],
      )
    } catch {
      // Ignore tracking errors
    }
  }

  // Read the original .dmhero file
  const uploadsDir = process.env.UPLOADS_DIR || './uploads'
  const relativePath = file.file_path.replace('/api/uploads/', '')
  const absolutePath = join(uploadsDir, relativePath)

  try {
    const fileBuffer = await readFile(absolutePath)

    // Parse the ZIP and modify manifest
    const zip = await JSZip.loadAsync(fileBuffer)
    const manifestFile = zip.file('manifest.json')

    if (!manifestFile) {
      throw createError({ statusCode: 500, message: 'Invalid .dmhero file: no manifest' })
    }

    // Read and modify manifest
    const manifestContent = await manifestFile.async('string')
    const manifest = JSON.parse(manifestContent)

    // Inject sourceAdventureSlug and version info
    manifest.sourceAdventureSlug = adventure.slug
    manifest.sourceVersion = version.version_number

    // Update manifest in ZIP
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    // Generate modified ZIP
    const modifiedBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    // Set response headers for file download
    setHeader(event, 'Content-Type', 'application/octet-stream')
    setHeader(event, 'Content-Disposition', `attachment; filename="${adventure.slug}-v${version.version_number}.dmhero"`)
    setHeader(event, 'Content-Length', modifiedBuffer.length)

    // Return the modified file
    return modifiedBuffer
  } catch (err) {
    console.error('[Download] Error processing file:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to process download file',
    })
  }
})
