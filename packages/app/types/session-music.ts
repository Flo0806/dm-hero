/** A playlist link attached to a session – opened in the system browser, never played in-app */
export interface SessionMusicLink {
  label: string
  url: string
}

/** Icon + brand color for known music services, generic note otherwise */
export function musicLinkIcon(url: string): { icon: string, color?: string } {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  }
  catch {
    return { icon: 'mdi-music' }
  }
  if (host === 'youtu.be' || host.endsWith('youtube.com')) return { icon: 'mdi-youtube', color: '#FF0000' }
  if (host.endsWith('spotify.com')) return { icon: 'mdi-spotify', color: '#1DB954' }
  if (host.endsWith('soundcloud.com')) return { icon: 'mdi-soundcloud', color: '#FF5500' }
  if (host.endsWith('tabletopaudio.com')) return { icon: 'mdi-dice-d20', color: '#D4A574' }
  return { icon: 'mdi-music' }
}

export function isValidMusicUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  }
  catch {
    return false
  }
}
