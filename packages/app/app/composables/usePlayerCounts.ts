import type { PlayerCounts, Player } from '../../types/player.js'

// SHARED STATE - outside the function so all components share the same cache
const loadingCounts = ref<Set<number>>(new Set())
const countsMap = reactive<Record<number, PlayerCounts | undefined>>({})
const batchLoading = ref(false)

/**
 * Composable to load Player counts asynchronously
 * Uses shared state so all PlayerCards share the same cache
 */
export function usePlayerCounts() {

  async function loadPlayerCounts(player: Player): Promise<void> {
    // Skip if already loading
    if (loadingCounts.value.has(player.id)) {
      return
    }

    // If already loaded, just ensure it's on the Player object
    if (countsMap[player.id]) {
      if (!player._counts) {
        player._counts = countsMap[player.id]
      }
      return
    }

    loadingCounts.value.add(player.id)

    try {
      const counts = await $fetch<PlayerCounts>(`/api/players/${player.id}/counts`)
      // Store in reactive object (Vue tracks property access)
      countsMap[player.id] = counts
      // Also add to Player object for immediate access
      player._counts = counts
    } catch (error) {
      console.error(`Failed to load counts for Player ${player.id}:`, error)
    } finally {
      loadingCounts.value.delete(player.id)
    }
  }

  /**
   * Load counts for multiple Players in parallel (legacy - uses individual requests)
   */
  async function loadPlayerCountsBatch(players: Player[]): Promise<void> {
    const promises = players.map((player) => loadPlayerCounts(player))
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
      const allCounts = await $fetch<Record<number, PlayerCounts>>('/api/players/batch-counts', {
        query: { campaignId },
      })

      // Store all counts in the cache
      for (const [playerIdStr, counts] of Object.entries(allCounts)) {
        const playerId = Number(playerIdStr)
        countsMap[playerId] = counts
      }
    } catch (error) {
      console.error('Failed to load Player counts batch:', error)
    } finally {
      batchLoading.value = false
    }
  }

  /**
   * Get counts for a specific Player (reactively!)
   */
  function getCounts(playerId: number): PlayerCounts | undefined {
    return countsMap[playerId]
  }

  /**
   * Set counts for a specific Player directly (used by store after API fetch)
   */
  function setCounts(playerId: number, counts: PlayerCounts): void {
    countsMap[playerId] = counts
  }

  /**
   * Force reload counts for a specific Player (ignores cache)
   * Use this after operations that change counts (e.g., adding/deleting relations)
   */
  async function reloadPlayerCounts(player: Player): Promise<void> {
    // Remove from cache to force reload
    countsMap[player.id] = undefined
    loadingCounts.value.delete(player.id)
    // Now load fresh
    await loadPlayerCounts(player)
  }

  /**
   * Clear all cached counts
   * Use this when reloading all Players from API
   */
  function clearCountsCache(): void {
    // Clear all properties from reactive object
    Object.keys(countsMap).forEach((key) => {
      countsMap[Number(key)] = undefined
    })
    loadingCounts.value.clear()
  }

  return {
    loadPlayerCounts,
    loadPlayerCountsBatch,
    loadAllCountsForCampaign,
    getCounts,
    setCounts,
    reloadPlayerCounts,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
    batchLoading: computed(() => batchLoading.value),
  }
}
