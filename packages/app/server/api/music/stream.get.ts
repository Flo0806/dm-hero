import { createReadStream, statSync } from 'fs'
import { extname } from 'path'
import { getMusicFolder, resolveTrackPath } from '~~/server/utils/music'
import { MUSIC_MIME_TYPES } from '~~/types/music'

/** Stream a library file with HTTP range support so <audio> can seek */
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const relPath = typeof query.path === 'string' ? query.path : ''
  const folder = getMusicFolder()
  if (!folder || !relPath) {
    throw createError({ statusCode: 400, message: 'path is required' })
  }

  const abs = resolveTrackPath(folder, relPath)
  if (!abs) {
    throw createError({ statusCode: 403, message: 'Invalid path' })
  }

  let size: number
  try {
    size = statSync(abs).size
  }
  catch {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const mime = MUSIC_MIME_TYPES[extname(abs).slice(1).toLowerCase()] || 'application/octet-stream'
  setHeader(event, 'Content-Type', mime)
  setHeader(event, 'Accept-Ranges', 'bytes')
  setHeader(event, 'Cache-Control', 'private, max-age=3600')

  const range = getHeader(event, 'range')
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null
  if (match) {
    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
    if (start >= size || start > end) {
      setResponseStatus(event, 416)
      setHeader(event, 'Content-Range', `bytes */${size}`)
      return ''
    }
    setResponseStatus(event, 206)
    setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
    setHeader(event, 'Content-Length', end - start + 1)
    return sendStream(event, createReadStream(abs, { start, end }))
  }

  setHeader(event, 'Content-Length', size)
  return sendStream(event, createReadStream(abs))
})
