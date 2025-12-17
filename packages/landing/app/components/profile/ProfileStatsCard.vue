<template>
  <v-card elevation="0" class="profile-card">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-chart-bar" class="mr-2" />
      {{ $t('profile.stats.title') }}
    </v-card-title>

    <v-card-text>
      <v-row>
        <v-col cols="6" sm="3">
          <div class="stat-box">
            <v-icon icon="mdi-book-open-variant" size="32" color="primary" class="mb-2" />
            <div class="stat-value">{{ stats.totalAdventures }}</div>
            <div class="stat-label">{{ $t('profile.stats.adventures') }}</div>
          </div>
        </v-col>

        <v-col cols="6" sm="3">
          <div class="stat-box">
            <v-icon icon="mdi-download" size="32" color="success" class="mb-2" />
            <div class="stat-value">{{ stats.totalDownloads }}</div>
            <div class="stat-label">{{ $t('profile.stats.downloads') }}</div>
          </div>
        </v-col>

        <v-col cols="6" sm="3">
          <div class="stat-box">
            <v-icon icon="mdi-star" size="32" color="amber" class="mb-2" />
            <div class="stat-value">{{ stats.avgRating.toFixed(1) }}</div>
            <div class="stat-label">{{ $t('profile.stats.avgRating') }}</div>
          </div>
        </v-col>

        <v-col cols="6" sm="3">
          <div class="stat-box">
            <v-icon icon="mdi-message-star" size="32" color="info" class="mb-2" />
            <div class="stat-value">{{ stats.totalRatings }}</div>
            <div class="stat-label">{{ $t('profile.stats.ratings') }}</div>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  stats: {
    totalAdventures: number
    totalDownloads: number
    avgRating: number
    totalRatings: number
  }
}>()
</script>

<style scoped>
.profile-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.5);
  border-radius: 12px;
  text-align: center;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
