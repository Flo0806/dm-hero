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
            ref="adventuresCardRef"
            :adventures="userAdventures"
            :loading="loadingAdventures"
            :highlight-id="highlightAdventureId"
            class="mb-6"
            @delete="handleDeleteAdventure"
          />

          <!-- Danger Zone -->
          <v-card class="danger-zone-card" elevation="0">
            <v-card-title class="text-error d-flex align-center">
              <v-icon icon="mdi-alert-circle" class="mr-2" />
              {{ $t('profile.dangerZone.title') }}
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 text-medium-emphasis mb-4">
                {{ $t('profile.dangerZone.description') }}
              </p>
              <v-btn
                color="error"
                variant="outlined"
                prepend-icon="mdi-delete-forever"
                @click="showDeleteDialog = true"
              >
                {{ $t('profile.dangerZone.deleteButton') }}
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Delete Account Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="text-error d-flex align-center">
          <v-icon icon="mdi-alert" class="mr-2" />
          {{ $t('profile.deleteAccount.title') }}
        </v-card-title>
        <v-card-text>
          <v-alert type="error" variant="tonal" class="mb-4">
            <div class="font-weight-medium mb-2">{{ $t('profile.deleteAccount.warning') }}</div>
            <ul class="text-body-2 pl-4">
              <li>{{ $t('profile.deleteAccount.consequence1') }}</li>
              <li>{{ $t('profile.deleteAccount.consequence2') }}</li>
              <li>{{ $t('profile.deleteAccount.consequence3') }}</li>
            </ul>
          </v-alert>

          <p class="text-body-2 mb-4">
            {{ $t('profile.deleteAccount.confirmText') }}
          </p>

          <v-text-field
            v-model="deleteConfirmEmail"
            :label="$t('auth.email')"
            :placeholder="user?.email"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="mdi-email-outline"
            :error-messages="deleteEmailError"
          />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn
            variant="text"
            @click="closeDeleteDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="deleting"
            :disabled="!deleteConfirmEmail"
            @click="handleDeleteAccount"
          >
            {{ $t('profile.deleteAccount.confirmButton') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Footer -->
    <FooterSection />
  </div>
</template>

<script setup lang="ts">
import { useProfileStore } from '~/stores/profileStore'
import { useApiFetch } from '~/composables/useApiFetch'
import confetti from 'canvas-confetti'

definePageMeta({
  middleware: 'auth',
})

// Ref to adventures card component
const adventuresCardRef = ref<{ isValidationDialogOpen: boolean } | null>(null)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, fetchUser, logout } = useAuth()
const profileStore = useProfileStore()
const { showError, showSuccess } = useSnackbar()
const api = useApiFetch()
const saving = ref(false)

// Delete account state
const showDeleteDialog = ref(false)
const deleteConfirmEmail = ref('')
const deleteEmailError = ref('')
const deleting = ref(false)

// Highlight adventure from query param (after save)
const highlightAdventureId = computed(() => {
  const id = route.query.highlight
  return id ? Number(id) : null
})

// Get request headers for SSR (must be called in setup context, not in async callback)
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : null

// Fetch profile data (SSR-compatible)
const { pending: loadingAdventures } = await useAsyncData('profile-adventures', async () => {
  // Forward cookies on server
  let headers: Record<string, string> | undefined
  if (import.meta.server && requestHeaders?.cookie) {
    headers = { cookie: requestHeaders.cookie }
  }
  await profileStore.fetchAdventures(headers)
  return true
})

const userAdventures = computed(() => profileStore.adventures)
const stats = computed(() => profileStore.stats)

// Poll for status updates every 60 seconds when there are pending adventures (client-only)
let pollInterval: ReturnType<typeof setInterval> | null = null

if (import.meta.client) {
  onMounted(() => {
    if (profileStore.hasPendingAdventures) {
      startPolling()
    }
  })

  onUnmounted(() => {
    stopPolling()
  })

  // Watch for pending adventures to start/stop polling
  watch(() => profileStore.hasPendingAdventures, (hasPending) => {
    if (hasPending) {
      startPolling()
    } else {
      stopPolling()
    }
  })
}

function triggerConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#D4A574', '#8B7355', '#FFD700', '#4CAF50'],
  })
  // Second burst from sides
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#D4A574', '#8B7355', '#FFD700'],
    })
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#D4A574', '#8B7355', '#FFD700'],
    })
  }, 250)
}

function startPolling() {
  if (pollInterval) return // Already polling
  pollInterval = setInterval(async () => {
    const now = new Date().toLocaleString('de-DE')
    console.log(`[Profile] Polling for status updates... (${now})`)

    // Store previous statuses to detect changes
    const previousStatuses = new Map(
      profileStore.adventures.map((a) => [a.id, a.status]),
    )

    await profileStore.fetchAdventures()

    // Check if validation dialog is open (confetti is triggered there instead)
    if (adventuresCardRef.value?.isValidationDialogOpen) {
      return
    }

    // Check if any adventure changed to 'published'
    for (const adventure of profileStore.adventures) {
      const prevStatus = previousStatuses.get(adventure.id)
      if (prevStatus && prevStatus !== 'published' && adventure.status === 'published') {
        console.log(`[Profile] Adventure published: ${adventure.title}`)
        triggerConfetti()
        break // Only one confetti burst even if multiple published
      }
    }
  }, 60 * 1000) // Every 60 seconds
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

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

// Delete account
function closeDeleteDialog() {
  showDeleteDialog.value = false
  deleteConfirmEmail.value = ''
  deleteEmailError.value = ''
}

async function handleDeleteAccount() {
  deleteEmailError.value = ''

  // Validate email matches
  if (deleteConfirmEmail.value.toLowerCase().trim() !== user.value?.email?.toLowerCase()) {
    deleteEmailError.value = t('profile.deleteAccount.emailMismatch')
    return
  }

  deleting.value = true
  try {
    await api.post('/api/auth/delete-account', {
      email: deleteConfirmEmail.value,
    })

    // Close dialog first
    showDeleteDialog.value = false

    // Clear local auth state
    await logout()

    // Redirect to home with success message
    router.push('/')
    showSuccess(t('profile.deleteAccount.success'))
  } catch (err) {
    console.error('Failed to delete account:', err)
    const fetchError = err as { data?: { message?: string } }
    deleteEmailError.value = fetchError.data?.message || t('profile.deleteAccount.error')
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.danger-zone-card {
  background: rgba(var(--v-theme-error), 0.05);
  border: 1px solid rgba(var(--v-theme-error), 0.2);
}
</style>
