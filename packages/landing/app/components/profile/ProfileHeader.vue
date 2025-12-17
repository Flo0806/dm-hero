<template>
  <div class="profile-header">
    <div class="d-flex align-center flex-wrap ga-6">
      <!-- Avatar -->
      <v-avatar size="120" color="primary" class="profile-avatar">
        <v-img v-if="user?.avatarUrl" :src="user.avatarUrl" />
        <span v-else class="text-h3">{{ initials }}</span>
      </v-avatar>

      <!-- Info -->
      <div class="flex-grow-1">
        <h1 class="text-h4 font-weight-light mb-1">{{ user?.displayName }}</h1>
        <p class="text-body-2 text-medium-emphasis mb-3">
          <v-icon icon="mdi-email-outline" size="small" class="mr-1" />
          {{ user?.email }}
          <v-chip
            v-if="user?.emailVerified"
            size="x-small"
            color="success"
            variant="tonal"
            class="ml-2"
          >
            <v-icon icon="mdi-check" size="x-small" start />
            {{ $t('profile.verified') }}
          </v-chip>
        </p>

        <!-- Quick Stats -->
        <div class="d-flex flex-wrap ga-4">
          <div class="stat-item">
            <span class="stat-value">{{ stats.totalAdventures }}</span>
            <span class="stat-label">{{ $t('profile.stats.adventures') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.totalDownloads }}</span>
            <span class="stat-label">{{ $t('profile.stats.downloads') }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.avgRating.toFixed(1) }}</span>
            <span class="stat-label">{{ $t('profile.stats.avgRating') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuthUser } from '~/stores/authStore'

const props = defineProps<{
  user: AuthUser | null
  stats: {
    totalAdventures: number
    totalDownloads: number
    avgRating: number
    totalRatings: number
  }
}>()

const initials = computed(() => {
  if (!props.user?.displayName) return '?'
  return props.user.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})
</script>

<style scoped>
.profile-header {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
  border-radius: 16px;
  padding: 24px;
}

.profile-avatar {
  border: 3px solid rgb(var(--v-theme-primary));
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: rgba(var(--v-theme-surface), 0.5);
  border-radius: 8px;
  min-width: 80px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.stat-label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
