<template>
  <!-- Own stacking context: the weather (z -1) sits above the page background, below all content -->
  <div class="relative z-1 min-h-dvh flex flex-col font-sans">
    <header class="w-full max-w-6xl mx-auto px-5 pt-8 pb-6 flex items-center gap-4">
      <img src="/logo.png" alt="DM Hero" width="56" height="56" class="size-14 rounded-xl shrink-0" />
      <div class="min-w-0">
        <p v-if="campaignName" class="m-0 mb-0.5 text-sm font-semibold uppercase tracking-wider text-muted truncate">
          {{ campaignName }}
        </p>
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
        <!-- Today's in-game weather - outside the status region, so screen readers don't announce every change -->
        <p v-if="weather" class="m-0 mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
          <span aria-hidden="true">{{ TABLE_WEATHER_ICONS[weather.type] }}</span>
          {{ $t(`play.weather.${weather.type}`) }}<template v-if="weather.temperature !== null"> · {{ weather.temperature }}°</template>
        </p>
      </div>
    </header>

    <!-- Tabs only while the DM shows a map -->
    <div v-if="encrypted && tabs.length > 1" role="tablist" class="w-full max-w-6xl mx-auto px-5 pb-5 flex gap-2" :aria-label="$t('play.tabs.label')">
      <button
        v-for="item in tabs"
        :id="`tab-${item}`"
        :key="item"
        :ref="el => tabRefs[item] = el as HTMLElement"
        type="button"
        role="tab"
        :aria-selected="tab === item"
        :aria-controls="`panel-${item}`"
        :tabindex="tab === item ? 0 : -1"
        class="px-4 py-2.5 rounded-xl border cursor-pointer font-semibold transition focus-ring inline-flex items-center gap-2"
        :class="tab === item ? 'border-primary bg-primary text-bg' : 'border-line bg-surface/85 text-ink hover:border-primary'"
        @click="tab = item"
        @keydown.left.prevent="switchTab(-1)"
        @keydown.right.prevent="switchTab(1)"
      >
        {{ $t(`play.tabs.${item}`) }}
        <span v-if="unseen[item]" class="px-1.5 py-0.5 rounded-md bg-primary text-bg text-xs">{{ $t('play.new') }}</span>
      </button>
    </div>

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

    <main v-else-if="tab === 'messages'" id="panel-messages" role="tabpanel" aria-labelledby="tab-messages" class="flex-1 w-full max-w-3xl mx-auto px-5 pb-12">
      <ChatPanel :messages="messages" :pending="pendingMessages" :on-send="sendMessage" />
    </main>

    <main v-else-if="tab === 'documents' && handouts.length" id="panel-documents" role="tabpanel" aria-labelledby="tab-documents" class="flex-1 w-full max-w-6xl mx-auto px-5 pb-12">
      <HandoutList :handouts="handouts" />
    </main>

    <main v-else-if="tab === 'map' && tableMap" id="panel-map" role="tabpanel" aria-labelledby="tab-map" class="flex-1 w-full max-w-6xl mx-auto px-5 pb-12">
      <TableMap :map="tableMap" :fog="tableFog" :pings="pings" @ping="p => ping(tableMap!.mapId, p.x, p.y)" />
    </main>

    <!-- Second column only while something is open - otherwise the cards get the full width -->
    <main
      v-else
      id="panel-shares"
      :role="tabs.length > 1 ? 'tabpanel' : undefined"
      :aria-labelledby="tabs.length > 1 ? 'tab-shares' : undefined"
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

    <WeatherBackdrop :weather="weather" />

    <RevealBanner :reveal="currentReveal" @show="showRevealed" />

    <!-- Phones: one share at a time, full screen -->
    <ShareDetail v-if="!isDesktop" :share="openShares[0] ?? null" @close="openIds = []" />

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { TABLE_WEATHER_ICONS } from '@dm-hero/seal'

const route = useRoute()
const gameId = String(route.params.gameId)
const { connect } = usePlayerSession()
const { status, name, encrypted, symbols, shares, reveals, tableMap, tableFog, pings, ping, campaignName, handouts, messages, pendingMessages, sendMessage, weather } = connect(gameId)

// Tab title: the campaign, once known
useHead(() => (campaignName.value ? { title: `${campaignName.value} – DM Hero` } : {}))
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

// Shared | messages | documents | map - documents and map only exist while there is something
type Tab = 'shares' | 'messages' | 'documents' | 'map'
const tabs = computed<Tab[]>(() => [
  'shares',
  'messages',
  ...(handouts.value.length ? ['documents' as const] : []),
  ...(tableMap.value ? ['map' as const] : []),
])
const tab = ref<Tab>('shares')
const tabRefs: Partial<Record<Tab, HTMLElement>> = {}
const unseen = reactive<Partial<Record<Tab, boolean>>>({})

function switchTab(direction: number) {
  const list = tabs.value
  const next = list[(list.indexOf(tab.value) + direction + list.length) % list.length]!
  tab.value = next
  tabRefs[next]?.focus()
}

// A tab that disappears sends the player back to the shares
watch(tabs, (list) => {
  if (!list.includes(tab.value)) tab.value = 'shares'
})
// Something new on a tab the player isn't looking at -> "New"
watch(() => tableMap.value?.mapId, (mapId) => {
  if (mapId && tab.value !== 'map') unseen.map = true
})
watch(() => handouts.value.map(h => h.handoutId).join(), (now, before) => {
  const added = now.split(',').some(id => id && !(before ?? '').split(',').includes(id))
  if (added && tab.value !== 'documents') unseen.documents = true
})
// New = the newest DM message changed (a count stays the same once the conversation is full)
watch(() => messages.value.findLast(m => m.from === 'dm')?.id, (now, before) => {
  if (now && now !== before && tab.value !== 'messages') unseen.messages = true
})
watch(tab, (value) => {
  unseen[value] = false
})

// Game over or kicked: back to the start page, which explains what happened
watch(status, (value) => {
  if (value === 'ended') navigateTo({ path: '/', query: { notice: 'ended' } })
  else if (value === 'denied') navigateTo({ path: '/', query: { notice: 'removed' } })
})
</script>
