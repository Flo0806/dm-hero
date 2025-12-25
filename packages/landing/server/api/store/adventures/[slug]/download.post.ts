import { query, queryOne } from '../../../../utils/db'
import { getAuthUser } from '../../../../utils/requireAuth'

interface Adventure {
  id: number
  download_count: number
}

interface AdventureFile {
  id: number
  file_path: string
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  // Get adventure
  const adventure = await queryOne<Adventure>(
    'SELECT id, download_count FROM adventures WHERE slug = ? AND status = \'published\'',
    [slug],
  )

  if (!adventure) {
    throw createError({ statusCode: 404, message: 'Adventure not found' })
  }

  // Get latest file
  const file = await queryOne<AdventureFile>(
    `SELECT id, file_path FROM adventure_files
     WHERE adventure_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [adventure.id],
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
      // Get IP address
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
      // Ignore tracking errors - download should still work
    }
  }

  // Return updated count and file path
  return {
    downloadCount: adventure.download_count + 1,
    filePath: file.file_path,
  }
})
