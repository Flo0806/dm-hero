import { derivePairKey, fingerprint, importExchangePublicKey, importVerifyKey, unwrapGameKey, type Envelope } from '@dm-hero/seal'

// Player side of a game: join with code + PIN, then stay connected via SSE
export function usePlayerSession() {
  async function join(code: string, pin: string) {
    // Device key: the public half goes to DM Hero (via the relay), the private half stays here
    const device = await getDeviceKey()
    const result = await $fetch<{ gameId: string, playerId: string, name: string, dmPublicKeys: { signing: string, exchange: string } }>('/api/v1/join', {
      method: 'POST',
      body: { code, pin, publicKey: device.publicKey },
    })
    await saveDmPublicKeys(result.gameId, result.dmPublicKeys)
    return result
  }

  function connect(gameId: string) {
    const status = ref<'connecting' | 'live' | 'reconnecting' | 'denied' | 'ended'>('connecting')
    const name = ref('')
    /** Game key received and verified as coming from the DM */
    const encrypted = ref(false)
    /** Same three symbols the DM sees when approving this device */
    const symbols = ref<string[]>([])
    void getDeviceKey().then(async device => symbols.value = await fingerprint(device.publicKey))
    let gameKey: CryptoKey | null = null
    let opened = false
    const source = new EventSource(`/api/v1/games/${gameId}/events`)

    source.addEventListener('ready', (event) => {
      opened = true
      status.value = 'live'
      name.value = (JSON.parse((event as MessageEvent).data) as { name: string }).name
    })

    // DM Hero wrapped the game key for a device - only ours can open it
    source.addEventListener('game-key', async (event) => {
      const { publicKey, envelope } = JSON.parse((event as MessageEvent).data) as { publicKey: string, envelope: Envelope }
      const [device, dm] = await Promise.all([getDeviceKey(), loadDmPublicKeys(gameId)])
      if (!dm || device.publicKey !== publicKey) return
      try {
        const pairKey = await derivePairKey(device.keyPair.privateKey, await importExchangePublicKey(dm.exchange), gameId)
        gameKey = await unwrapGameKey(envelope, pairKey, await importVerifyKey(dm.signing))
        encrypted.value = true
      }
      catch (error) {
        // Wrong key or not signed by the DM - never trust it
        console.error('[E2E] Game key rejected:', error)
      }
    })

    // DM ended the game
    source.addEventListener('closed', () => {
      source.close()
      status.value = 'ended'
    })
    source.onerror = () => {
      // CLOSED = the server refused us (no session: kicked or never joined).
      // Otherwise the connection just dropped and the browser retries on its own.
      if (!opened || source.readyState === EventSource.CLOSED) {
        source.close()
        status.value = 'denied'
      }
      else {
        status.value = 'reconnecting'
      }
    }

    onBeforeUnmount(() => source.close())
    return { status, name, encrypted, symbols, getGameKey: () => gameKey }
  }

  return { join, connect }
}
