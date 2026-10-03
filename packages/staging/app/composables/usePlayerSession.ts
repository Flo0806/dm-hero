import { derivePairKey, fingerprint, importExchangePublicKey, importVerifyKey, open, unwrapGameKey, type Envelope } from '@dm-hero/seal'

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
    let dmVerifyKey: CryptoKey | null = null
    /** Generation of the game key we hold - after a rotation newer shares wait for the new key */
    let keyEpoch = 0
    /** Everything the DM shares, newest first */
    const shares = ref<ShareContent[]>([])
    // Shares can arrive before the game key - they wait here
    const queued: Array<{ id: string, envelope: Envelope }> = []
    // Newest version per share (epoch, seq) - the relay must not replay an older one (e.g. undo a reveal)
    const versions = new Map<string, { epoch: number, seq: number }>()
    /** Live reveals (not the initial load - that's just the current state) */
    const reveals = ref<Reveal[]>([])
    let live = false

    function detectReveal(before: ShareContent | undefined, after: ShareContent) {
      if (!live) return
      if (!before) return reveals.value.push({ shareId: after.shareId, kind: 'new', title: after.title })
      if (before.title !== after.title) {
        return reveals.value.push({ shareId: after.shareId, kind: 'name', title: after.title, previousTitle: before.title })
      }
      const known = new Set(before.fields.map(f => f.key))
      const added = after.fields.filter(f => !known.has(f.key))
      if (added.length) reveals.value.push({ shareId: after.shareId, kind: 'info', title: after.title, newFields: added.map(f => f.label) })
    }

    async function addShare(id: string, envelope: Envelope) {
      if (!gameKey || !dmVerifyKey || envelope.header.epoch > keyEpoch) {
        queued.push({ id, envelope })
        return
      }
      const { header } = envelope
      if (header.gameId !== gameId || header.from !== 'dm' || header.to !== 'all') return
      const known = versions.get(id)
      if (known && (header.epoch < known.epoch || (header.epoch === known.epoch && header.seq <= known.seq))) return
      try {
        const content = await open<ShareContent>(gameKey, envelope, dmVerifyKey)
        // The relay must not be able to swap shares
        if (content.shareId !== id) return
        versions.set(id, { epoch: header.epoch, seq: header.seq })
        detectReveal(shares.value.find(s => s.shareId === id), content)
        shares.value = [content, ...shares.value.filter(s => s.shareId !== id)]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      }
      catch (error) {
        console.error('[E2E] Share rejected:', error)
      }
    }
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
        // Never go back to an older key (replayed key package)
        if (envelope.header.epoch < keyEpoch) return
        dmVerifyKey = await importVerifyKey(dm.signing)
        gameKey = await unwrapGameKey(envelope, pairKey, dmVerifyKey)
        keyEpoch = envelope.header.epoch
        encrypted.value = true
        for (const share of queued.splice(0)) await addShare(share.id, share.envelope)
        // Everything up to here was the current state - from now on changes are live moments
        setTimeout(() => live = true, 1500)
      }
      catch (error) {
        // Wrong key or not signed by the DM - never trust it
        console.error('[E2E] Game key rejected:', error)
      }
    })

    source.addEventListener('share', (event) => {
      const { id, envelope } = JSON.parse((event as MessageEvent).data) as { id: string, envelope: Envelope }
      void addShare(id, envelope)
    })
    source.addEventListener('unshare', (event) => {
      const { id } = JSON.parse((event as MessageEvent).data) as { id: string }
      shares.value = shares.value.filter(s => s.shareId !== id)
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
    return { status, name, encrypted, symbols, shares, reveals }
  }

  return { join, connect }
}
