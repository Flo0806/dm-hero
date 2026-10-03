import type { TablePing } from '~~/types/fog'

// Live pings of the players (client only) - calls onPing for each
export function useTablePings(tableId: MaybeRefOrGetter<number | null | undefined>, onPing: (ping: TablePing) => void) {
  let source: EventSource | null = null

  function close() {
    source?.close()
    source = null
  }

  watch(() => toValue(tableId), (id) => {
    close()
    if (!id || !import.meta.client) return
    source = new EventSource(`/api/game-table/${id}/pings`)
    source.onmessage = event => onPing(JSON.parse(event.data) as TablePing)
  }, { immediate: true })

  onBeforeUnmount(close)
}
