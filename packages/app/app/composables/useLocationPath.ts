interface PathItem {
  id: number
  name: string
  depth: number
}

/**
 * Composable to fetch and format location breadcrumb path
 * Returns full path from root to current location
 */
export function useLocationPath() {
  const locationPaths = ref<Record<number, PathItem[]>>({})
  const loading = ref(false)

  /**
   * Fetch breadcrumb path for a location
   * Caches result to avoid redundant API calls
   */
  async function fetchPath(locationId: number): Promise<PathItem[]> {
    // Return cached if available
    if (locationPaths.value[locationId]) {
      return locationPaths.value[locationId]
    }

    loading.value = true
    try {
      const path = await $fetch<PathItem[]>(`/api/locations/${locationId}/path`)
      locationPaths.value[locationId] = path
      return path
    } catch (error) {
      console.error('Failed to fetch location path:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Format path as breadcrumb string
   * Example: "Taverne → Hafenviertel → Falkenpfeil"
   */
  function formatBreadcrumb(path: PathItem[]): string {
    if (!path || path.length === 0) return ''

    // Path is ordered from root to current location (depth DESC)
    // We want to show: root → ... → current
    return path.map((item) => item.name).join(' → ')
  }

  /**
   * Get parent locations only (exclude current location)
   */
  function getParentPath(path: PathItem[]): PathItem[] {
    if (!path || path.length <= 1) return []
    return path.slice(0, -1) // Remove last item (current location)
  }

  /**
   * Clear cache for a specific location
   */
  function clearCache(locationId: number) {
    const { [locationId]: _, ...rest } = locationPaths.value
    locationPaths.value = rest
  }

  /**
   * Clear all cached paths
   */
  function clearAllCache() {
    locationPaths.value = {}
  }

  return {
    locationPaths,
    loading,
    fetchPath,
    formatBreadcrumb,
    getParentPath,
    clearCache,
    clearAllCache,
  }
}
