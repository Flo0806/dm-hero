<template>
  <v-dialog :model-value="show" max-width="460" @update:model-value="emit('update:show', $event)">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-alert" color="warning" />
        {{ restart ? $t('gameTable.restartTitle') : $t('gameTable.closeTitle') }}
      </v-card-title>
      <v-card-text>
        {{ restart ? $t('gameTable.restartWarning') : $t('gameTable.closeWarning') }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:show', false)">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="error" variant="flat" :loading="loading" @click="emit('confirm')">
          {{ restart ? $t('gameTable.restartConfirm') : $t('gameTable.closeConfirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
// restart: "start a new game" (replaces the current one) instead of "end the game"
defineProps<{ show: boolean, loading?: boolean, restart?: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean], 'confirm': [] }>()
</script>
