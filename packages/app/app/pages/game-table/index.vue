<template>
  <div>
    <GameTableIntro />

    <template v-if="loaded">
      <GameTableStart v-if="!store.table" :loading="busy" @start="run(() => store.start(campaignId!))" />

      <template v-else>
        <v-row>
          <v-col cols="12" md="5">
            <GameTableJoinCard :code="store.table.code" @close="closeDialog = true" />
          </v-col>
          <v-col cols="12" md="7">
            <GameTablePlayers
              :players="store.table.players"
              @add="data => run(() => store.addPlayer(data.name, data.playerEntityId))"
              @update="(player, data) => run(() => store.updatePlayer(player.id, data))"
              @remove="player => run(() => store.removePlayer(player.id))"
              @roll-pin="player => run(() => store.rollPin(player.id), t('gameTable.pinRolled'))"
              @copy-pin="player => copy(player.pin)"
            />
          </v-col>
        </v-row>

        <GameTableSharing />
      </template>
    </template>

    <GameTableCloseDialog v-model:show="closeDialog" :loading="busy" @confirm="closeGame" />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const store = useGameTableStore()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const snackbarStore = useSnackbarStore()

const campaignId = computed(() => campaignStore.activeCampaignIdNumber)
const loaded = ref(false)
const busy = ref(false)
const closeDialog = ref(false)

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

async function closeGame() {
  await run(() => store.close())
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
