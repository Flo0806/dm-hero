<template>
  <v-list-item class="px-0">
    <template #prepend>
      <v-avatar color="primary" variant="tonal" class="me-3">
        <v-img v-if="player.player_entity_image_url" :src="`/uploads/${player.player_entity_image_url}`" :alt="player.name" />
        <span v-else class="text-title-medium">{{ player.name.charAt(0).toUpperCase() }}</span>
      </v-avatar>
    </template>

    <v-list-item-title class="font-weight-medium">
      {{ player.name }}
    </v-list-item-title>
    <v-list-item-subtitle class="d-flex align-center flex-wrap ga-3">
      <GameTableOnlineBadge :online="online" />
      <span v-if="player.player_entity_name">
        <v-icon icon="mdi-link-variant" size="small" /> {{ player.player_entity_name }}
      </span>
    </v-list-item-subtitle>

    <template #append>
      <div class="d-flex align-center ga-1">
        <span class="pin"><span class="d-sr-only">{{ $t('gameTable.pin') }}: </span>{{ player.pin }}</span>
        <v-btn icon="mdi-content-copy" variant="text" size="small" :aria-label="$t('gameTable.copyPin')" @click="emit('copyPin')" />
        <v-btn icon="mdi-dice-multiple" variant="text" size="small" :aria-label="$t('gameTable.rollPin')" @click="emit('rollPin')" />
        <v-menu location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" icon="mdi-dots-vertical" variant="text" size="small" :aria-label="$t('gameTable.playerActions')" />
          </template>
          <v-list density="compact">
            <v-list-item prepend-icon="mdi-pencil" :title="$t('gameTable.editPlayer')" @click="emit('edit')" />
            <v-list-item prepend-icon="mdi-delete" :title="$t('gameTable.removePlayer')" base-color="error" @click="emit('remove')" />
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import type { GameTablePlayer } from '~~/types/game-table'

defineProps<{ player: GameTablePlayer, online?: boolean }>()
const emit = defineEmits<{ edit: [], remove: [], rollPin: [], copyPin: [] }>()
</script>

<style scoped>
.pin {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-inline-end: 4px;
}
</style>
