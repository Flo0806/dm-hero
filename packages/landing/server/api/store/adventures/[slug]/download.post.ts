import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { readFile, rm } from 'fs/promises'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'
import { PassThrough } from 'stream'
import archiver from 'archiver'
import { query, queryOne } from '../../../../utils/db'
import { getAuthUser } from '../../../../utils/requireAuth'

// Dynamic import for unzipper (ESM)
let unzipper: typeof import('unzipper')

async function getUnzipper() {
  if (!unzipper) {
    unzipper = await import('unzipper')
  }
  return unzipper
}

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

  // Create temp directory for extraction
  const tempDir = join(tmpdir(), `dmhero-download-${randomUUID()}`)
  mkdirSync(tempDir, { recursive: true })

  try {
    // Extract ZIP using unzipper (same as dm-hero app import)
    const uz = await getUnzipper()
    const directory = await uz.Open.file(absolutePath)

    // Extract all files to temp dir
    for (const zipFile of directory.files) {
      if (zipFile.type === 'File') {
        const targetPath = join(tempDir, zipFile.path)
        mkdirSync(dirname(targetPath), { recursive: true })
        const writeStream = createWriteStream(targetPath)
        await pipeline(zipFile.stream(), writeStream)
      }
    }

    // Read and modify manifest
    const manifestPath = join(tempDir, 'manifest.json')
    if (!existsSync(manifestPath)) {
      throw createError({ statusCode: 500, message: 'Invalid .dmhero file: no manifest' })
    }

    const manifestContent = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestContent)

    // Inject sourceAdventureSlug and version info
    manifest.sourceAdventureSlug = adventure.slug
    manifest.sourceVersion = version.version_number

    // Create new ZIP with archiver (same as dm-hero app export)
    const archive = archiver('zip', { zlib: { level: 9 } })
    const passthrough = new PassThrough()
    archive.pipe(passthrough)

    // Add modified manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

    // Add all other files from extracted temp dir
    for (const zipFile of directory.files) {
      if (zipFile.type === 'File' && zipFile.path !== 'manifest.json') {
        const filePath = join(tempDir, zipFile.path)
        if (existsSync(filePath)) {
          archive.file(filePath, { name: zipFile.path })
        }
      }
    }

    // Finalize archive
    archive.finalize()

    // Set response headers for file download
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', `attachment; filename="${adventure.slug}-v${version.version_number}.dmhero"`)

    // Clean up temp dir after stream completes
    passthrough.on('end', async () => {
      try {
        await rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    return passthrough
  } catch (err) {
    // Clean up on error
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    console.error('[Download] Error processing file:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to process download file',
    })
  }
})
