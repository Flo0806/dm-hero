import type { GameTablePresence } from '~~/types/game-table'

// Live "who is online" + relay status for the game table page (client only)
export function useGameTablePresence(tableId: MaybeRefOrGetter<number | null>) {
  const presence = ref<GameTablePresence>({ connected: false, online: [], pending: [] })
  let source: EventSource | null = null

  function close() {
    source?.close()
    source = null
    presence.value = { connected: false, online: [], pending: [] }
  }

  watch(() => toValue(tableId), (id) => {
    close()
    if (!id) return
    source = new EventSource(`/api/game-table/${id}/presence`)
    source.onmessage = (event) => {
      presence.value = JSON.parse(event.data) as GameTablePresence
    }
  }, { immediate: true })

  onBeforeUnmount(close)
  return presence
}
