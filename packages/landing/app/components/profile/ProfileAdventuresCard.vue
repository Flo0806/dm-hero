<template>
  <v-card elevation="0" class="profile-card">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon icon="mdi-book-multiple" class="mr-2" />
        {{ $t('profile.adventures.title') }}
      </div>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-plus"
        to="/store/upload"
      >
        {{ $t('profile.adventures.create') }}
      </v-btn>
    </v-card-title>

    <v-card-text>
      <!-- Loading -->
      <div v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <!-- Empty State -->
      <div v-else-if="adventures.length === 0" class="text-center py-8">
        <v-icon icon="mdi-book-open-blank-variant" size="64" color="medium-emphasis" class="mb-4" />
        <p class="text-body-1 text-medium-emphasis mb-4">
          {{ $t('profile.adventures.empty') }}
        </p>
        <v-btn color="primary" variant="tonal" to="/store/upload" prepend-icon="mdi-plus">
          {{ $t('profile.adventures.createFirst') }}
        </v-btn>
      </div>

      <!-- Adventures List -->
      <v-list v-else class="adventures-list">
        <v-list-item
          v-for="adventure in adventures"
          :id="`adventure-${adventure.id}`"
          :key="adventure.id"
          :class="['adventure-item', 'mb-3', { 'highlight-blink': highlightedId === adventure.id }]"
          :ripple="false"
          rounded
        >
          <template #prepend>
            <v-img
              v-if="adventure.coverImageUrl"
              :src="adventure.coverImageUrl"
              width="80"
              height="50"
              cover
              class="rounded mr-4"
            />
            <div
              v-else
              class="cover-placeholder rounded mr-4 d-flex align-center justify-center"
            >
              <v-icon icon="mdi-image" />
            </div>
          </template>

          <v-list-item-title class="font-weight-medium">
            {{ adventure.title }}
          </v-list-item-title>

          <v-list-item-subtitle class="d-flex align-center ga-3 mt-1">
            <span>
              <v-icon icon="mdi-download" size="x-small" />
              {{ adventure.downloadCount }}
            </span>
            <span>
              <v-icon icon="mdi-star" size="x-small" color="amber" />
              {{ adventure.avgRating?.toFixed(1) || '0.0' }}
            </span>
            <!-- Version chip -->
            <v-chip
              size="x-small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-tag-outline"
            >
              v{{ adventure.latestVersion?.versionNumber || 1 }}
            </v-chip>
            <!-- Clickable status badge for non-published -->
            <StoreAdventureStatusBadge
              :status="adventure.status"
              size="x-small"
              :clickable="adventure.status !== 'published'"
              @click.stop="onBadgeClick(adventure)"
            />
          </v-list-item-subtitle>

          <template #append>
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-btn
                  icon="mdi-dots-vertical"
                  variant="text"
                  size="small"
                  v-bind="menuProps"
                />
              </template>
              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-eye"
                  :to="adventure.status === 'published' ? `/store/${adventure.slug}` : undefined"
                  :disabled="adventure.status !== 'published'"
                >
                  <v-list-item-title>{{ $t('profile.adventures.view') }}</v-list-item-title>
                  <v-tooltip v-if="adventure.status !== 'published'" activator="parent" location="start">
                    {{ $t('profile.adventures.notPublishedYet') }}
                  </v-tooltip>
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-pencil"
                  :to="`/store/upload?id=${adventure.id}`"
                >
                  <v-list-item-title>{{ $t('profile.adventures.edit') }}</v-list-item-title>
                </v-list-item>
                <v-divider />
                <!-- Unpublish (only for published) -->
                <v-list-item
                  v-if="adventure.status === 'published'"
                  prepend-icon="mdi-eye-off"
                  @click="handleStatusChange(adventure, 'unpublish')"
                >
                  <v-list-item-title>{{ $t('profile.adventures.unpublish') }}</v-list-item-title>
                </v-list-item>
                <!-- Republish (only for draft) -->
                <v-list-item
                  v-if="adventure.status === 'draft'"
                  prepend-icon="mdi-publish"
                  @click="handleStatusChange(adventure, 'republish')"
                >
                  <v-list-item-title>{{ $t('profile.adventures.republish') }}</v-list-item-title>
                </v-list-item>
                <v-divider />
                <v-list-item
                  prepend-icon="mdi-delete"
                  base-color="error"
                  @click="confirmDelete(adventure)"
                >
                  <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('profile.adventures.deleteConfirm.title') }}</v-card-title>
        <v-card-text>
          {{ $t('profile.adventures.deleteConfirm.message', { title: adventureToDelete?.title }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" variant="flat" @click="handleDelete">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Validation Details Dialog -->
    <v-dialog v-model="validationDialog" max-width="600">
      <v-card v-if="selectedAdventure">
        <v-card-title class="d-flex align-center text-h5">
          <v-icon
            :icon="selectedAdventure.status === 'rejected' ? 'mdi-file-document-alert' : 'mdi-file-clock'"
            :color="selectedAdventure.status === 'rejected' ? 'error' : 'warning'"
            size="28"
            class="mr-3"
          />
          {{ selectedAdventure.title }}
          <v-progress-circular
            v-if="loadingDetails"
            indeterminate
            size="18"
            width="2"
            class="ml-3"
          />
        </v-card-title>
        <v-card-subtitle class="pb-0 text-body-1">
          {{ selectedAdventure.status === 'rejected' ? $t('store.validation.detailsTitle') : $t('store.validation.statusTitle') }}
        </v-card-subtitle>
        <v-card-text class="pt-4">
          <!-- Timeline -->
          <StoreValidationTimeline
            :status="selectedAdventure.status"
            :validated-at="selectedAdventure.validatedAt"
            class="mb-6"
          />

          <!-- Validation Errors & Warnings -->
          <StoreValidationResultAlert
            v-if="selectedAdventure.validationResult"
            :errors="selectedAdventure.validationResult.errors || []"
            :warnings="selectedAdventure.validationResult.warnings || []"
          />

          <!-- Fix hint (only for rejected) -->
          <v-alert
            v-if="selectedAdventure.status === 'rejected'"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            {{ $t('store.validation.fixHint') }}
          </v-alert>

          <!-- Pending info -->
          <v-alert
            v-else-if="selectedAdventure.status === 'pending_review' || selectedAdventure.status === 'validating'"
            type="info"
            variant="tonal"
            class="mt-4"
          >
            {{ $t('store.validation.pendingHint') }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="validationDialog = false">
            {{ $t('common.close') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-pencil"
            :to="`/store/upload?id=${selectedAdventure.id}`"
            @click="validationDialog = false"
          >
            {{ $t('store.validation.editAdventure') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import type { UserAdventure } from '~/stores/profileStore'
import { useProfileStore } from '~/stores/profileStore'
import confetti from 'canvas-confetti'

const profileStore = useProfileStore()

const props = defineProps<{
  adventures: UserAdventure[]
  loading: boolean
  highlightId?: number | null
}>()

const emit = defineEmits<{
  delete: [adventureId: number]
  statusChange: [adventureId: number, action: 'unpublish' | 'republish']
}>()

const deleteDialog = ref(false)
const adventureToDelete = ref<UserAdventure | null>(null)
const highlightedId = ref<number | null>(null)

// Validation details
const validationDialog = ref(false)
const selectedAdventure = ref<UserAdventure | null>(null)
const loadingDetails = ref(false)
let dialogPollInterval: ReturnType<typeof setInterval> | null = null

// Trigger confetti when status changes to published
function triggerConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#D4A574', '#8B7355', '#FFD700', '#4CAF50'],
  })
  // Second burst
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

// Poll while dialog is open (every 20 seconds)
watch(validationDialog, (isOpen) => {
  if (isOpen && selectedAdventure.value) {
    // Start polling
    dialogPollInterval = setInterval(async () => {
      if (!selectedAdventure.value) return
      const adventureId = selectedAdventure.value.id
      const previousStatus = selectedAdventure.value.status
      console.log(`[ValidationDialog] Polling status... (${new Date().toLocaleString('de-DE')})`)
      loadingDetails.value = true
      try {
        await profileStore.fetchAdventures()
        const fresh = profileStore.getAdventureById(adventureId)
        if (fresh) {
          // Check if status changed to published
          if (previousStatus !== 'published' && fresh.status === 'published') {
            triggerConfetti()
          }
          selectedAdventure.value = fresh
        }
      } finally {
        loadingDetails.value = false
      }
    }, 20 * 1000) // Every 20 seconds
  } else {
    // Stop polling
    if (dialogPollInterval) {
      clearInterval(dialogPollInterval)
      dialogPollInterval = null
    }
  }
})

async function showValidationDetails(adventure: UserAdventure) {
  // Show dialog with current data first
  selectedAdventure.value = adventure
  validationDialog.value = true

  // Fetch fresh data in background
  loadingDetails.value = true
  try {
    await profileStore.fetchAdventures()
    // Update selectedAdventure with fresh data
    const fresh = profileStore.getAdventureById(adventure.id)
    if (fresh) {
      selectedAdventure.value = fresh
    }
  } finally {
    loadingDetails.value = false
  }
}

function onBadgeClick(adventure: UserAdventure) {
  if (adventure.status !== 'published') {
    showValidationDetails(adventure)
  }
}

// Track if we've already highlighted (prevent re-highlight on data refresh)
const hasHighlighted = ref(false)

// Scroll to and highlight adventure when highlightId changes (client-only)
if (import.meta.client) {
  watch(() => props.highlightId, (id) => {
    if (id && props.adventures.length > 0 && !hasHighlighted.value) {
      hasHighlighted.value = true
      // Wait for DOM to be ready
      nextTick(() => {
        const element = document.getElementById(`adventure-${id}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          highlightedId.value = id
          // Remove highlight after animation completes (3 blinks = 1.5s)
          setTimeout(() => {
            highlightedId.value = null
          }, 1500)
        }
      })
    }
  }, { immediate: true })

  // Also watch adventures in case they load after highlightId is set
  watch(() => props.adventures, (adventures) => {
    if (props.highlightId && adventures.length > 0 && !hasHighlighted.value) {
      hasHighlighted.value = true
      nextTick(() => {
        const element = document.getElementById(`adventure-${props.highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          highlightedId.value = props.highlightId ?? null
          setTimeout(() => {
            highlightedId.value = null
          }, 1500)
        }
      })
    }
  })
}

function confirmDelete(adventure: UserAdventure) {
  adventureToDelete.value = adventure
  deleteDialog.value = true
}

function handleDelete() {
  if (adventureToDelete.value) {
    emit('delete', adventureToDelete.value.id)
  }
  deleteDialog.value = false
  adventureToDelete.value = null
}

function handleStatusChange(adventure: UserAdventure, action: 'unpublish' | 'republish') {
  emit('statusChange', adventure.id, action)
}

// Expose dialog state so parent can check before triggering confetti
defineExpose({
  isValidationDialogOpen: computed(() => validationDialog.value),
})
</script>

<style scoped>
.profile-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.adventures-list {
  background: transparent;
}

.adventure-item {
  background: rgba(var(--v-theme-surface), 0.5);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.cover-placeholder {
  width: 80px;
  height: 50px;
  background: rgba(var(--v-theme-surface-variant), 0.5);
}

.highlight-blink {
  animation: highlight-pulse 0.5s ease-in-out 3;
}

@keyframes highlight-pulse {
  0%, 100% {
    background: rgba(var(--v-theme-surface), 0.5);
    border-color: rgba(var(--v-theme-outline), 0.1);
  }
  50% {
    background: rgba(var(--v-theme-primary), 0.2);
    border-color: rgba(var(--v-theme-primary), 0.5);
  }
}
</style>
