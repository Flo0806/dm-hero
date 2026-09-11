/** A playable file inside the music library (paths are relative to the library root) */
export interface MusicTrack {
  id: string // relative path, unique
  name: string // file name without extension
  fileName: string
  folderPath: string // relative folder path ('' = root)
}

export interface MusicFolder {
  id: string // relative path ('' = root)
  name: string
  path: string
  tracks: MusicTrack[]
  children: MusicFolder[]
  trackCount: number // including descendants
}

export interface MusicLibrary {
  rootName: string
  root: MusicFolder
  scannedAt: string
}

export interface MusicConfig {
  folder: string | null
  exists: boolean
  scenes: string[] // favourite folder paths
}

// 'folder' = stay inside the current folder and repeat it (default – no spoilers from the next folder)
// 'one'    = repeat the current track
// 'all'    = play through the whole library
export type MusicLoopMode = 'folder' | 'one' | 'all'

export const MUSIC_EXTENSIONS = new Set([
  'mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'oga', 'opus', 'webm', 'aif', 'aiff',
])

export const MUSIC_MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
}
