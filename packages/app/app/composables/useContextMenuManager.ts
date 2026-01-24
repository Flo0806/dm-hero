/**
 * Global context menu manager
 * Ensures only one context menu is open at a time
 */
const activeEntityId = ref<number | null>(null)

export function useContextMenuManager() {
  /**
   * Set the active context menu (closes all others)
   */
  function setActive(entityId: number | null) {
    activeEntityId.value = entityId
  }

  /**
   * Check if a specific entity's context menu should be open
   */
  function isActive(entityId: number): boolean {
    return activeEntityId.value === entityId
  }

  /**
   * Close all context menus
   */
  function closeAll() {
    activeEntityId.value = null
  }

  return {
    activeEntityId: readonly(activeEntityId),
    setActive,
    isActive,
    closeAll,
  }
}
