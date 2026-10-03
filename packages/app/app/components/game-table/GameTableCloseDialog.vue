<template>
  <v-dialog :model-value="show" max-width="460" @update:model-value="emit('update:show', $event)">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-alert" color="warning" />
        {{ $t('gameTable.closeTitle') }}
      </v-card-title>
      <v-card-text>
        {{ $t('gameTable.closeWarning') }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:show', false)">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="error" variant="flat" :loading="loading" @click="emit('confirm')">
          {{ $t('gameTable.closeConfirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
defineProps<{ show: boolean, loading?: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean], 'confirm': [] }>()
</script>
