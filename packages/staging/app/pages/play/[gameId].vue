<template>
  <div class="min-h-dvh flex flex-col font-sans">
    <header class="w-full max-w-6xl mx-auto px-5 pt-8 pb-6 flex items-center gap-4">
      <img src="/logo.png" alt="DM Hero" width="56" height="56" class="size-14 rounded-xl shrink-0" />
      <div class="min-w-0">
        <h1 class="m-0 text-[clamp(1.4rem,4vw,2rem)] font-extrabold text-primary truncate">
          {{ name ? $t('play.welcome', { name }) : $t('play.connecting') }}
        </h1>
        <p role="status" class="m-0 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span class="inline-flex items-center gap-2">
            <span class="size-2.5 rounded-full" :class="status === 'live' ? 'bg-success' : 'bg-primary animate-pulse motion-reduce:animate-none'" aria-hidden="true" />
            {{ status === 'live' ? $t('play.connected') : $t('play.reconnecting') }}
          </span>
          <span v-if="encrypted" class="inline-flex items-center gap-1.5 text-success">
            <span aria-hidden="true">🔒</span> {{ $t('play.encrypted') }}
          </span>
        </p>
      </div>
    </header>

    <!-- Waiting for the DM to approve this device: show the symbols to compare -->
    <main v-if="!encrypted" class="flex-1 flex justify-center px-5 py-6">
      <div role="status" class="h-fit px-5 py-4 rounded-xl border border-line bg-surface/85 max-w-105 text-center">
        <p class="m-0 font-semibold">
          {{ $t('play.waitingApproval') }}
        </p>
        <p class="mt-1 mb-2 text-sm text-muted">
          {{ $t('play.compareSymbols') }}
        </p>
        <p class="m-0 text-4xl tracking-widest">
          {{ symbols.join(' ') }}
        </p>
      </div>
    </main>

    <!-- Second column only while something is open - otherwise the cards get the full width -->
    <main
      v-else
      class="flex-1 w-full max-w-6xl mx-auto px-5 pb-12"
      :class="{ 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-8': isDesktop && openShares.length }"
    >
      <div>
        <template v-if="shares.length">
          <label for="share-search" class="sr-only">{{ $t('play.search') }}</label>
          <input
            id="share-search"
            v-model="search"
            type="search"
            :placeholder="$t('play.search')"
            class="w-full mb-6 px-4 py-3 rounded-xl border border-line bg-surface/85 text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/25"
          />
          <ShareSections :shares="filtered" :open-ids="openIds" :revealed-ids="revealedIds" :is-new="isNew" @open="open" />
          <p v-if="!filtered.length" class="m-0 text-muted">
            {{ $t('play.noResults') }}
          </p>
        </template>
        <p v-else class="m-0 text-muted">
          {{ $t('play.waiting') }}
        </p>
      </div>

      <!-- Desktop: opened shares stacked on the right -->
      <aside v-if="isDesktop && openShares.length" class="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto" :aria-label="$t('play.opened')">
        <ShareDetailPanel v-for="share in openShares" :key="share.shareId" :share="share" @close="close(share.shareId)" />
      </aside>
    </main>

    <RevealBanner :reveal="currentReveal" @show="showRevealed" />

    <!-- Phones: one share at a time, full screen -->
    <ShareDetail v-if="!isDesktop" :share="openShares[0] ?? null" @close="openIds = []" />

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const gameId = String(route.params.gameId)
const { connect } = usePlayerSession()
const { status, name, encrypted, symbols, shares, reveals } = connect(gameId)
const { isNew, markSeen } = useSeenShares(gameId)

const search = ref('')
const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return term ? shares.value.filter(s => s.title.toLowerCase().includes(term)) : shares.value
})

// Desktop shows several opened shares side by side, phones one at a time
const isDesktop = ref(false)
onMounted(() => {
  const query = window.matchMedia('(min-width: 1024px)')
  isDesktop.value = query.matches
  query.addEventListener('change', e => isDesktop.value = e.matches)
})

const openIds = ref<string[]>([])
// Live: opened shares follow edits; withdrawn ones disappear
const openShares = computed(() => openIds.value.map(id => shares.value.find(s => s.shareId === id)).filter(s => !!s))

// Desktop: click toggles (open -> on top, open again -> closed). Phones: always open full screen.
function open(share: ShareContent) {
  if (isDesktop.value && openIds.value.includes(share.shareId)) return close(share.shareId)
  markSeen(share)
  openIds.value = isDesktop.value ? [share.shareId, ...openIds.value] : [share.shareId]
}

const close = (id: string) => openIds.value = openIds.value.filter(openId => openId !== id)

// Opened shares that get updated count as seen
watch(openShares, list => list.forEach(markSeen))

// Reveal moments: banner one after another, the card glows meanwhile
const REVEAL_MS = 6000
const currentReveal = ref<Reveal | null>(null)
const revealedIds = ref<string[]>([])

function nextReveal() {
  if (currentReveal.value || !reveals.value.length) return
  const reveal = reveals.value.shift()!
  currentReveal.value = reveal
  revealedIds.value = [...revealedIds.value, reveal.shareId]
  setTimeout(() => {
    revealedIds.value = revealedIds.value.filter(id => id !== reveal.shareId)
    currentReveal.value = null
    nextReveal()
  }, REVEAL_MS)
}
watch(() => reveals.value.length, nextReveal)

function showRevealed(shareId: string) {
  const share = shares.value.find(s => s.shareId === shareId)
  if (share && !openIds.value.includes(shareId)) open(share)
}

// Game over or kicked: back to the start page, which explains what happened
watch(status, (value) => {
  if (value === 'ended') navigateTo({ path: '/', query: { notice: 'ended' } })
  else if (value === 'denied') navigateTo({ path: '/', query: { notice: 'removed' } })
})
</script>
