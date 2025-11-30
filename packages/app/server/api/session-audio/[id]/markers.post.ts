import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const audioId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!audioId) {
    throw createError({
      statusCode: 400,
      message: 'Audio ID is required',
    })
  }

  const { timestampSeconds, label, description, color } = body

  if (timestampSeconds === undefined || !label) {
    throw createError({
      statusCode: 400,
      message: 'Timestamp and label are required',
    })
  }

  // Check if audio exists
  const audio = db.prepare('SELECT id FROM session_audio WHERE id = ?').get(audioId)

  if (!audio) {
    throw createError({
      statusCode: 404,
      message: 'Audio file not found',
    })
  }

  // Insert marker
  const result = db
    .prepare(
      `
    INSERT INTO audio_markers (audio_id, timestamp_seconds, label, description, color, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      audioId,
      timestampSeconds,
      label,
      description || null,
      color || '#D4A574',
      new Date().toISOString(),
    )

  return {
    success: true,
    id: Number(result.lastInsertRowid),
    timestampSeconds,
    label,
    description: description || null,
    color: color || '#D4A574',
  }
})
