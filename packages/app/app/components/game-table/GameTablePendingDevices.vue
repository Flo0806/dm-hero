<template>
  <!-- New player devices waiting for the DM. The symbols are also shown on the
       player's screen - if they match, no stranger sits on the line. -->
  <div>
    <div v-for="device in pending" :key="device.publicKey" class="d-flex align-center flex-wrap ga-3 py-2">
      <div class="flex-grow-1">
        <div class="font-weight-medium">
          {{ $t('gameTable.wantsToJoin', { name: playerName(device.playerId) }) }}
        </div>
        <div class="fingerprint">
          {{ device.fingerprint.join(' ') }}
        </div>
      </div>
      <v-btn size="small" variant="text" color="error" :loading="busy === device.publicKey" @click="decide(device, false)">
        {{ $t('gameTable.reject') }}
      </v-btn>
      <v-btn size="small" variant="flat" color="primary" :loading="busy === device.publicKey" @click="decide(device, true)">
        {{ $t('gameTable.approve') }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PendingDevice } from '~~/types/game-table'

defineProps<{ pending: PendingDevice[] }>()

const { t } = useI18n()
const store = useGameTableStore()
const snackbarStore = useSnackbarStore()
const busy = ref<string | null>(null)

const playerName = (id: number) => store.table?.players.find(p => p.id === id)?.name ?? '?'

async function decide(device: PendingDevice, approve: boolean) {
  busy.value = device.publicKey
  try {
    await store.decideDevice(device.playerId, device.publicKey, approve)
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
  finally {
    busy.value = null
  }
}
</script>

<style scoped>
.fingerprint {
  font-size: 1.75rem;
  letter-spacing: 0.15em;
  line-height: 1.3;
}
</style>
