import type { ItemCounts, Item } from '../../types/item.js'


/**
 * Composable to load Item counts asynchronously
 * Updates the Item object reactively with _counts property
 */
export function useItemCounts() {
  const loadingCounts = ref<Set<number>>(new Set())
  // Store counts as reactive object (not Map - Vue can't track Map.get())
  const countsMap = reactive<Record<number, ItemCounts | undefined>>({})

  async function loadItemCounts(item: Item): Promise<void> {
    // Skip if already loading
    if (loadingCounts.value.has(item.id)) {
      return
    }

    // If already loaded, just ensure it's on the Item object
    if (countsMap[item.id]) {
      if (!item._counts) {
        item._counts = countsMap[item.id]
      }
      return
    }

    loadingCounts.value.add(item.id)

    try {
      const counts = await $fetch<ItemCounts>(`/api/items/${item.id}/counts`)
      // Store in reactive object (Vue tracks property access)
      countsMap[item.id] = counts
      // Also add to Item object for immediate access
      item._counts = counts
    } catch (error) {
      console.error(`Failed to load counts for Item ${item.id}:`, error)
    } finally {
      loadingCounts.value.delete(item.id)
    }
  }

  /**
   * Load counts for multiple Items in parallel
   */
  async function loadItemCountsBatch(items: Item[]): Promise<void> {
    const promises = items.map((item) => loadItemCounts(item))
    await Promise.all(promises)
  }

  /**
   * Get counts for a specific Item (reactively!)
   */
  function getCounts(itemId: number): ItemCounts | undefined {
    return countsMap[itemId]
  }

  /**
   * Force reload counts for a specific Item (ignores cache)
   * Use this after operations that change counts (e.g., adding/deleting relations)
   */
  async function reloadItemCounts(item: Item): Promise<void> {
    // Remove from cache to force reload
    countsMap[item.id] = undefined  
    loadingCounts.value.delete(item.id)
    // Now load fresh
    await loadItemCounts(item)
  }

  /**
   * Clear all cached counts
   * Use this when reloading all Items from API
   */
  function clearCountsCache(): void {
    // Clear all properties from reactive object
    Object.keys(countsMap).forEach((key) => {
      countsMap[Number(key)] = undefined  
    })
    loadingCounts.value.clear()
  }

  return {
    loadItemCounts,
    loadItemCountsBatch,
    getCounts,
    reloadItemCounts,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
  }
}
