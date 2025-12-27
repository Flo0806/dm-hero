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
        <p class="text-body-2 text-medium-emphasis mb-2">
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

        <!-- Member Since -->
        <p class="text-body-2 text-medium-emphasis">
          <v-icon icon="mdi-calendar-account" size="small" class="mr-1" />
          {{ $t('profile.memberSince') }} {{ memberSince }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuthUser } from '~/stores/authStore'

const { locale } = useI18n()

const props = defineProps<{
  user: AuthUser | null
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

const memberSince = computed(() => {
  if (!props.user?.createdAt) return ''
  const date = new Date(props.user.createdAt)
  return date.toLocaleDateString(locale.value === 'de' ? 'de-DE' : 'en-US', {
    month: 'long',
    year: 'numeric',
  })
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
</style>
