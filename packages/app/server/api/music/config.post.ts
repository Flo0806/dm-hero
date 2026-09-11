import { getMusicFolder, getMusicScenes, isDirectory, setMusicFolder, setMusicScenes } from '~~/server/utils/music'
import type { MusicConfig } from '~~/types/music'

/** Update the music library folder and/or the favourite scenes */
export default defineEventHandler(async (event): Promise<MusicConfig> => {
  const body = await readBody<{ folder?: string | null, scenes?: string[] }>(event)

  if (body.folder !== undefined) {
    const folder = body.folder?.trim() || null
    if (folder && !isDirectory(folder)) {
      throw createError({ statusCode: 400, message: 'Folder does not exist' })
    }
    setMusicFolder(folder)
    // A new library invalidates the old scenes
    if (folder !== getMusicFolder()) setMusicScenes([])
  }

  if (Array.isArray(body.scenes)) {
    setMusicScenes(body.scenes.filter(s => typeof s === 'string'))
  }

  const folder = getMusicFolder() || null
  return { folder, exists: folder ? isDirectory(folder) : false, scenes: getMusicScenes() }
})
