<template>
  <div>
    <GameTableIntro />

    <template v-if="loaded">
      <GameTableStart v-if="!store.table" :loading="busy" @start="startGame" />

      <template v-else>
        <!-- Unknown on the player server (expired / other server): register again, nothing is deleted -->
        <v-alert v-if="presence.expired" type="warning" variant="tonal" class="mb-6" :title="$t('gameTable.expired')">
          <p class="mb-3">
            {{ $t('gameTable.expiredHint') }}
          </p>
          <v-btn color="primary" prepend-icon="mdi-restart" :loading="busy" @click="run(() => store.reconnect())">
            {{ $t('gameTable.expiredRestart') }}
          </v-btn>
        </v-alert>

        <v-card v-if="presence.pending.length" class="pa-6 mb-6" color="primary" variant="tonal">
          <h2 class="text-title-large mb-1">
            {{ $t('gameTable.pendingTitle') }}
          </h2>
          <p class="text-body-medium mb-2">
            {{ $t('gameTable.pendingHint') }}
          </p>
          <GameTablePendingDevices :pending="presence.pending" />
        </v-card>

        <!-- Where the players go - new in this release, so it stands out -->
        <v-alert type="info" variant="tonal" density="compact" icon="mdi-cellphone-link" class="mb-4">
          <div class="d-flex align-center flex-wrap ga-2">
            <i18n-t keypath="gameTable.playerApp.hint" tag="span">
              <template #link>
                <a :href="stagingUrl" target="_blank" rel="noopener" class="font-weight-bold" @click="markSeen('playerApp')">{{ stagingHost }}</a>
              </template>
            </i18n-t>
            <v-chip v-if="isNew('playerApp')" size="x-small" color="primary" variant="flat">
              {{ $t('common.new') }}
            </v-chip>
          </div>
        </v-alert>

        <!-- Table (join + players) | Shared (everything that went out, with "take back") -->
        <v-tabs v-model="tab" color="primary" class="mb-6">
          <v-tab value="table" prepend-icon="mdi-table-furniture">
            {{ $t('gameTable.tabs.table') }}
          </v-tab>
          <v-tab value="messages" prepend-icon="mdi-email-outline">
            {{ $t('gameTable.tabs.messages') }}
            <v-chip v-if="store.unreadTotal" size="x-small" color="primary" class="ms-2">
              {{ store.unreadTotal }}
            </v-chip>
          </v-tab>
          <v-tab value="shared" prepend-icon="mdi-share-variant">
            {{ $t('gameTable.tabs.shared') }}
            <v-chip v-if="sharedCount" size="x-small" class="ms-2">
              {{ sharedCount }}
            </v-chip>
          </v-tab>
        </v-tabs>

        <v-row v-if="tab === 'table'">
          <v-col cols="12" md="5">
            <GameTableJoinCard
              :code="store.table.code"
              :connected="presence.connected"
              @close="openDialog(false)"
              @restart="openDialog(true)"
            />
          </v-col>
          <v-col cols="12" md="7">
            <GameTablePlayers
              :players="store.table.players"
              :online="presence.online"
              @add="data => run(() => store.addPlayer(data.name, data.playerEntityId))"
              @update="(player, data) => run(() => store.updatePlayer(player.id, data))"
              @remove="player => run(() => store.removePlayer(player.id))"
              @roll-pin="player => run(() => store.rollPin(player.id), t('gameTable.pinRolled'))"
              @copy-pin="player => copy(player.pin)"
            />
          </v-col>
        </v-row>

        <GameTableMessages v-else-if="tab === 'messages'" :focus="focusPlayer" />

        <template v-else>
          <GameTableSharing class="mt-0" />
          <GameTableHandouts />
        </template>
      </template>
    </template>

    <GameTableCloseDialog v-model:show="closeDialog" :restart="restartMode" :loading="busy" @confirm="confirmDialog" />
  </div>
</template>

<script setup lang="ts">
import type { GameTablePresence } from '~~/types/game-table'

const { t } = useI18n()
const store = useGameTableStore()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const snackbarStore = useSnackbarStore()

const campaignId = computed(() => campaignStore.activeCampaignIdNumber)
const loaded = ref(false)
const busy = ref(false)
const closeDialog = ref(false)
const tab = ref<'table' | 'messages' | 'shared'>('table')

// New in this release: the game table (nav badge goes once visited) and the player app link
const { isNew, markSeen } = useNewBadges()
onMounted(() => markSeen('gameTable'))
const { stagingUrl } = useRuntimeConfig().public
const stagingHost = computed(() => stagingUrl.replace(/^https?:\/\//, ''))

// Jump in from the header chip: /game-table?tab=messages&player=12
const route = useRoute()
// A new object per jump - selects the player again even if it's the same one
const focusPlayer = ref<{ playerId: number } | null>(null)
watch(() => [route.query.tab, route.query.player, route.query.at], ([queryTab, player]) => {
  if (queryTab === 'messages') tab.value = 'messages'
  if (player) focusPlayer.value = { playerId: Number(player) }
}, { immediate: true })
const sharedCount = computed(() => store.shares.length + store.handouts.length)
const restartMode = ref(false)

// Live online status, only while the page runs in the browser
const presence = import.meta.client
  ? useGameTablePresence(() => store.table?.id ?? null)
  : ref<GameTablePresence>({ connected: false, online: [], pending: [] })

// Every action: busy flag + snackbar on success/failure (no alert())
async function run(action: () => Promise<unknown>, successMessage?: string) {
  busy.value = true
  try {
    await action()
    if (successMessage) snackbarStore.success(successMessage)
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
  finally {
    busy.value = false
  }
}

async function copy(value: string) {
  await navigator.clipboard.writeText(value)
  snackbarStore.success(t('gameTable.copied'))
}

async function startGame() {
  busy.value = true
  try {
    await store.start(campaignId.value!)
  }
  catch (e) {
    // 502 = player server (relay) not reachable
    snackbarStore.error((e as { statusCode?: number }).statusCode === 502 ? t('gameTable.relayUnreachable') : t('gameTable.error'))
  }
  finally {
    busy.value = false
  }
}

function openDialog(restart: boolean) {
  restartMode.value = restart
  closeDialog.value = true
}

// End the game, or replace it with a new one (the server ends the old one first)
async function confirmDialog() {
  if (restartMode.value) await startGame()
  else await run(() => store.close())
  closeDialog.value = false
}

// Client only - see SSR notes in CLAUDE.md
if (import.meta.client) {
  watch(campaignId, async (id) => {
    if (!id) return
    loaded.value = false
    await run(() => Promise.all([store.load(id), entitiesStore.fetchPlayers(id)]))
    loaded.value = true
  }, { immediate: true })
}
</script>
