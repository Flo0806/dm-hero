// Player side of a game: join with code + PIN, then stay connected via SSE
export function usePlayerSession() {
  async function join(code: string, pin: string) {
    return await $fetch<{ gameId: string, playerId: string, name: string }>('/api/v1/join', {
      method: 'POST',
      body: { code, pin },
    })
  }

  function connect(gameId: string) {
    const status = ref<'connecting' | 'live' | 'reconnecting' | 'denied'>('connecting')
    const name = ref('')
    let opened = false
    const source = new EventSource(`/api/v1/games/${gameId}/events`)

    source.addEventListener('ready', (event) => {
      opened = true
      status.value = 'live'
      name.value = (JSON.parse((event as MessageEvent).data) as { name: string }).name
    })
    source.onerror = () => {
      // Never got in (no/expired session) vs. lost an existing connection
      if (!opened) {
        source.close()
        status.value = 'denied'
      }
      else {
        status.value = 'reconnecting'
      }
    }

    onBeforeUnmount(() => source.close())
    return { status, name }
  }

  return { join, connect }
}
