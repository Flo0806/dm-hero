import { getDb } from '../../../utils/db'

interface SessionAudioRow {
  id: number
  session_id: number
  audio_url: string
  title: string | null
  description: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  mime_type: string | null
  display_order: number
  created_at: string
}

export default defineEventHandler((event) => {
  const db = getDb()
  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      message: 'Session ID is required',
    })
  }

  // Get all audio files for this session with their markers
  const audioFiles = db
    .prepare(
      `
    SELECT
      id, session_id, audio_url, title, description,
      duration_seconds, file_size_bytes, mime_type,
      display_order, created_at
    FROM session_audio
    WHERE session_id = ?
    ORDER BY display_order ASC, created_at ASC
  `,
    )
    .all(sessionId) as SessionAudioRow[]

  // Get markers for each audio file
  const result = audioFiles.map((audio) => {
    const markers = db
      .prepare(
        `
      SELECT id, timestamp_seconds, label, description, color, created_at
      FROM audio_markers
      WHERE audio_id = ?
      ORDER BY timestamp_seconds ASC
    `,
      )
      .all(audio.id) as Array<{
      id: number
      timestamp_seconds: number
      label: string
      description: string | null
      color: string
      created_at: string
    }>

    return {
      id: audio.id,
      sessionId: audio.session_id,
      audioUrl: audio.audio_url,
      title: audio.title,
      description: audio.description,
      durationSeconds: audio.duration_seconds,
      fileSizeBytes: audio.file_size_bytes,
      mimeType: audio.mime_type,
      displayOrder: audio.display_order,
      createdAt: audio.created_at,
      markers: markers.map((m) => ({
        id: m.id,
        timestampSeconds: m.timestamp_seconds,
        label: m.label,
        description: m.description,
        color: m.color,
        createdAt: m.created_at,
      })),
    }
  })

  return result
})
