import { defineStore } from 'pinia'
import type { EntityFolder, EntityFolderType, EntityFolderWithCount } from '~~/types/folder'

/**
 * Folders store — caches the folder list per (campaignId, entityType).
 *
 * Mutations (create/rename/delete/move) invalidate the matching cache slot so
 * the next `load()` call refetches. Move() additionally adjusts entity_count
 * locally so the UI doesn't flicker between optimistic and authoritative state.
 */
const cacheKey = (campaignId: number, entityType: EntityFolderType) => `${campaignId}:${entityType}`

export const useFoldersStore = defineStore('folders', () => {
  const byKey = ref<Map<string, EntityFolderWithCount[]>>(new Map())
  // In-flight load promises keyed by cacheKey. A second `load()` call for
  // the same key joins the existing fetch instead of returning the stale
  // (or empty) cached value early.
  const inFlight = new Map<string, Promise<EntityFolderWithCount[]>>()

  // Briefly-set folder id that just received an entity — components watch this
  // to flash the target folder card so users see WHERE the entity went.
  const flashedFolderId = ref<number | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function flashFolder(id: number) {
    flashedFolderId.value = id
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flashedFolderId.value = null
      flashTimer = null
    }, 1400)
  }

  function folders(campaignId: number, entityType: EntityFolderType): EntityFolderWithCount[] {
    return byKey.value.get(cacheKey(campaignId, entityType)) ?? []
  }

  function setFolders(campaignId: number, entityType: EntityFolderType, list: EntityFolderWithCount[]) {
    const next = new Map(byKey.value)
    next.set(cacheKey(campaignId, entityType), list)
    byKey.value = next
  }

  function invalidate(campaignId: number, entityType: EntityFolderType) {
    const next = new Map(byKey.value)
    next.delete(cacheKey(campaignId, entityType))
    byKey.value = next
  }

  async function load(
    campaignId: number,
    entityType: EntityFolderType,
    force = false,
  ): Promise<EntityFolderWithCount[]> {
    const key = cacheKey(campaignId, entityType)
    if (!force && byKey.value.has(key)) return byKey.value.get(key)!

    // Coalesce concurrent loads — the second caller gets the SAME promise and
    // resolves with the same authoritative data as the first. A forced load
    // (e.g. refresh after an AI import) must NOT join a stale in-flight request;
    // it starts a fresh fetch and supersedes the pending entry.
    if (!force) {
      const existing = inFlight.get(key)
      if (existing) return existing
    }

    const promise = (async () => {
      try {
        const list = await $fetch<EntityFolderWithCount[]>('/api/folders', {
          query: { campaignId, entityType },
        })
        setFolders(campaignId, entityType, list)
        return list
      }
      catch (e) {
        console.error('[folders] load failed', e)
        return byKey.value.get(key) ?? []
      }
      finally {
        inFlight.delete(key)
      }
    })()
    inFlight.set(key, promise)
    return promise
  }

  async function create(payload: {
    campaignId: number
    entityType: EntityFolderType
    name: string
    color?: string | null
    icon?: string | null
    easter_egg?: string | null
    parent_folder_id?: number | null
  }): Promise<EntityFolder> {
    const result = await $fetch<EntityFolder>('/api/folders', {
      method: 'POST',
      body: payload,
    })
    invalidate(payload.campaignId, payload.entityType)
    return result
  }

  async function update(
    campaignId: number,
    entityType: EntityFolderType,
    folderId: number,
    patch: { name?: string, color?: string | null, icon?: string | null, easter_egg?: string | null },
  ): Promise<EntityFolder> {
    const result = await $fetch<EntityFolder>(`/api/folders/${folderId}`, {
      method: 'PATCH',
      body: patch,
    })
    invalidate(campaignId, entityType)
    return result
  }

  async function remove(campaignId: number, entityType: EntityFolderType, folderId: number) {
    await $fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
    invalidate(campaignId, entityType)
  }

  /**
   * Move an entity into a folder (or out, with folder_id=null). Updates the
   * counts of source/target folders in the cached list so the UI reflects it
   * without a refetch.
   */
  async function moveEntity(
    campaignId: number,
    entityType: EntityFolderType,
    entityId: number,
    fromFolderId: number | null,
    toFolderId: number | null,
  ): Promise<void> {
    if (fromFolderId === toFolderId) return
    await $fetch(`/api/entities/${entityId}/folder`, {
      method: 'PATCH',
      body: { folder_id: toFolderId },
    })
    if (toFolderId !== null) flashFolder(toFolderId)

    const list = byKey.value.get(cacheKey(campaignId, entityType))
    if (!list) return
    const next = list.map((f) => {
      if (f.id === fromFolderId) return { ...f, entity_count: Math.max(0, f.entity_count - 1) }
      if (f.id === toFolderId) return { ...f, entity_count: f.entity_count + 1 }
      return f
    })
    setFolders(campaignId, entityType, next)
  }

  function invalidateAll() {
    byKey.value = new Map()
  }

  /**
   * Force-reload every folder slot that is currently cached. Used when the app
   * regains focus so folders created by an external change (e.g. AI bulk-import)
   * appear — without emptying the tree first like invalidateAll() would.
   */
  async function refetchLoaded() {
    const keys = [...byKey.value.keys()]
    await Promise.all(keys.map((k) => {
      const [cid, type] = k.split(':')
      return load(Number(cid), type as EntityFolderType, true)
    }))
  }

  return {
    folders,
    flashedFolderId,
    load,
    create,
    update,
    remove,
    moveEntity,
    invalidate,
    invalidateAll,
    refetchLoaded,
  }
})
