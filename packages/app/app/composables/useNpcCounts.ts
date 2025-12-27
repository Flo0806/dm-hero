import type { NPC, NpcCounts } from '../../types/npc.js'

// SHARED STATE - outside the function so all components share the same cache
const loadingCounts = ref<Set<number>>(new Set())
const countsMap = reactive<Record<number, NpcCounts | undefined>>({})

/**
 * Composable to load NPC counts asynchronously
 * Uses shared state so all NpcCards share the same cache
 */
export function useNpcCounts() {

  async function loadNpcCounts(npc: NPC): Promise<void> {
    // Skip if already loading
    if (loadingCounts.value.has(npc.id)) {
      return
    }

    // If already loaded, just ensure it's on the NPC object
    if (countsMap[npc.id]) {
      if (!npc._counts) {
        npc._counts = countsMap[npc.id]
      }
      return
    }

    loadingCounts.value.add(npc.id)

    try {
      const counts = await $fetch<NpcCounts>(`/api/npcs/${npc.id}/counts`)
      // Store in reactive object (Vue tracks property access)
      countsMap[npc.id] = counts
      // Also add to NPC object for immediate access
      npc._counts = counts
    } catch (error) {
      console.error(`Failed to load counts for NPC ${npc.id}:`, error)
    } finally {
      loadingCounts.value.delete(npc.id)
    }
  }

  /**
   * Load counts for multiple NPCs in parallel
   */
  async function loadNpcCountsBatch(npcs: NPC[]): Promise<void> {
    const promises = npcs.map((npc) => loadNpcCounts(npc))
    await Promise.all(promises)
  }

  /**
   * Get counts for a specific NPC (reactively!)
   */
  function getCounts(npcId: number): NpcCounts | undefined {
    return countsMap[npcId]
  }

  /**
   * Set counts for a specific NPC directly (used by store after API fetch)
   */
  function setCounts(npcId: number, counts: NpcCounts): void {
    countsMap[npcId] = counts
  }

  /**
   * Force reload counts for a specific NPC (ignores cache)
   * Use this after operations that change counts (e.g., adding/deleting relations)
   */
  async function reloadNpcCounts(npc: NPC): Promise<void> {
    // Remove from cache to force reload
    countsMap[npc.id] = undefined  
    loadingCounts.value.delete(npc.id)
    // Now load fresh
    await loadNpcCounts(npc)
  }

  /**
   * Clear all cached counts
   * Use this when reloading all NPCs from API
   */
  function clearCountsCache(): void {
    // Clear all properties from reactive object
    Object.keys(countsMap).forEach((key) => {
      countsMap[Number(key)] = undefined
    })
    loadingCounts.value.clear()
  }

  /**
   * Invalidate counts for specific NPC IDs
   * They will be reloaded on next access
   */
  function invalidateCountsFor(npcIds: number[]): void {
    for (const id of npcIds) {
      countsMap[id] = undefined
      loadingCounts.value.delete(id)
    }
  }

  /**
   * Reload counts for specific NPC IDs
   * Use this after relation changes to update affected NPCs
   */
  async function reloadCountsFor(npcIds: number[]): Promise<void> {
    // First invalidate
    invalidateCountsFor(npcIds)
    // Then reload in parallel
    const promises = npcIds.map(async (id) => {
      try {
        const counts = await $fetch<NpcCounts>(`/api/npcs/${id}/counts`)
        countsMap[id] = counts
      } catch (error) {
        console.error(`Failed to reload counts for NPC ${id}:`, error)
      }
    })
    await Promise.all(promises)
  }

  return {
    loadNpcCounts,
    loadNpcCountsBatch,
    getCounts,
    setCounts,
    reloadNpcCounts,
    clearCountsCache,
    invalidateCountsFor,
    reloadCountsFor,
    loadingCounts: computed(() => loadingCounts.value),
  }
}
