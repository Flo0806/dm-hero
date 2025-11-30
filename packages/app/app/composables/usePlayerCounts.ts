import type { PlayerCounts, Player } from '../../types/player.js'

/**
 * Composable to load Player counts asynchronously
 * Updates the Player object reactively with _counts property
 */
export function usePlayerCounts() {
  const loadingCounts = ref<Set<number>>(new Set())
  // Store counts as reactive object (not Map - Vue can't track Map.get())
  const countsMap = reactive<Record<number, PlayerCounts | undefined>>({})

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
   * Load counts for multiple Players in parallel
   */
  async function loadPlayerCountsBatch(players: Player[]): Promise<void> {
    const promises = players.map((player) => loadPlayerCounts(player))
    await Promise.all(promises)
  }

  /**
   * Get counts for a specific Player (reactively!)
   */
  function getCounts(playerId: number): PlayerCounts | undefined {
    return countsMap[playerId]
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
    getCounts,
    reloadPlayerCounts,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
  }
}
