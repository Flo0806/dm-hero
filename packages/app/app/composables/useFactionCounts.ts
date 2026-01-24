import type { GroupInfo } from '../../types/group'

interface Faction {
  id: number
  _counts?: FactionCounts
}

interface FactionCounts {
  members: number
  lore: number
  players: number
  documents: number
  images: number
  items: number
  locations: number
  relations: number
  groups?: GroupInfo[]
}

// SHARED STATE - outside the function so all components share the same cache
const loadingCounts = ref<Set<number>>(new Set())
const countsMap = reactive<Record<number, FactionCounts | undefined>>({})
const batchLoading = ref(false)

/**
 * Composable to load Faction counts asynchronously
 * Updates the Faction object reactively with _counts property
 */
export function useFactionCounts() {

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
   * Load counts for multiple Factions in parallel (legacy - uses individual requests)
   */
  async function loadFactionCountsBatch(factions: Faction[]): Promise<void> {
    const promises = factions.map((faction) => loadFactionCounts(faction))
    await Promise.all(promises)
  }

  /**
   * Load ALL counts for a campaign in ONE request (efficient!)
   * Replaces N individual requests with 1 batch request
   */
  async function loadAllCountsForCampaign(campaignId: string | number): Promise<void> {
    if (batchLoading.value) return

    batchLoading.value = true
    try {
      const allCounts = await $fetch<Record<number, FactionCounts>>('/api/factions/batch-counts', {
        query: { campaignId },
      })

      // Store all counts in the cache
      for (const [factionIdStr, counts] of Object.entries(allCounts)) {
        const factionId = Number(factionIdStr)
        countsMap[factionId] = counts
      }
    } catch (error) {
      console.error('Failed to load Faction counts batch:', error)
    } finally {
      batchLoading.value = false
    }
  }

  /**
   * Get counts for a specific Faction (reactively!)
   */
  function getCounts(factionId: number): FactionCounts | undefined {
    return countsMap[factionId]
  }

  /**
   * Set counts for a specific Faction directly (used by store after API fetch)
   */
  function setCounts(factionId: number, counts: FactionCounts): void {
    countsMap[factionId] = counts
  }

  /**
   * Force reload counts for a specific Faction (ignores cache)
   * Use this after operations that change counts (e.g., adding/deleting relations)
   */
  async function reloadFactionCounts(faction: Faction): Promise<void> {
    // Remove from cache to force reload
    countsMap[faction.id] = undefined
    loadingCounts.value.delete(faction.id)
    // Now load fresh
    await loadFactionCounts(faction)
  }

  /**
   * Reload counts for specific Faction IDs (used by QuickLink after creating relations)
   */
  async function reloadCountsFor(factionIds: number[]): Promise<void> {
    // Invalidate cache for these IDs
    for (const id of factionIds) {
      countsMap[id] = undefined
      loadingCounts.value.delete(id)
    }
    // Reload in parallel
    const promises = factionIds.map(async (id) => {
      try {
        const counts = await $fetch<FactionCounts>(`/api/factions/${id}/counts`)
        countsMap[id] = counts
      } catch (error) {
        console.error(`Failed to reload counts for Faction ${id}:`, error)
      }
    })
    await Promise.all(promises)
  }

  /**
   * Clear all cached counts
   * Use this when reloading all Factions from API
   */
  function clearCountsCache(): void {
    // Clear all properties from reactive object
    Object.keys(countsMap).forEach((key) => {
      countsMap[Number(key)] = undefined  
    })
    loadingCounts.value.clear()
  }

  return {
    loadFactionCounts,
    loadFactionCountsBatch,
    loadAllCountsForCampaign,
    getCounts,
    setCounts,
    reloadFactionCounts,
    reloadCountsFor,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
    batchLoading: computed(() => batchLoading.value),
  }
}
