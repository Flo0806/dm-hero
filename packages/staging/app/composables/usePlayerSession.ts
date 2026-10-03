import {
  derivePairKey, fingerprint, importExchangePublicKey, importVerifyKey, isPingContent, isTableFogContent, isTableMapContent,
  NOTE_MS, open, PING_MS, seal, unwrapGameKey, type Envelope, type TableFogContent, type TableMapContent,
} from '@dm-hero/seal'

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
    /** The map the DM shows (null = none) + its fog of war */
    const tableMap = ref<TableMapContent | null>(null)
    const tableFog = ref<TableFogContent | null>(null)
    const queuedState: Array<{ slot: string, envelope: Envelope }> = []
    /** Pings on the map right now (each disappears after its pulse) */
    const pings = ref<TablePing[]>([])
    let pingCounter = 0
    const stateVersions = new Map<string, { epoch: number, seq: number }>()
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
    // Same checks as shares: from the DM, for everyone, never an older version
    async function setState(slot: string, envelope: Envelope) {
      if (!gameKey || !dmVerifyKey || envelope.header.epoch > keyEpoch) {
        // Only the newest per slot is worth keeping
        const index = queuedState.findIndex(q => q.slot === slot)
        if (index !== -1) queuedState.splice(index, 1)
        queuedState.push({ slot, envelope })
        return
      }
      const { header } = envelope
      if (header.gameId !== gameId || header.from !== 'dm' || header.to !== 'all') return
      const isOlder = (known?: { epoch: number, seq: number }) =>
        !!known && (header.epoch < known.epoch || (header.epoch === known.epoch && header.seq <= known.seq))
      if (isOlder(stateVersions.get(slot))) return
      try {
        const content = await open<unknown>(gameKey, envelope, dmVerifyKey)
        // A newer version may have been applied while we decrypted
        if (isOlder(stateVersions.get(slot))) return
        // Content must match its slot - the relay can't pass the fog off as the map
        if (slot === 'map' && isTableMapContent(content)) tableMap.value = content
        else if (slot === 'fog' && isTableFogContent(content)) tableFog.value = content
        else return
        stateVersions.set(slot, { epoch: header.epoch, seq: header.seq })
      }
      catch (error) {
        console.error('[E2E] Map rejected:', error)
      }
    }

    // DM pings are signed; player pings are labelled by the relay (sender can't fake a name)
    async function receivePing(ping: { from: string, name?: string, envelope: Envelope }) {
      if (!gameKey || !dmVerifyKey) return
      const { header } = ping.envelope
      if (header.gameId !== gameId || header.to !== 'all' || header.epoch !== keyEpoch) return
      if ((ping.from === 'dm') !== (header.from === 'dm')) return
      try {
        const content = await open<unknown>(gameKey, ping.envelope, ping.from === 'dm' ? dmVerifyKey : undefined)
        if (!isPingContent(content)) return
        // Notes only from the DM (signed) - a player's ping is just a spot
        const { text, ...spot } = content
        const entry: TablePing = { ...spot, ...(ping.from === 'dm' && text && { text }), id: ++pingCounter, from: ping.from, name: ping.name ?? '' }
        pings.value = [...pings.value, entry]
        setTimeout(() => pings.value = pings.value.filter(p => p.id !== entry.id), entry.text ? NOTE_MS : PING_MS)
      }
      catch (error) {
        console.error('[E2E] Ping rejected:', error)
      }
    }

    /** Ping a spot on the shown map - everyone sees it (including us, via the relay) */
    async function ping(mapId: number, x: number, y: number) {
      if (!gameKey) return
      const envelope = await seal(gameKey, { v: 1, gameId, from: 'player', to: 'all', epoch: keyEpoch, seq: Date.now() }, { mapId, x, y })
      await $fetch(`/api/v1/games/${gameId}/pings`, { method: 'POST', body: envelope })
        .catch(error => console.error('[Ping] Failed:', error))
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
        for (const state of queuedState.splice(0)) await setState(state.slot, state.envelope)
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

    // Shown map / fog: null = the DM stopped showing it
    source.addEventListener('state', (event) => {
      const { slot, envelope } = JSON.parse((event as MessageEvent).data) as { slot: string, envelope: Envelope | null }
      // Versions are kept: an old envelope replayed later stays rejected
      if (envelope) return void setState(slot, envelope)
      // Withdrawn while we were waiting for the key - it must not come back
      for (let i = queuedState.length - 1; i >= 0; i--) {
        if (queuedState[i]!.slot === slot) queuedState.splice(i, 1)
      }
      if (slot === 'map') tableMap.value = null
      else if (slot === 'fog') tableFog.value = null
    })

    source.addEventListener('ping', (event) => {
      void receivePing(JSON.parse((event as MessageEvent).data) as { from: string, name?: string, envelope: Envelope })
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
    return { status, name, encrypted, symbols, shares, reveals, tableMap, tableFog, pings, ping }
  }

  return { join, connect }
}
