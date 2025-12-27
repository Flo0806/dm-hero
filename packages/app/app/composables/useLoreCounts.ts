interface Lore {
  id: number
  _counts?: LoreCounts
}

interface LoreCounts {
  npcs: number
  items: number
  factions: number
  locations: number
  players: number
  documents: number
  images: number
}

// SHARED STATE - outside the function so all components share the same cache
const loadingCounts = ref<Set<number>>(new Set())
const countsMap = reactive<Record<number, LoreCounts | undefined>>({})

/**
 * Composable to load Lore counts asynchronously
 * Uses shared state so all LoreCards share the same cache
 */
export function useLoreCounts() {

  async function loadLoreCounts(lore: Lore): Promise<void> {
    // Skip if already loading
    if (loadingCounts.value.has(lore.id)) {
      return
    }

    // If already loaded, just ensure it's on the Lore object
    if (countsMap[lore.id]) {
      if (!lore._counts) {
        lore._counts = countsMap[lore.id]
      }
      return
    }

    loadingCounts.value.add(lore.id)

    try {
      const counts = await $fetch<LoreCounts>(`/api/lore/${lore.id}/counts`)
      // Store in reactive object (Vue tracks property access)
      countsMap[lore.id] = counts
      // Also add to Lore object for immediate access
      lore._counts = counts
    } catch (error) {
      console.error(`Failed to load counts for Lore ${lore.id}:`, error)
    } finally {
      loadingCounts.value.delete(lore.id)
    }
  }

  /**
   * Load counts for multiple Lore entries in parallel
   */
  async function loadLoreCountsBatch(loreEntries: Lore[]): Promise<void> {
    const promises = loreEntries.map((lore) => loadLoreCounts(lore))
    await Promise.all(promises)
  }

  /**
   * Get counts for a specific Lore entry (reactively!)
   */
  function getCounts(loreId: number): LoreCounts | undefined {
    return countsMap[loreId]
  }

  /**
   * Set counts for a specific Lore entry directly (used by store after API fetch)
   */
  function setCounts(loreId: number, counts: LoreCounts): void {
    countsMap[loreId] = counts
  }

  /**
   * Force reload counts for a specific Lore entry (ignores cache)
   * Use this after operations that change counts (e.g., adding/deleting relations)
   */
  async function reloadLoreCounts(lore: Lore): Promise<void> {
    // Remove from cache to force reload
    countsMap[lore.id] = undefined  
    loadingCounts.value.delete(lore.id)
    // Now load fresh
    await loadLoreCounts(lore)
  }

  /**
   * Clear all cached counts
   * Use this when reloading all Lore entries from API
   */
  function clearCountsCache(): void {
    // Clear all properties from reactive object
    Object.keys(countsMap).forEach((key) => {
      countsMap[Number(key)] = undefined  
    })
    loadingCounts.value.clear()
  }

  return {
    loadLoreCounts,
    loadLoreCountsBatch,
    getCounts,
    setCounts,
    reloadLoreCounts,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
  }
}
