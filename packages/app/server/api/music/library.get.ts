import { basename } from 'path'
import { getMusicFolder, isDirectory, scanMusicFolder } from '~~/server/utils/music'
import type { MusicLibrary } from '~~/types/music'

export default defineEventHandler((): MusicLibrary => {
  const folder = getMusicFolder()
  if (!folder || !isDirectory(folder)) {
    throw createError({ statusCode: 404, message: 'Music folder not configured' })
  }

  const root = scanMusicFolder(folder, '')
  return { rootName: basename(folder), root, scannedAt: new Date().toISOString() }
})
