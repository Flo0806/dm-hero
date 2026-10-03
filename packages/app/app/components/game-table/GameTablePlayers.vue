<template>
  <v-card class="pa-6 h-100">
    <div class="d-flex align-center mb-2">
      <h2 class="text-title-large">
        {{ $t('gameTable.players') }}
        <span class="text-medium-emphasis">({{ players.length }})</span>
      </h2>
      <v-spacer />
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-account-plus" @click="openDialog(null)">
        {{ $t('gameTable.addPlayer') }}
      </v-btn>
    </div>

    <p v-if="!players.length" class="text-medium-emphasis mt-4 mb-0">
      {{ $t('gameTable.noPlayers') }}
    </p>
    <v-list v-else bg-color="transparent">
      <GameTablePlayerRow
        v-for="player in players"
        :key="player.id"
        :player="player"
        :online="online.includes(player.id)"
        @edit="openDialog(player)"
        @remove="emit('remove', player)"
        @roll-pin="emit('rollPin', player)"
        @copy-pin="emit('copyPin', player)"
      />
    </v-list>

    <GameTablePlayerDialog v-model:show="dialogOpen" :player="editing" @save="onSave" />
  </v-card>
</template>

<script setup lang="ts">
import type { GameTablePlayer } from '~~/types/game-table'

defineProps<{ players: GameTablePlayer[], online: number[] }>()
const emit = defineEmits<{
  add: [{ name: string, playerEntityId: number | null }]
  update: [GameTablePlayer, { name: string, playerEntityId: number | null }]
  remove: [GameTablePlayer]
  rollPin: [GameTablePlayer]
  copyPin: [GameTablePlayer]
}>()

const dialogOpen = ref(false)
const editing = ref<GameTablePlayer | null>(null)

function openDialog(player: GameTablePlayer | null) {
  editing.value = player
  dialogOpen.value = true
}

function onSave(data: { name: string, playerEntityId: number | null }) {
  if (editing.value) emit('update', editing.value, data)
  else emit('add', data)
  dialogOpen.value = false
}
</script>
