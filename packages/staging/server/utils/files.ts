import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Encrypted files (images ...) on disk: <filesDir>/<gameId>/<fileId>.
// The relay can't read them - keys are inside the DM-signed share envelopes.

export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const MAX_GAME_BYTES = 50 * 1024 * 1024

const isSafeId = (id: string) => /^[\w-]{1,64}$/.test(id)

export function filePath(gameId: string, fileId: string) {
  if (!isSafeId(gameId) || !isSafeId(fileId)) throw createError({ statusCode: 400, message: 'Invalid file id' })
  return join(resolve(useRuntimeConfig().filesDir), gameId, fileId)
}

export function ensureGameDir(gameId: string) {
  mkdirSync(join(resolve(useRuntimeConfig().filesDir), gameId), { recursive: true })
}

/** Game ended: all its files go */
export function removeGameFiles(gameId: string) {
  if (!isSafeId(gameId)) return
  rmSync(join(resolve(useRuntimeConfig().filesDir), gameId), { recursive: true, force: true })
}
