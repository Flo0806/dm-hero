import type { MusicConfig, MusicFolder, MusicLibrary, MusicLoopMode, MusicTrack } from '~~/types/music'

/**
 * Global music player – module-level singleton so playback survives navigation.
 * Two <audio> channels allow crossfading; files are streamed from /api/music/stream.
 * Ported from dnd-music (dual-channel engine, folder-scoped queue, scenes).
 */

// --- State ------------------------------------------------------------------

const config = ref<MusicConfig | null>(null)
const library = shallowRef<MusicLibrary | null>(null)
const loading = ref(false)
const scanning = ref(false)
const error = ref<string | null>(null)
const initialized = ref(false)

const expanded = reactive(new Set<string>())
const query = ref('')

const random = ref(false)
const loopMode = ref<MusicLoopMode>('folder')
const crossfadeEnabled = ref(true)
const crossfadeSec = ref(4)
const volume = ref(0.8)

const scopeFolder = shallowRef<MusicFolder | null>(null)
const currentTrack = shallowRef<MusicTrack | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const currentIndex = ref(-1)
const missingTracks = reactive(new Set<string>()) // ids that failed to load (deleted files)

// Current queue (reactive so the mini player can show what's next)
const playOrder = shallowRef<MusicTrack[]>([])

// Dual-channel audio engine
const players: HTMLAudioElement[] = []
const fadeTimers = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>()
let activeChannel = 0
let crossfading = false
let pendingSeek = 0
let lastTimeSave = 0
let consecutiveErrors = 0

const clamp = (v: number) => Math.max(0, Math.min(1, v))
// Translations outside of component setup (event handlers) – client only
const t = (key: string): string => useNuxtApp().$i18n.t(key)

// --- Persistence (localStorage: settings + per-library expanded/last track) --

const SETTINGS_KEY = 'dm-hero:music:settings'

interface SavedState {
  expanded?: string[]
  trackId?: string
  time?: number
}

function stateKey(): string | null {
  return config.value?.folder ? `dm-hero:music:state:${config.value.folder}` : null
}

function loadState(): SavedState | null {
  const key = stateKey()
  if (!key || typeof localStorage === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  }
  catch {
    return null
  }
}

function saveState(patch: SavedState) {
  const key = stateKey()
  if (!key || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ ...loadState(), ...patch }))
  }
  catch {
    // storage full or blocked – non-critical
  }
}

function saveSettings() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      volume: volume.value,
      random: random.value,
      loopMode: loopMode.value,
      crossfadeEnabled: crossfadeEnabled.value,
      crossfadeSec: crossfadeSec.value,
    }))
  }
  catch {
    // non-critical
  }
}

function loadSettings() {
  if (typeof localStorage === 'undefined') return
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (!s) return
    if (typeof s.volume === 'number') volume.value = clamp(s.volume)
    if (typeof s.random === 'boolean') random.value = s.random
    if (['folder', 'one', 'all'].includes(s.loopMode)) loopMode.value = s.loopMode
    if (typeof s.crossfadeEnabled === 'boolean') crossfadeEnabled.value = s.crossfadeEnabled
    if (typeof s.crossfadeSec === 'number') crossfadeSec.value = s.crossfadeSec
  }
  catch {
    // ignore
  }
}

// --- Tree helpers -----------------------------------------------------------

export function findMusicFolder(folder: MusicFolder | null, path: string): MusicFolder | null {
  if (!folder) return null
  if (folder.path === path) return folder
  for (const c of folder.children) {
    const hit = findMusicFolder(c, path)
    if (hit) return hit
  }
  return null
}

export function musicFolderMatches(folder: MusicFolder, q: string): boolean {
  if (!q) return true
  if (folder.name.toLowerCase().includes(q)) return true
  if (folder.tracks.some(t => t.name.toLowerCase().includes(q))) return true
  return folder.children.some(c => musicFolderMatches(c, q))
}

/** Tracks in visual top-to-bottom order (folder's own tracks, then children) */
function flatten(folder: MusicFolder, out: MusicTrack[] = []): MusicTrack[] {
  for (const t of folder.tracks) out.push(t)
  for (const c of folder.children) flatten(c, out)
  return out
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

function buildOrder() {
  const root = scopeFolder.value ?? library.value?.root ?? null
  if (!root) {
    playOrder.value = []
    currentIndex.value = -1
    return
  }
  const flat = flatten(root).filter(t => !missingTracks.has(t.id))
  playOrder.value = random.value ? shuffle(flat) : flat
  if (currentTrack.value) {
    currentIndex.value = playOrder.value.findIndex(t => t.id === currentTrack.value!.id)
  }
}

// --- Audio engine -----------------------------------------------------------

function activeEl(): HTMLAudioElement {
  return players[activeChannel]!
}
function inactiveEl(): HTMLAudioElement {
  return players[1 - activeChannel]!
}

function clearFade(el: HTMLAudioElement) {
  const t = fadeTimers.get(el)
  if (t) {
    clearInterval(t)
    fadeTimers.delete(el)
  }
}

/** Linearly ramp an element's volume to a target over `ms` */
function rampVolume(el: HTMLAudioElement, from: number, to: number, ms: number, done?: () => void) {
  clearFade(el)
  if (ms <= 0) {
    el.volume = clamp(to)
    done?.()
    return
  }
  const steps = Math.max(1, Math.round(ms / 40))
  let i = 0
  el.volume = clamp(from)
  const timer = setInterval(() => {
    i++
    el.volume = clamp(from + (to - from) * (i / steps))
    if (i >= steps) {
      clearFade(el)
      done?.()
    }
  }, 40)
  fadeTimers.set(el, timer)
}

function ensurePlayers() {
  if (players.length || typeof Audio === 'undefined') return
  for (let ch = 0; ch < 2; ch++) {
    const el = new Audio()
    el.volume = volume.value
    el.preload = 'auto'
    el.addEventListener('timeupdate', () => {
      if (el !== activeEl()) return
      currentTime.value = el.currentTime
      const now = Date.now()
      if (now - lastTimeSave > 4000) {
        lastTimeSave = now
        saveState({ time: el.currentTime })
      }
      maybeCrossfade()
    })
    el.addEventListener('loadedmetadata', () => {
      if (el !== activeEl()) return
      duration.value = Number.isFinite(el.duration) ? el.duration : 0
      if (pendingSeek > 0 && pendingSeek < duration.value) {
        el.currentTime = pendingSeek
        currentTime.value = pendingSeek
      }
      pendingSeek = 0
    })
    el.addEventListener('play', () => {
      if (el === activeEl()) isPlaying.value = true
    })
    el.addEventListener('pause', () => {
      if (el === activeEl()) {
        isPlaying.value = false
        saveState({ time: el.currentTime })
      }
    })
    el.addEventListener('ended', () => {
      if (el !== activeEl() || crossfading) return
      onTrackEnded()
    })
    el.addEventListener('error', () => {
      if (el !== activeEl() || !currentTrack.value) return
      onTrackError(currentTrack.value)
    })
    players.push(el)
  }
}

function streamUrl(track: MusicTrack): string {
  return `/api/music/stream?path=${encodeURIComponent(track.id)}`
}

/** A file failed to load (deleted/moved): mark it, tell the user, move on */
function onTrackError(track: MusicTrack) {
  missingTracks.add(track.id)
  consecutiveErrors++
  error.value = `${track.fileName}: ${t('music.errors.fileUnavailable')}`
  buildOrder()
  // Stop after a few failures in a row – the whole folder is probably gone
  if (consecutiveErrors >= 5 || !playOrder.value.length) {
    isPlaying.value = false
    error.value = t('music.errors.libraryUnavailable')
    return
  }
  next()
}

function loadInto(el: HTMLAudioElement, track: MusicTrack, autoplay: boolean, startVol: number) {
  currentTrack.value = track
  duration.value = 0
  currentTime.value = 0
  saveState(autoplay ? { trackId: track.id, time: 0 } : { trackId: track.id })
  updateMediaSession(track)
  el.src = streamUrl(track)
  el.volume = clamp(startVol)
  el.load()
  if (autoplay) {
    el.play().then(() => {
      consecutiveErrors = 0
    }).catch(() => {
      // autoplay blocked or load failed – the 'error' listener handles the latter
      isPlaying.value = false
    })
  }
}

function cancelCrossfade() {
  if (!crossfading) return
  const out = inactiveEl()
  clearFade(out)
  clearFade(activeEl())
  out.pause()
  activeEl().volume = volume.value
  crossfading = false
}

function loadActive(track: MusicTrack, autoplay: boolean) {
  ensurePlayers()
  if (!players.length) return
  cancelCrossfade()
  loadInto(activeEl(), track, autoplay, volume.value)
}

function peekNext(): { track: MusicTrack, index: number } | null {
  if (loopMode.value === 'one') return null
  const idx = currentIndex.value + 1
  if (idx < playOrder.value.length) return { track: playOrder.value[idx]!, index: idx }
  if (random.value) return null // reshuffle seam handled by next()
  return playOrder.value.length ? { track: playOrder.value[0]!, index: 0 } : null
}

function maybeCrossfade() {
  if (!crossfadeEnabled.value || crossfading) return
  if (loopMode.value === 'one') return
  const d = duration.value
  if (!d || d <= crossfadeSec.value + 0.5) return
  if (d - currentTime.value > crossfadeSec.value) return
  const n = peekNext()
  if (n) startCrossfade(n)
}

function startCrossfade(n: { track: MusicTrack, index: number }) {
  crossfading = true
  const ms = crossfadeSec.value * 1000
  const out = activeEl()
  activeChannel = 1 - activeChannel
  currentIndex.value = n.index
  const inEl = activeEl()
  loadInto(inEl, n.track, true, 0)
  rampVolume(inEl, 0, volume.value, ms)
  rampVolume(out, out.volume, 0, ms, () => {
    out.pause()
    crossfading = false
  })
}

function onTrackEnded() {
  if (loopMode.value === 'one') {
    const el = activeEl()
    el.currentTime = 0
    el.play().catch(() => {})
    return
  }
  next()
}

// --- MediaSession (OS media keys) -------------------------------------------

function updateMediaSession(track: MusicTrack) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.folderPath || library.value?.rootName || '',
      album: 'DM Hero',
    })
  }
  catch {
    // ignore
  }
}

function setupMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(action, handler)
    }
    catch {
      // unsupported action
    }
  }
  set('play', () => togglePlay())
  set('pause', () => togglePlay())
  set('previoustrack', () => prev())
  set('nexttrack', () => next())
  set('seekbackward', () => skip(-10))
  set('seekforward', () => skip(10))
  set('seekto', (e) => {
    if (typeof e.seekTime === 'number') seek(e.seekTime)
  })
}

// --- Library ----------------------------------------------------------------

async function loadConfig() {
  config.value = await $fetch<MusicConfig>('/api/music/config')
}

/** (Re)scan the configured folder. Restores open folders + last track. */
async function loadLibrary() {
  scanning.value = true
  error.value = null
  try {
    const lib = await $fetch<MusicLibrary>('/api/music/library')
    const previousScope = scopeFolder.value?.path ?? null
    library.value = lib
    missingTracks.clear()
    consecutiveErrors = 0
    scopeFolder.value = null
    query.value = ''

    const saved = loadState()
    expanded.clear()
    if (saved?.expanded) for (const p of saved.expanded) expanded.add(p)
    buildOrder()
    // Restore last track paused so "Play" resumes where the DM left off
    if (saved?.trackId && !currentTrack.value) {
      const track = flatten(lib.root).find(t => t.id === saved.trackId)
      if (track) {
        currentIndex.value = playOrder.value.findIndex(t => t.id === track.id)
        pendingSeek = saved.time ?? 0
        loadActive(track, false)
      }
    }
    else if (currentTrack.value) {
      // Keep playing; re-anchor the queue on the fresh tree
      scopeFolder.value = previousScope !== null ? findMusicFolder(lib.root, previousScope) : null
      buildOrder()
    }
  }
  catch (e) {
    library.value = null
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 404 ? t('music.errors.folderMissing') : t('music.errors.scanFailed')
  }
  finally {
    scanning.value = false
  }
}

async function init() {
  if (initialized.value) return
  initialized.value = true
  loadSettings()
  setupMediaSession()
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (players.length && currentTrack.value) saveState({ time: activeEl().currentTime })
    })
  }
  loading.value = true
  try {
    await loadConfig()
    if (config.value?.folder && config.value.exists) await loadLibrary()
    else if (config.value?.folder) error.value = t('music.errors.folderMissing')
  }
  catch {
    error.value = t('music.errors.scanFailed')
  }
  finally {
    loading.value = false
  }
}

async function setFolder(folder: string | null) {
  error.value = null
  stop()
  config.value = await $fetch<MusicConfig>('/api/music/config', { method: 'POST', body: { folder } })
  library.value = null
  if (config.value.folder && config.value.exists) await loadLibrary()
}

async function toggleScene(folder: MusicFolder) {
  if (!config.value) return
  const scenes = config.value.scenes.includes(folder.path)
    ? config.value.scenes.filter(p => p !== folder.path)
    : [...config.value.scenes, folder.path]
  config.value = await $fetch<MusicConfig>('/api/music/config', { method: 'POST', body: { scenes } })
}

function isScene(path: string): boolean {
  return !!config.value?.scenes.includes(path)
}

const hasLibrary = computed(() => !!library.value)

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const scenes = computed<MusicFolder[]>(() => {
  const root = library.value?.root
  if (!root || !config.value) return []
  return config.value.scenes
    .map(p => findMusicFolder(root, p))
    .filter((f): f is MusicFolder => !!f)
    .sort((a, b) => collator.compare(a.name, b.name))
})

// --- Playback actions -------------------------------------------------------

function playTrack(track: MusicTrack) {
  // 'folder'/'one': queue stays inside the track's folder. 'all': whole library.
  const root = library.value?.root ?? null
  scopeFolder.value = loopMode.value === 'all' || !root ? null : findMusicFolder(root, track.folderPath)
  buildOrder()
  let idx = playOrder.value.findIndex(t => t.id === track.id)
  if (idx < 0) {
    scopeFolder.value = null
    buildOrder()
    idx = playOrder.value.findIndex(t => t.id === track.id)
  }
  currentIndex.value = idx
  loadActive(track, true)
}

function playFolder(folder: MusicFolder, shuffleIt = false) {
  scopeFolder.value = folder
  random.value = shuffleIt
  saveSettings()
  buildOrder()
  if (!playOrder.value.length) return
  currentIndex.value = 0
  loadActive(playOrder.value[0]!, true)
}

/** Play a scene by folder path (used by dashboard / sessions) */
function playScene(path: string, shuffleIt = false): boolean {
  const folder = findMusicFolder(library.value?.root ?? null, path)
  if (!folder) return false
  playFolder(folder, shuffleIt)
  return true
}

function playAll() {
  if (currentTrack.value && currentIndex.value >= 0) {
    togglePlay()
    return
  }
  scopeFolder.value = null
  buildOrder()
  if (!playOrder.value.length) return
  currentIndex.value = 0
  loadActive(playOrder.value[0]!, true)
}

function togglePlay() {
  ensurePlayers()
  if (!players.length) return
  if (!currentTrack.value) {
    playAll()
    return
  }
  const el = activeEl()
  if (el.paused) {
    el.volume = 0
    el.play().catch(() => {})
    rampVolume(el, 0, volume.value, 300)
  }
  else {
    rampVolume(el, el.volume, 0, 300, () => el.pause())
  }
}

function stop() {
  if (!players.length) return
  cancelCrossfade()
  for (const el of players) {
    clearFade(el)
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
  currentTrack.value = null
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  currentIndex.value = -1
}

/** Jump to a queue position (mini player queue list) */
function playAt(index: number) {
  const track = playOrder.value[index]
  if (!track) return
  currentIndex.value = index
  loadActive(track, true)
}

function next() {
  if (!playOrder.value.length) return
  let idx = currentIndex.value + 1
  if (idx >= playOrder.value.length) {
    if (random.value) buildOrder()
    idx = 0
  }
  currentIndex.value = idx
  loadActive(playOrder.value[idx]!, true)
}

function prev() {
  if (!playOrder.value.length) return
  ensurePlayers()
  const el = activeEl()
  if (el.currentTime > 3) {
    el.currentTime = 0
    return
  }
  let idx = currentIndex.value - 1
  if (idx < 0) idx = playOrder.value.length - 1
  currentIndex.value = idx
  loadActive(playOrder.value[idx]!, true)
}

function seek(time: number) {
  if (!players.length) return
  const el = activeEl()
  el.currentTime = time
  currentTime.value = time
}

function skip(seconds: number) {
  if (!players.length || !duration.value) return
  const el = activeEl()
  el.currentTime = Math.min(Math.max(0, el.currentTime + seconds), duration.value)
  currentTime.value = el.currentTime
}

function setVolume(v: number) {
  volume.value = clamp(v)
  if (players.length && !crossfading) activeEl().volume = volume.value
  saveSettings()
}

function toggleRandom() {
  random.value = !random.value
  saveSettings()
  buildOrder()
}

function cycleLoop() {
  loopMode.value = loopMode.value === 'folder' ? 'one' : loopMode.value === 'one' ? 'all' : 'folder'
  saveSettings()
}

function setCrossfade(enabled: boolean) {
  crossfadeEnabled.value = enabled
  saveSettings()
}

function setCrossfadeSec(sec: number) {
  crossfadeSec.value = Math.max(1, Math.min(12, Math.round(sec)))
  saveSettings()
}

function toggleExpand(path: string) {
  if (expanded.has(path)) expanded.delete(path)
  else expanded.add(path)
  saveState({ expanded: [...expanded] })
}

function collapseAll() {
  expanded.clear()
  saveState({ expanded: [] })
}

function expandAll() {
  const add = (f: MusicFolder) => {
    if (f.children.length) expanded.add(f.path)
    f.children.forEach(add)
  }
  library.value?.root.children.forEach(add)
  saveState({ expanded: [...expanded] })
}

export function useMusicPlayer() {
  return {
    // state
    config,
    library,
    loading,
    scanning,
    error,
    expanded,
    query,
    random,
    loopMode,
    crossfadeEnabled,
    crossfadeSec,
    volume,
    scopeFolder,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    currentIndex,
    queue: playOrder,
    missingTracks,
    hasLibrary,
    scenes,
    // library
    init,
    loadLibrary,
    setFolder,
    toggleScene,
    isScene,
    // playback
    playTrack,
    playFolder,
    playScene,
    playAll,
    playAt,
    togglePlay,
    stop,
    next,
    prev,
    seek,
    skip,
    setVolume,
    toggleRandom,
    cycleLoop,
    setCrossfade,
    setCrossfadeSec,
    toggleExpand,
    collapseAll,
    expandAll,
  }
}
