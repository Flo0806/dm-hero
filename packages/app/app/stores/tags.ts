import { defineStore } from 'pinia'
import type { Tag } from '~~/types/tag'
import type { TagWithUsage } from '~~/server/api/tags/index.get'

/**
 * Tags store.
 *
 * Two concerns:
 *  - per-entity tag lists (reactive Map keyed by entity id). Cards subscribe to
 *    `tagsFor(id)` and queue a request via `requestTagsFor(id)`. Requests within
 *    a short window are coalesced into one `/api/tags/batch` call → no N+1.
 *  - the full tag catalogue (used by the picker dropdown + the manage page).
 */
export const useTagsStore = defineStore('tags', () => {
  // entityId → tags. Map for reactive key tracking.
  const byEntity = ref<Map<number, Tag[]>>(new Map())

  // Pending ids in the current batch window
  const pending = new Set<number>()
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  // Track ids that have ever been requested so we don't re-request needlessly
  const requested = new Set<number>()

  // Full catalogue (rare loads, cached)
  const catalogue = ref<TagWithUsage[]>([])
  const catalogueLoaded = ref(false)

  function tagsFor(entityId: number): Tag[] {
    return byEntity.value.get(entityId) ?? []
  }

  function setTagsFor(entityId: number, tags: Tag[]) {
    const next = new Map(byEntity.value)
    next.set(entityId, tags)
    byEntity.value = next
  }

  async function flushBatch() {
    flushTimer = null
    if (pending.size === 0) return
    const ids = [...pending]
    pending.clear()
    try {
      const result = await $fetch<Record<number, Tag[]>>('/api/tags/batch', {
        query: { entityIds: ids.join(',') },
      })
      const next = new Map(byEntity.value)
      for (const id of ids) {
        next.set(id, result[id] ?? [])
      }
      byEntity.value = next
    }
    catch (e) {
      // Drop failed ids from `requested` so they can be retried on the next
      // `requestTagsFor` call — otherwise a transient network blip stuck them.
      for (const id of ids) requested.delete(id)
      console.error('[tags] batch fetch failed', e)
    }
  }

  function requestTagsFor(entityId: number) {
    if (requested.has(entityId)) return
    requested.add(entityId)
    pending.add(entityId)
    if (flushTimer) return
    // Coalesce ids that come in within the same ~30ms window.
    flushTimer = setTimeout(flushBatch, 30)
  }

  async function loadCatalogue(force = false): Promise<TagWithUsage[]> {
    if (catalogueLoaded.value && !force) return catalogue.value
    try {
      catalogue.value = await $fetch<TagWithUsage[]>('/api/tags')
      catalogueLoaded.value = true
    }
    catch (e) {
      console.error('[tags] catalogue fetch failed', e)
    }
    return catalogue.value
  }

  async function attachTag(entityId: number, payload: { tagId?: number, name?: string, color?: string }): Promise<Tag> {
    const result = await $fetch<Tag>(`/api/entities/${entityId}/tags`, {
      method: 'POST',
      body: payload,
    })
    setTagsFor(entityId, [...tagsFor(entityId), result])
    // Catalogue may have changed (new tag or color flip on revive) → invalidate
    catalogueLoaded.value = false
    return result
  }

  async function detachTag(entityId: number, tagId: number) {
    await $fetch(`/api/entities/${entityId}/tags/${tagId}`, { method: 'DELETE' })
    setTagsFor(entityId, tagsFor(entityId).filter(t => t.id !== tagId))
  }

  /**
   * Invalidate caches after manage-page actions (rename / delete / recolor).
   * Forces all subsequent `requestTagsFor` calls to re-fetch.
   */
  function invalidateAll() {
    // Cancel any scheduled batch so a queued flush can't repopulate stale data
    // right after we reset.
    pending.clear()
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    byEntity.value = new Map()
    requested.clear()
    catalogueLoaded.value = false
  }

  return {
    byEntity,
    catalogue,
    catalogueLoaded,
    tagsFor,
    requestTagsFor,
    loadCatalogue,
    attachTag,
    detachTag,
    invalidateAll,
  }
})
