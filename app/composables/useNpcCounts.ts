import type { NPC, NpcCounts } from '~/types/npc'

/**
 * Composable to load NPC counts asynchronously
 * Updates the NPC object reactively with _counts property
 */
export function useNpcCounts() {
  const loadingCounts = ref<Set<number>>(new Set())
  // Store counts as reactive object (not Map - Vue can't track Map.get())
  const countsMap = reactive<Record<number, NpcCounts>>({})

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
   * Force reload counts for a specific NPC (ignores cache)
   * Use this after operations that change counts (e.g., adding/deleting relations)
   */
  async function reloadNpcCounts(npc: NPC): Promise<void> {
    // Remove from cache to force reload
    delete countsMap[npc.id]
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
    Object.keys(countsMap).forEach((key) => delete countsMap[Number(key)])
    loadingCounts.value.clear()
  }

  return {
    loadNpcCounts,
    loadNpcCountsBatch,
    getCounts,
    reloadNpcCounts,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
  }
}
