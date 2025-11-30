import { getDb } from '../../utils/db'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const db = getDb()

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({
      statusCode: 400,
      message: 'No form data received',
    })
  }

  const sessionIdField = formData.find((f) => f.name === 'sessionId')
  const audioFile = formData.find((f) => f.name === 'audio')
  const titleField = formData.find((f) => f.name === 'title')

  if (!sessionIdField || !audioFile) {
    throw createError({
      statusCode: 400,
      message: 'Session ID and audio file are required',
    })
  }

  const sessionId = parseInt(sessionIdField.data.toString(), 10)
  const title = titleField?.data.toString() || null

  // Check if session exists
  const session = db
    .prepare('SELECT id FROM sessions WHERE id = ? AND deleted_at IS NULL')
    .get(sessionId)

  if (!session) {
    throw createError({
      statusCode: 404,
      message: 'Session not found',
    })
  }

  // Validate file type
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/ogg',
    'audio/m4a',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/flac',
    'audio/webm',
  ]

  const mimeType = audioFile.type || 'audio/mpeg'
  if (!allowedMimeTypes.includes(mimeType)) {
    throw createError({
      statusCode: 400,
      message: `Invalid file type: ${mimeType}. Allowed: MP3, WAV, OGG, M4A, AAC, FLAC, WebM`,
    })
  }

  // Get file extension from mime type
  const extMap: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/x-wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/m4a': '.m4a',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    'audio/webm': '.webm',
  }

  const ext = extMap[mimeType] || '.mp3'
  const filename = `${randomUUID()}${ext}`

  // Ensure audio directory exists
  const audioDir = join(process.cwd(), 'public', 'uploads', 'audio')
  if (!existsSync(audioDir)) {
    await mkdir(audioDir, { recursive: true })
  }

  // Write file
  const filePath = join(audioDir, filename)
  await writeFile(filePath, audioFile.data)

  // Get current max display_order for this session
  const maxDisplayOrder = db
    .prepare(
      `
    SELECT COALESCE(MAX(display_order), -1) as max_order
    FROM session_audio
    WHERE session_id = ?
  `,
    )
    .get(sessionId) as { max_order: number }

  const displayOrder = maxDisplayOrder.max_order + 1
  const fileSizeBytes = audioFile.data.length

  // Insert into database
  const result = db
    .prepare(
      `
    INSERT INTO session_audio (session_id, audio_url, title, mime_type, file_size_bytes, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      sessionId,
      `audio/${filename}`,
      title,
      mimeType,
      fileSizeBytes,
      displayOrder,
      new Date().toISOString(),
    )

  return {
    success: true,
    id: Number(result.lastInsertRowid),
    audioUrl: `audio/${filename}`,
    title,
    mimeType,
    fileSizeBytes,
  }
})
