// Live "a player wrote" (client only) - calls onMessage with the player id
export function useTableMessageEvents(tableId: MaybeRefOrGetter<number | null | undefined>, onMessage: (playerId: number) => void) {
  let source: EventSource | null = null

  function close() {
    source?.close()
    source = null
  }

  watch(() => toValue(tableId), (id) => {
    close()
    if (!id || !import.meta.client) return
    source = new EventSource(`/api/game-table/${id}/message-events`)
    source.onmessage = event => onMessage((JSON.parse(event.data) as { playerId: number }).playerId)
  }, { immediate: true })

  onBeforeUnmount(close)
}
