<template>
  <v-card class="pa-8 text-center">
    <v-icon icon="mdi-table-furniture" size="48" color="primary" class="mb-4" />
    <p class="text-body-large text-medium-emphasis mb-6">
      {{ $t('gameTable.startHint') }}
    </p>
    <v-btn color="primary" size="large" prepend-icon="mdi-play" :loading="loading" @click="emit('start')">
      {{ $t('gameTable.start') }}
    </v-btn>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ start: [] }>()
</script>
