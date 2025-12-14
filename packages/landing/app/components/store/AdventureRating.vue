<template>
  <div class="adventure-rating">
    <!-- Rating Display & Input -->
    <div class="d-flex align-center ga-2">
      <v-rating
        v-model="localRating"
        :readonly="!canRate || submitting"
        :hover="canRate && !submitting"
        density="comfortable"
        color="amber"
        active-color="amber-darken-1"
        half-increments
        @update:model-value="onRatingChange"
      />
      <template v-if="submitting">
        <v-progress-circular indeterminate size="16" width="2" color="amber" class="mr-1" />
        <span class="text-body-2 text-medium-emphasis">...</span>
      </template>
      <span v-else class="text-body-2 text-medium-emphasis">
        {{ displayRating }} ({{ ratingCount }})
      </span>
    </div>

    <!-- Login hint -->
    <p v-if="!isAuthenticated" class="text-caption text-medium-emphasis mt-1">
      <NuxtLink to="/login" class="text-primary">
        {{ $t('store.rating.loginToRate') }}
      </NuxtLink>
    </p>

    <!-- Email not verified hint -->
    <p v-else-if="!isEmailVerified" class="text-caption text-warning mt-1">
      <v-icon icon="mdi-email-alert" size="small" />
      {{ $t('store.rating.verifyToRate') }}
    </p>

    <!-- User's rating status -->
    <p v-else-if="userRating" class="text-caption text-success mt-1">
      <v-icon icon="mdi-check" size="small" />
      {{ $t('store.rating.yourRating', { rating: userRating }) }}
    </p>

    <!-- Submitting state -->
    <p v-else-if="submitting" class="text-caption text-medium-emphasis mt-1">
      <v-progress-circular indeterminate size="12" width="2" class="mr-1" />
      {{ $t('store.rating.submitting') }}
    </p>

    <!-- Error -->
    <p v-if="error" class="text-caption text-error mt-1">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAdventureStore } from '~/stores/adventureStore'

const props = defineProps<{
  adventureId: number
}>()

const { t } = useI18n()
const { isAuthenticated, isEmailVerified } = useAuth()
const store = useAdventureStore()

// Can rate only if authenticated AND email verified
const canRate = computed(() => isAuthenticated.value && isEmailVerified.value)

// Use storeToRefs for reactive state access
const { adventures, adventureDetails, userRatings } = storeToRefs(store)

const submitting = ref(false)
const error = ref('')

// Get adventure from store (reactive!)
const adventure = computed(() => {
  // Try to find in list first
  const fromList = adventures.value.find((a) => a.id === props.adventureId)
  if (fromList) return fromList

  // Then check detail cache
  for (const slug in adventureDetails.value) {
    const detail = adventureDetails.value[slug]
    if (detail && detail.id === props.adventureId) return detail
  }
  return null
})

// Reactive rating from store
const avgRating = computed(() => adventure.value?.avgRating || 0)
const ratingCount = computed(() => adventure.value?.ratingCount || 0)
const userRating = computed(() => userRatings.value[props.adventureId] || null)

// Local rating for v-model (shows user rating if set, otherwise avg)
const localRating = computed({
  get: () => userRating.value || avgRating.value,
  set: () => {}, // handled by onRatingChange
})

const displayRating = computed(() => {
  return avgRating.value.toFixed(1)
})

// Fetch user's rating on mount
onMounted(async () => {
  if (isAuthenticated.value) {
    await store.fetchUserRating(props.adventureId)
  }
})

async function onRatingChange(newRating: string | number) {
  if (!canRate.value || submitting.value) return

  const ratingValue = Number(newRating)
  if (isNaN(ratingValue)) return

  submitting.value = true
  error.value = ''

  try {
    await store.rateAdventure(props.adventureId, ratingValue)
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError.data?.message || t('common.error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.adventure-rating :deep(.v-rating) {
  cursor: pointer;
}

.adventure-rating :deep(.v-rating--readonly) {
  cursor: default;
}
</style>
