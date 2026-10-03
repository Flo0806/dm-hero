import { EMPTY_FOG, type FogStroke, type MapFog } from '~~/types/fog'

// Fog of war of one map: load, paint, undo - saved shortly after each change.
const SAVE_DELAY = 150
const UNDO_LIMIT = 50

export function useMapFog() {
  const fog = ref<MapFog>(structuredClone(EMPTY_FOG))
  const history: MapFog[] = []
  const canUndo = ref(false)
  let mapId: number | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  async function flush() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    if (mapId === null) return
    await $fetch(`/api/maps/${mapId}/fog`, { method: 'PUT', body: fog.value })
      .catch(error => console.error('[Fog] Save failed:', error))
  }

  function change(next: MapFog) {
    history.push(fog.value)
    if (history.length > UNDO_LIMIT) history.shift()
    canUndo.value = true
    fog.value = next
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, SAVE_DELAY)
  }

  async function load(id: number) {
    // Pending changes of the previous map first
    if (saveTimer) await flush()
    mapId = id
    history.length = 0
    canUndo.value = false
    fog.value = await $fetch<MapFog>(`/api/maps/${id}/fog`)
  }

  return {
    fog: computed<MapFog>(() => fog.value),
    canUndo: readonly(canUndo),
    load,
    flush,
    addStroke: (stroke: FogStroke) => change({ ...fog.value, strokes: [...fog.value.strokes, stroke] }),
    revealAll: () => change({ base: 'clear', strokes: [] }),
    coverAll: () => change({ base: 'covered', strokes: [] }),
    undo() {
      const previous = history.pop()
      if (!previous) return
      canUndo.value = history.length > 0
      fog.value = previous
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(flush, SAVE_DELAY)
    },
  }
}
