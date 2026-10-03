import { EMPTY_FOG, FOG_MAX_BYTES, FOG_MAX_STROKES, FOG_SOFT_LIMIT_BYTES, type FogStroke, type MapFog } from '~~/types/fog'

// Fog of war of one map: load, paint, undo - saved shortly after each change.
// A change always belongs to the map it was made on; saves run one after another.
const SAVE_DELAY = 150
const UNDO_LIMIT = 50

/** ok | big (warn, still paints) | full (refused - reveal/cover all starts fresh) */
export type FogSize = 'ok' | 'big' | 'full'

export function useMapFog() {
  const fog = ref<MapFog>(structuredClone(EMPTY_FOG))
  const history: MapFog[] = []
  const canUndo = ref(false)
  /** The map the current fog belongs to - null while loading (no painting meanwhile) */
  const mapId = ref<number | null>(null)
  const size = ref<FogSize>('ok')
  const saveFailed = ref(false)
  let dirty = false
  let loadSeq = 0
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saving: Promise<void> = Promise.resolve()

  const sizeOf = (value: MapFog): FogSize => {
    const bytes = JSON.stringify(value).length
    if (bytes > FOG_MAX_BYTES || value.strokes.length > FOG_MAX_STROKES) return 'full'
    return bytes > FOG_SOFT_LIMIT_BYTES ? 'big' : 'ok'
  }

  /** Save pending changes now (one request after another, in order) */
  function flush() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    if (!dirty || mapId.value === null) return saving
    const id = mapId.value
    const body = fog.value
    dirty = false
    saving = saving.then(async () => {
      try {
        await $fetch(`/api/maps/${id}/fog`, { method: 'PUT', body })
        saveFailed.value = false
      }
      catch (error) {
        console.error('[Fog] Save failed:', error)
        saveFailed.value = true
      }
    })
    return saving
  }

  function scheduleSave() {
    dirty = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, SAVE_DELAY)
  }

  /** false = refused (fog too big) */
  function change(next: MapFog) {
    if (mapId.value === null) return false
    const nextSize = sizeOf(next)
    size.value = nextSize
    if (nextSize === 'full') return false
    history.push(fog.value)
    if (history.length > UNDO_LIMIT) history.shift()
    canUndo.value = true
    fog.value = next
    scheduleSave()
    return true
  }

  async function load(id: number) {
    const seq = ++loadSeq
    // Pending changes go to the previous map (taken right now), then painting is locked until loaded
    const saved = flush()
    mapId.value = null
    dirty = false
    history.length = 0
    canUndo.value = false
    await saved
    const loaded = await $fetch<MapFog>(`/api/maps/${id}/fog`)
    // Another map was opened meanwhile
    if (seq !== loadSeq) return
    fog.value = loaded
    size.value = sizeOf(loaded)
    mapId.value = id
  }

  /** Map closed: save what's pending, then forget it */
  async function close() {
    ++loadSeq
    const saved = flush()
    mapId.value = null
    dirty = false
    await saved
  }

  return {
    fog: computed<MapFog>(() => fog.value),
    canUndo: readonly(canUndo),
    ready: computed(() => mapId.value !== null),
    size: readonly(size),
    saveFailed: readonly(saveFailed),
    load,
    close,
    flush,
    addStroke: (stroke: FogStroke) => change({ ...fog.value, strokes: [...fog.value.strokes, stroke] }),
    revealAll: () => change({ base: 'clear', strokes: [] }),
    coverAll: () => change({ base: 'covered', strokes: [] }),
    undo() {
      const previous = history.pop()
      if (!previous || mapId.value === null) return
      canUndo.value = history.length > 0
      fog.value = previous
      size.value = sizeOf(previous)
      scheduleSave()
    },
  }
}
