import type { ItemCounts, Item } from '../../types/item.js'

// SHARED STATE - outside the function so all components share the same cache
const loadingCounts = ref<Set<number>>(new Set())
const countsMap = reactive<Record<number, ItemCounts | undefined>>({})

/**
 * Composable to load Item counts asynchronously
 * Uses shared state so all ItemCards share the same cache
 */
export function useItemCounts() {

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
   * Set counts for a specific Item directly (used by store after API fetch)
   */
  function setCounts(itemId: number, counts: ItemCounts): void {
    countsMap[itemId] = counts
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
    setCounts,
    reloadItemCounts,
    clearCountsCache,
    loadingCounts: computed(() => loadingCounts.value),
  }
}
