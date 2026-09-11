import { readdirSync, statSync, existsSync, realpathSync, type Dirent } from 'fs'
import { join, resolve, sep, basename, extname } from 'path'
import { getDb } from './db'
import { encrypt, decrypt } from './encryption'
import { MUSIC_EXTENSIONS } from '~~/types/music'
import type { MusicFolder, MusicTrack } from '~~/types/music'

const SETTING_FOLDER = 'music_folder'
const SETTING_SCENES = 'music_scenes'

function readSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null
  try {
    return decrypt(row.value)
  }
  catch {
    return null
  }
}

function writeSetting(key: string, value: string) {
  getDb().prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, encrypt(value))
}

export function getMusicFolder(): string | null {
  return readSetting(SETTING_FOLDER)
}

export function setMusicFolder(folder: string | null) {
  writeSetting(SETTING_FOLDER, folder ?? '')
}

export function getMusicScenes(): string[] {
  try {
    const parsed = JSON.parse(readSetting(SETTING_SCENES) || '[]')
    return Array.isArray(parsed) ? parsed.filter(p => typeof p === 'string') : []
  }
  catch {
    return []
  }
}

export function setMusicScenes(scenes: string[]) {
  writeSetting(SETTING_SCENES, JSON.stringify(scenes))
}

export function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

function isAudioFile(name: string): boolean {
  return MUSIC_EXTENSIONS.has(extname(name).slice(1).toLowerCase())
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Recursively scan a directory into a folder tree. Paths are relative to the library root. */
export function scanMusicFolder(absDir: string, relPath: string): MusicFolder {
  const tracks: MusicTrack[] = []
  const children: MusicFolder[] = []

  let entries: Dirent[] = []
  try {
    entries = readdirSync(absDir, { withFileTypes: true })
  }
  catch {
    // unreadable folder – show it empty instead of failing the whole scan
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      children.push(scanMusicFolder(join(absDir, entry.name), childRel))
    }
    else if (entry.isFile() && isAudioFile(entry.name)) {
      tracks.push({
        id: childRel,
        name: basename(entry.name, extname(entry.name)),
        fileName: entry.name,
        folderPath: relPath,
      })
    }
  }

  tracks.sort((a, b) => collator.compare(a.name, b.name))
  children.sort((a, b) => collator.compare(a.name, b.name))

  const trackCount = tracks.length + children.reduce((sum, c) => sum + c.trackCount, 0)
  return { id: relPath, name: basename(absDir), path: relPath, tracks, children, trackCount }
}

/**
 * Resolve a relative track path against the library root.
 * Returns null when the path escapes the root (../) or is not an audio file.
 */
export function resolveTrackPath(root: string, relPath: string): string | null {
  const rootAbs = resolve(root)
  const abs = resolve(rootAbs, relPath)
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) return null
  if (!isAudioFile(abs)) return null
  // Canonicalise both ends so a symlink inside the library can't point outside it
  try {
    const rootReal = realpathSync(rootAbs)
    const real = realpathSync(abs)
    if (real !== rootReal && !real.startsWith(rootReal + sep)) return null
    return real
  }
  catch {
    return null // file vanished (deleted/moved) → caller answers 404
  }
}
