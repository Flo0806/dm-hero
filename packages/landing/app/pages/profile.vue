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

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const { user, fetchUser } = useAuth()
const profileStore = useProfileStore()
const { showError, showSuccess } = useSnackbar()
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

// Update profile
async function handleUpdateProfile(data: { displayName: string }) {
  saving.value = true
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: data,
    })
    await fetchUser()
    showSuccess(t('profile.messages.profileUpdated'))
  } catch (err) {
    console.error('Failed to update profile:', err)
    showError(t('profile.messages.updateFailed'))
  } finally {
    saving.value = false
  }
}

// Upload avatar - use native fetch for FormData (ofetch can have issues with multipart)
async function handleAvatarUpload(file: File) {
  saving.value = true
  try {
    const formData = new FormData()
    formData.append('avatar', file)

    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }))
      // Map known error messages to i18n keys
      if (error.message?.includes('too large')) {
        throw new Error(t('profile.messages.fileTooLarge'))
      } else if (error.message?.includes('Invalid file type')) {
        throw new Error(t('profile.messages.invalidFileType'))
      }
      throw new Error(error.message || t('profile.messages.uploadFailed'))
    }

    await fetchUser()
    showSuccess(t('profile.messages.avatarUpdated'))
  } catch (err) {
    console.error('Failed to upload avatar:', err)
    showError(err instanceof Error ? err.message : t('profile.messages.uploadFailed'))
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
