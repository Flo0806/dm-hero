import {
  derivePairKey, fingerprint, importExchangePublicKey, importVerifyKey, isChatThreadContent, isHandoutContent, isPingContent, isTableFogContent, isTableInfoContent, isTableMapContent,
  NOTE_MS, open, PING_MS, seal, unwrapGameKey, type ChatMessage, type Envelope, type HandoutContent, type TableFogContent, type TableMapContent,
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
    /** Documents the DM handed to this player - sealed for this device only */
    const handouts = ref<HandoutContent[]>([])
    const queuedHandouts: Array<{ id: string, envelope: Envelope }> = []
    const handoutVersions = new Map<string, number>()
    let pairKey: CryptoKey | null = null
    let playerId = ''
    /** The DM's campaign (sent encrypted like everything else) */
    const campaignName = ref('')
    /** Private conversation with the DM (newest last) + own messages not yet confirmed by DM Hero */
    const messages = ref<ChatMessage[]>([])
    const pendingMessages = ref<ChatMessage[]>([])
    // Own messages DM Hero hasn't confirmed yet survive a reload (DM Hero may be offline)
    const pendingKey = `dm-hero-pending-messages-${gameId}`
    function savePending() {
      try {
        localStorage.setItem(pendingKey, JSON.stringify(pendingMessages.value))
      }
      catch {
        // Storage blocked - they're just not kept over a reload
      }
    }
    onMounted(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(pendingKey) ?? '[]') as ChatMessage[]
        if (Array.isArray(saved)) pendingMessages.value = saved.filter(m => typeof m?.id === 'string' && typeof m.text === 'string')
      }
      catch {
        // Nothing saved or unreadable
      }
    })
    let queuedThread: Envelope | null = null
    let threadSeq = 0
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
        else if (slot === 'info' && isTableInfoContent(content)) campaignName.value = content.campaignName
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

    // Handouts: DM-signed, sealed with this device's pair key, addressed to this player
    async function addHandout(id: string, envelope: Envelope) {
      if (!pairKey || !dmVerifyKey || !playerId) {
        queuedHandouts.push({ id, envelope })
        return
      }
      const { header } = envelope
      if (header.gameId !== gameId || header.from !== 'dm' || header.to !== playerId) return
      if ((handoutVersions.get(id) ?? 0) >= header.seq) return
      try {
        const content = await open<unknown>(pairKey, envelope, dmVerifyKey)
        if (!isHandoutContent(content) || content.handoutId !== id) return
        if ((handoutVersions.get(id) ?? 0) >= header.seq) return
        handoutVersions.set(id, header.seq)
        handouts.value = [content, ...handouts.value.filter(h => h.handoutId !== id)]
          .sort((a, b) => b.sharedAt.localeCompare(a.sharedAt))
      }
      catch (error) {
        console.error('[E2E] Handout rejected:', error)
      }
    }

    // The conversation: DM-signed, sealed for this device, addressed to this player
    async function setThread(envelope: Envelope) {
      if (!pairKey || !dmVerifyKey || !playerId) {
        queuedThread = envelope
        return
      }
      const { header } = envelope
      if (header.gameId !== gameId || header.from !== 'dm' || header.to !== playerId || header.seq <= threadSeq) return
      try {
        const content = await open<unknown>(pairKey, envelope, dmVerifyKey)
        if (!isChatThreadContent(content) || header.seq <= threadSeq) return
        threadSeq = header.seq
        messages.value = content.messages
        // Confirmed by DM Hero -> no longer "on its way"
        const known = new Set(content.messages.map(m => m.id))
        pendingMessages.value = pendingMessages.value.filter(m => !known.has(`p-${playerId}-${m.id}`))
        savePending()
      }
      catch (error) {
        console.error('[E2E] Conversation rejected:', error)
      }
    }

    /** Write to the DM - only DM Hero can read it (sealed with this device's pair key) */
    async function sendMessage(text: string) {
      if (!pairKey || !gameKey) return false
      const id = crypto.randomUUID()
      const envelope = await seal(pairKey, { v: 1, gameId, from: 'player', to: 'dm', epoch: keyEpoch, seq: Date.now() }, { kind: 'chat', id, text })
      await $fetch(`/api/v1/games/${gameId}/messages`, { method: 'POST', body: envelope })
      pendingMessages.value = [...pendingMessages.value, { id, from: 'player', text, sentAt: new Date().toISOString() }]
      savePending()
      return true
    }

    let opened = false
    const source = new EventSource(`/api/v1/games/${gameId}/events`)

    source.addEventListener('ready', (event) => {
      opened = true
      status.value = 'live'
      const ready = JSON.parse((event as MessageEvent).data) as { name: string, playerId?: string }
      name.value = ready.name
      playerId = ready.playerId ?? ''
    })

    // DM Hero wrapped the game key for a device - only ours can open it
    source.addEventListener('game-key', async (event) => {
      const { publicKey, envelope } = JSON.parse((event as MessageEvent).data) as { publicKey: string, envelope: Envelope }
      const [device, dm] = await Promise.all([getDeviceKey(), loadDmPublicKeys(gameId)])
      if (!dm || device.publicKey !== publicKey) return
      try {
        pairKey = await derivePairKey(device.keyPair.privateKey, await importExchangePublicKey(dm.exchange), gameId)
        // Never go back to an older key (replayed key package)
        if (envelope.header.epoch < keyEpoch) return
        dmVerifyKey = await importVerifyKey(dm.signing)
        gameKey = await unwrapGameKey(envelope, pairKey, dmVerifyKey)
        keyEpoch = envelope.header.epoch
        encrypted.value = true
        for (const share of queued.splice(0)) await addShare(share.id, share.envelope)
        for (const state of queuedState.splice(0)) await setState(state.slot, state.envelope)
        for (const handout of queuedHandouts.splice(0)) await addHandout(handout.id, handout.envelope)
        if (queuedThread) {
          const thread = queuedThread
          queuedThread = null
          await setThread(thread)
        }
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

    source.addEventListener('thread', (event) => {
      void setThread((JSON.parse((event as MessageEvent).data) as { envelope: Envelope }).envelope)
    })

    source.addEventListener('handout', (event) => {
      const { id, envelope } = JSON.parse((event as MessageEvent).data) as { id: string, envelope: Envelope }
      void addHandout(id, envelope)
    })
    // Taken back - versions stay, a replayed old envelope stays rejected
    source.addEventListener('unhandout', (event) => {
      const { id } = JSON.parse((event as MessageEvent).data) as { id: string }
      for (let i = queuedHandouts.length - 1; i >= 0; i--) {
        if (queuedHandouts[i]!.id === id) queuedHandouts.splice(i, 1)
      }
      handouts.value = handouts.value.filter(h => h.handoutId !== id)
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
    return { status, name, encrypted, symbols, shares, reveals, tableMap, tableFog, pings, ping, campaignName, handouts, messages, pendingMessages, sendMessage }
  }

  return { join, connect }
}
