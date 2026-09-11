import { getMusicFolder, getMusicScenes, isDirectory } from '~~/server/utils/music'
import type { MusicConfig } from '~~/types/music'

export default defineEventHandler((): MusicConfig => {
  const folder = getMusicFolder() || null
  return {
    folder,
    exists: folder ? isDirectory(folder) : false,
    scenes: getMusicScenes(),
  }
})
