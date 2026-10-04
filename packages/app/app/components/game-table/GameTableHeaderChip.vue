<template>
  <!-- Always in the app bar: keeps the active campaign's game connected (anywhere in the app)
       and shows the essentials. Invisible if the campaign has no game. -->
  <v-menu v-if="store.table" v-model="menuOpen" location="bottom end" :close-on-content-click="false">
    <template #activator="{ props: menuProps }">
      <v-chip v-bind="menuProps" :variant="highlight ? 'flat' : 'tonal'" :color="chipColor" class="mr-2">
        <v-icon start :icon="chipIcon" />
        <template v-if="presence.pending.length">
          {{ $t('gameTable.pendingCount', { count: presence.pending.length }) }}
        </template>
        <!-- Unread private messages: clearly visible from anywhere in the app -->
        <template v-else-if="store.unreadTotal">
          {{ $t('gameTable.messages.newCount', store.unreadTotal) }}
        </template>
        <template v-else>
          {{ presence.expired ? $t('gameTable.expired') : presence.connected ? $t('gameTable.onlineCount', { count: onlinePlayers.length }) : $t('gameTable.relayOffline') }}
        </template>
      </v-chip>
    </template>

    <v-card min-width="300" class="pa-4">
      <!-- Who wrote - one click opens that conversation -->
      <template v-if="unreadPlayers.length">
        <div class="text-overline text-primary">
          {{ $t('gameTable.messages.newTitle') }}
        </div>
        <v-list density="compact" class="pa-0 mb-2" bg-color="transparent">
          <v-list-item
            v-for="player in unreadPlayers"
            :key="player.id"
            prepend-icon="mdi-email"
            :title="player.name"
            @click="openConversation(player.id)"
          >
            <template #append>
              <v-badge :content="store.unreadOf(player.id)" color="primary" inline />
            </template>
          </v-list-item>
        </v-list>
        <v-divider class="mb-3" />
      </template>

      <template v-if="presence.pending.length">
        <div class="text-overline text-primary">
          {{ $t('gameTable.pendingTitle') }}
        </div>
        <GameTablePendingDevices :pending="presence.pending" class="mb-2" />
        <v-divider class="mb-3" />
      </template>

      <div class="text-overline text-medium-emphasis">
        {{ $t('gameTable.code') }}
      </div>
      <div class="d-flex align-center ga-1 mb-3">
        <span class="header-code">{{ store.table.code }}</span>
        <v-btn icon="mdi-content-copy" variant="text" size="small" :aria-label="$t('gameTable.copyCode')" @click="copyCode" />
      </div>

      <div class="text-overline text-medium-emphasis">
        {{ $t('gameTable.players') }}
      </div>
      <p v-if="!store.table.players.length" class="text-body-small text-medium-emphasis mb-2">
        {{ $t('gameTable.noPlayersShort') }}
      </p>
      <div v-for="player in store.table.players" :key="player.id" class="d-flex align-center justify-space-between py-1">
        <span>{{ player.name }}</span>
        <GameTableOnlineBadge :online="presence.online.includes(player.id)" />
      </div>

      <v-btn block variant="tonal" color="primary" class="mt-3" to="/game-table" prepend-icon="mdi-arrow-right">
        {{ $t('gameTable.openTable') }}
      </v-btn>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import type { GameTablePresence } from '~~/types/game-table'

const { t } = useI18n()
const store = useGameTableStore()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

// Connection follows the active campaign: no campaign -> no game -> nothing connected
if (import.meta.client) {
  watch(() => campaignStore.activeCampaignIdNumber, (id) => {
    if (id) store.load(id).catch(() => {})
    else store.table = null
  }, { immediate: true })
}

const presence = import.meta.client
  ? useGameTablePresence(() => store.table?.id ?? null)
  : ref<GameTablePresence>({ connected: false, online: [], pending: [] })

// Waiting devices win, then new messages: the DM should notice both from anywhere in the app
const highlight = computed(() => presence.value.pending.length > 0 || store.unreadTotal > 0)
const chipColor = computed(() => presence.value.expired
  ? 'error'
  : highlight.value ? 'primary' : presence.value.connected ? 'success' : 'warning')
const chipIcon = computed(() => presence.value.expired
  ? 'mdi-timer-sand-complete'
  : presence.value.pending.length
    ? 'mdi-account-question'
    : store.unreadTotal ? 'mdi-email' : presence.value.connected ? 'mdi-table-furniture' : 'mdi-cloud-off-outline')

const unreadPlayers = computed(() => store.table?.players.filter(p => store.unreadOf(p.id)) ?? [])
const menuOpen = ref(false)
function openConversation(playerId: number) {
  menuOpen.value = false
  // at: a new URL every click - jumping works even if the same link was used before
  navigateTo({ path: '/game-table', query: { tab: 'messages', player: String(playerId), at: String(Date.now()) } })
}

// A player wrote: refresh the messages (unread count here, conversation on the game table page)
useTableMessageEvents(() => store.table?.id, () => {
  store.loadMessages().catch(() => {})
})

const onlinePlayers = computed(() => store.table?.players.filter(p => presence.value.online.includes(p.id)) ?? [])

async function copyCode() {
  if (!store.table) return
  await navigator.clipboard.writeText(store.table.code)
  snackbarStore.success(t('gameTable.copied'))
}
</script>

<style scoped>
.header-code {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgb(var(--v-theme-primary));
}
</style>
