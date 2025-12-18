<template>
  <v-card :to="to" hover class="category-card h-100" variant="outlined">
    <v-card-text class="pa-4">
      <div class="d-flex align-center mb-3">
        <v-avatar :color="color" size="40" class="mr-3">
          <v-icon :icon="icon" size="22" color="white" />
        </v-avatar>
        <div class="flex-grow-1">
          <div class="text-subtitle-1 font-weight-medium">{{ title }}</div>
          <div class="text-caption text-medium-emphasis">{{ count }} {{ $t('dashboard.category.entries') }}</div>
        </div>
        <v-icon icon="mdi-chevron-right" size="20" class="text-medium-emphasis" />
      </div>

      <p class="text-body-2 text-medium-emphasis mb-3">
        {{ description }}
      </p>

      <!-- Pinned badge -->
      <v-chip
        v-if="pinnedCount > 0"
        size="small"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-pin"
        class="pinned-badge"
      >
        {{ pinnedCount }} {{ $t('dashboard.category.pinned') }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  icon: string
  color: string
  to: string
  count: number
  pinnedCount: number
}>()
</script>

<style scoped>
.category-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-color: rgba(var(--v-theme-outline), 0.15);
  transition: all 0.2s ease;
}

.category-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.pinned-badge {
  margin-top: auto;
}
</style>
