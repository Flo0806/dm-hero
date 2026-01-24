/**
 * Composable for creating a group and adding an entity to it.
 * Used by context menu "Neue Gruppe" action across all entity pages.
 */
export function useGroupCreate() {
  const show = ref(false)
  const entityId = ref<number | null>(null)

  function open(id: number) {
    entityId.value = id
    show.value = true
  }

  function close() {
    show.value = false
    entityId.value = null
  }

  return {
    show,
    entityId,
    open,
    close,
  }
}
