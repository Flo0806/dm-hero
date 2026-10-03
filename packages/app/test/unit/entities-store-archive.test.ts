import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref, computed, watch, reactive, readonly } from 'vue'

// The store's composables use Nuxt auto-imports - provide the Vue ones globally
Object.assign(globalThis, { ref, computed, watch, reactive, readonly })

let useEntitiesStore: typeof import('../../app/stores/entities').useEntitiesStore

beforeAll(async () => {
  useEntitiesStore = (await import('../../app/stores/entities')).useEntitiesStore
})

// Search results come straight from the API and must respect the archive toggle
describe('entities store - withoutArchived', () => {
  const results = [
    { id: 1, name: 'Aktiv', archived_at: null },
    { id: 2, name: 'Archiviert', archived_at: '2026-10-01 12:00:00' },
    { id: 3, name: 'Ohne Feld' },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hides archived entities when the toggle is off', () => {
    const store = useEntitiesStore()
    expect(store.withoutArchived(results).map(e => e.id)).toEqual([1, 3])
  })

  it('keeps archived entities when the toggle is on', () => {
    const store = useEntitiesStore()
    store.showArchived = true
    expect(store.withoutArchived(results).map(e => e.id)).toEqual([1, 2, 3])
  })
})

describe('entities store - visibleFolderCount', () => {
  const folder = { id: 7, entity_type: 'npc' as const, entity_count: 3 } as Parameters<ReturnType<typeof useEntitiesStore>['visibleFolderCount']>[0]

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('falls back to the server count while the list is not loaded', () => {
    expect(useEntitiesStore().visibleFolderCount(folder)).toBe(3)
  })

  it('counts only visible entities in the folder', () => {
    const store = useEntitiesStore()
    store.npcs = [
      { id: 1, folder_id: 7, archived_at: null },
      { id: 2, folder_id: 7, archived_at: '2026-10-01 12:00:00' },
      { id: 3, folder_id: 7 },
      { id: 4, folder_id: null },
    ] as typeof store.npcs
    expect(store.visibleFolderCount(folder)).toBe(2)
    store.showArchived = true
    expect(store.visibleFolderCount(folder)).toBe(3)
  })
})
