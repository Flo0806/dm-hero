interface Faction {
  id: number
  _counts?: FactionCounts
}

interface FactionCounts {
  members: number
  lore: number
  documents: number
  images: number
}

/**
 * Composable to load Faction counts asynchronously
 * Updates the Faction object reactively with _counts property
 */
export function useFactionCounts() {
  const loadingCounts = ref<Set<number>>(new Set())
  // Store counts as reactive object (not Map - Vue can't track Map.get())
  const countsMap = reactive<Record<number, FactionCounts>>({})

  async function loadFactionCounts(faction: Faction): Promise<void> {
    // Skip if already loading
    if (loadingCounts.value.has(faction.id)) {
      return
    }

    // If already loaded, just ensure it's on the Faction object
    if (countsMap[faction.id]) {
      if (!faction._counts) {
        faction._counts = countsMap[faction.id]
      }
      return
    }

    loadingCounts.value.add(faction.id)

    try {
      const counts = await $fetch<FactionCounts>(`/api/factions/${faction.id}/counts`)
      // Store in reactive object (Vue tracks property access)
      countsMap[faction.id] = counts
      // Also add to Faction object for immediate access
      faction._counts = counts
    } catch (error) {
      console.error(`Failed to load counts for Faction ${faction.id}:`, error)
    } finally {
      loadingCounts.value.delete(faction.id)
    }
  }

  /**
   * Load counts for multiple Factions in parallel
   */
  async function loadFactionCountsBatch(factions: Faction[]): Promise<void> {
    const promises = factions.map((faction) => loadFactionCounts(faction))
    await Promise.all(promises)
  }

  /**
   * Get counts for a specific Faction (reactively!)
   */
  function getCounts(factionId: number): FactionCounts | undefined {
    return countsMap[factionId]
  }

  /**
   * Force reload counts for a specific Faction (ignores cache)
   * Use this after operations that change counts (e.g., adding/deleting relations)
   */
  async function reloadFactionCounts(faction: Faction): Promise<void> {
    // Remove from cache to force reload
    delete countsMap[faction.id]
    loadingCounts.value.delete(faction.id)
    // Now load fresh
    await loadFactionCounts(faction)
  }

  /**
   * Clear all cached counts
   * Use this when reloading all Factions from API
   */
  function clearCountsCache(): void {
    // Clear all properties from reactive object
    Object.keys(countsMap).forEach((key) => delete countsMap[Number(key)])
    loadingCounts.value.clear()
  }

  return {
    loadFactionCounts,
    loadFactionCountsBatch,
    getCounts,
    reloadFactionCounts,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
  }
}
