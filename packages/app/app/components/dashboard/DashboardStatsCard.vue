<template>
  <v-card class="dashboard-card h-100" variant="outlined">
    <v-card-text class="pa-4">
      <div class="d-flex align-center mb-3">
        <v-icon icon="mdi-chart-timeline-variant" color="primary" size="24" class="mr-2" />
        <span class="text-subtitle-1 font-weight-medium">{{ $t('dashboard.stats.title') }}</span>
      </div>

      <div class="stats-grid">
        <!-- Playtime -->
        <div class="stat-item d-flex align-center ga-3 pa-3 rounded-lg">
          <v-icon icon="mdi-clock-outline" size="20" color="primary" style="opacity: 0.8" />
          <div class="flex-grow-1">
            <div class="text-h6 font-weight-bold">{{ formattedPlaytime }}</div>
            <div class="stat-label text-caption text-medium-emphasis text-uppercase">{{ $t('dashboard.stats.playtime') }}</div>
          </div>
        </div>

        <!-- Sessions -->
        <div class="stat-item d-flex align-center ga-3 pa-3 rounded-lg">
          <v-icon icon="mdi-book-open-page-variant" size="20" color="primary" style="opacity: 0.8" />
          <div class="flex-grow-1">
            <div class="text-h6 font-weight-bold">{{ sessionCount }}</div>
            <div class="stat-label text-caption text-medium-emphasis text-uppercase">{{ $t('dashboard.stats.sessions') }}</div>
          </div>
        </div>

        <!-- Total Entities -->
        <div class="stat-item d-flex align-center ga-3 pa-3 rounded-lg">
          <v-icon icon="mdi-database" size="20" color="primary" style="opacity: 0.8" />
          <div class="flex-grow-1">
            <div class="text-h6 font-weight-bold">{{ totalEntities }}</div>
            <div class="stat-label text-caption text-medium-emphasis text-uppercase">{{ $t('dashboard.stats.entities') }}</div>
          </div>
        </div>

        <!-- Pinned -->
        <div class="stat-item d-flex align-center ga-3 pa-3 rounded-lg">
          <v-icon icon="mdi-pin" size="20" color="primary" style="opacity: 0.8" />
          <div class="flex-grow-1">
            <div class="text-h6 font-weight-bold">{{ pinnedCount }}</div>
            <div class="stat-label text-caption text-medium-emphasis text-uppercase">{{ $t('dashboard.stats.pinned') }}</div>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
const props = defineProps<{
  totalPlaytimeMinutes: number
  sessionCount: number
  totalEntities: number
  pinnedCount: number
}>()

const { formatPlaytime } = usePlaytime()

const formattedPlaytime = computed(() => formatPlaytime(props.totalPlaytimeMinutes))
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  background: rgba(var(--v-theme-surface), 0.5);
}

.stat-label {
  letter-spacing: 0.5px;
}
</style>
