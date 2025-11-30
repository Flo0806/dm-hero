import { getDb } from '../../../utils/db'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const audioId = getRouterParam(event, 'id')

  if (!audioId) {
    throw createError({
      statusCode: 400,
      message: 'Audio ID is required',
    })
  }

  // Get audio file info before deleting
  const audio = db
    .prepare('SELECT audio_url FROM session_audio WHERE id = ?')
    .get(audioId) as { audio_url: string } | undefined

  if (!audio) {
    throw createError({
      statusCode: 404,
      message: 'Audio file not found',
    })
  }

  // Delete from database (cascades to markers)
  db.prepare('DELETE FROM session_audio WHERE id = ?').run(audioId)

  // Delete physical file
  const filePath = join(process.cwd(), 'public', 'uploads', audio.audio_url)
  if (existsSync(filePath)) {
    try {
      await unlink(filePath)
    } catch (error) {
      console.error('Failed to delete audio file:', error)
    }
  }

  return { success: true }
})
