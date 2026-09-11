import type { SessionMusicLink } from '~~/types/session-music'
import { isValidMusicUrl } from '~~/types/session-music'

/** Parse the sessions.music_links JSON column, tolerating bad data */
export function parseMusicLinks(raw: string | null | undefined): SessionMusicLink[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isMusicLink) : []
  }
  catch {
    return []
  }
}

/** Validate client input before writing it to the column */
export function sanitizeMusicLinks(input: unknown): SessionMusicLink[] {
  if (!Array.isArray(input)) return []
  return input
    .filter(isMusicLink)
    .map(l => ({ label: l.label.trim().slice(0, 200), url: l.url.trim() }))
    .filter(l => l.label && isValidMusicUrl(l.url))
}

function isMusicLink(value: unknown): value is SessionMusicLink {
  return !!value && typeof value === 'object'
    && typeof (value as SessionMusicLink).label === 'string'
    && typeof (value as SessionMusicLink).url === 'string'
}
