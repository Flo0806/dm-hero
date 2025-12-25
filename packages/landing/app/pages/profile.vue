<template>
  <div>
    <StoreBackground />
    <v-container class="py-8 position-relative" style="max-width: 1000px; z-index: 1">
      <!-- Header (client-only due to Vuetify VChip SSR issue) -->
      <ClientOnly>
        <ProfileHeader :user="user" :stats="stats" class="mb-8" />
        <template #fallback>
          <div class="profile-header-skeleton mb-8">
            <v-skeleton-loader type="avatar" />
          </div>
        </template>
      </ClientOnly>

      <v-row>
        <!-- Left Column -->
        <v-col cols="12" md="4">
          <!-- Profile Info Card -->
          <ProfileInfoCard
            :user="user"
            :loading="saving"
            @update="handleUpdateProfile"
            @upload-avatar="handleAvatarUpload"
          />
        </v-col>

        <!-- Right Column -->
        <v-col cols="12" md="8">
          <!-- Stats Card -->
          <ProfileStatsCard :stats="stats" class="mb-6" />

          <!-- Adventures Card -->
          <ProfileAdventuresCard
            :adventures="userAdventures"
            :loading="loadingAdventures"
            @delete="handleDeleteAdventure"
          />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { useProfileStore } from '~/stores/profileStore'
import { useApiFetch } from '~/composables/useApiFetch'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const { user, fetchUser } = useAuth()
const profileStore = useProfileStore()
const { showError, showSuccess } = useSnackbar()
const api = useApiFetch()
const saving = ref(false)

// Fetch profile data (SSR-compatible)
const { pending: loadingAdventures } = await useAsyncData('profile-adventures', async () => {
  // Forward cookies on server
  let headers: Record<string, string> | undefined
  if (import.meta.server) {
    const requestHeaders = useRequestHeaders(['cookie'])
    if (requestHeaders.cookie) {
      headers = { cookie: requestHeaders.cookie }
    }
  }
  await profileStore.fetchAdventures(headers)
  return true
})

const userAdventures = computed(() => profileStore.adventures)
const stats = computed(() => profileStore.stats)

// Update profile (uses $api for auto token refresh)
async function handleUpdateProfile(data: { displayName: string }) {
  saving.value = true
  try {
    await api.put('/api/profile', data)
    await fetchUser()
    showSuccess(t('profile.messages.profileUpdated'))
  } catch (err) {
    console.error('Failed to update profile:', err)
    showError(t('profile.messages.updateFailed'))
  } finally {
    saving.value = false
  }
}

// Upload avatar (uses $api for auto token refresh)
async function handleAvatarUpload(file: File) {
  saving.value = true
  try {
    const formData = new FormData()
    formData.append('avatar', file)

    await api.fetch('/api/profile/avatar', {
      method: 'POST',
      body: formData,
    })

    await fetchUser()
    showSuccess(t('profile.messages.avatarUpdated'))
  } catch (err) {
    console.error('Failed to upload avatar:', err)
    const fetchError = err as { data?: { message?: string } }
    const message = fetchError.data?.message || ''

    // Map known error messages to i18n keys
    if (message.includes('too large')) {
      showError(t('profile.messages.fileTooLarge'))
    } else if (message.includes('Invalid file type')) {
      showError(t('profile.messages.invalidFileType'))
    } else {
      showError(t('profile.messages.uploadFailed'))
    }
  } finally {
    saving.value = false
  }
}

// Delete adventure
async function handleDeleteAdventure(adventureId: number) {
  try {
    await profileStore.deleteAdventure(adventureId)
    showSuccess(t('profile.messages.adventureDeleted'))
  } catch (err) {
    console.error('Failed to delete adventure:', err)
    showError(t('profile.messages.deleteFailed'))
  }
}
</script>
