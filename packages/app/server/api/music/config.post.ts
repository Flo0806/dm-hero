import { getMusicFolder, getMusicScenes, isDirectory, setMusicFolder, setMusicScenes } from '~~/server/utils/music'
import type { MusicConfig } from '~~/types/music'

/** Update the music library folder and/or the favourite scenes */
export default defineEventHandler(async (event): Promise<MusicConfig> => {
  const raw = await readBody<unknown>(event)
  if (raw !== null && raw !== undefined && typeof raw !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid request body' })
  }
  const body = (raw ?? {}) as { folder?: string | null, scenes?: string[] }

  if (body.folder !== undefined) {
    const folder = typeof body.folder === 'string' ? body.folder.trim() || null : null
    if (folder && !isDirectory(folder)) {
      throw createError({ statusCode: 400, message: 'Folder does not exist' })
    }
    const previous = getMusicFolder() || null
    setMusicFolder(folder)
    // A new library invalidates the old scenes
    if (folder !== previous) setMusicScenes([])
  }

  if (Array.isArray(body.scenes)) {
    setMusicScenes(body.scenes.filter(s => typeof s === 'string'))
  }

  const folder = getMusicFolder() || null
  return { folder, exists: folder ? isDirectory(folder) : false, scenes: getMusicScenes() }
})
