<script setup lang="ts">
import type { PinboardItem } from '~~/types/pinboard'

const props = defineProps<{
  entityId: number
  /** Button variant: 'icon' for icon-only, 'text' for text button, 'chip' for chip style */
  variant?: 'icon' | 'text' | 'chip'
  /** Size for icon variant */
  size?: 'x-small' | 'small' | 'default' | 'large'
}>()

const { t } = useI18n()
const campaignStore = useCampaignStore()
const pinboardStore = usePinboardStore()

const campaignId = computed(() => campaignStore.activeCampaignId)

const loading = ref(false)

// Use store for pin status
const isPinned = computed(() => pinboardStore.isPinned(props.entityId))
const pinId = computed(() => pinboardStore.getPinId(props.entityId))

// Ensure pins are loaded when component mounts
onMounted(async () => {
  if (campaignId.value && pinboardStore.pins.length === 0) {
    await pinboardStore.fetchPins(Number(campaignId.value))
  }
})

// Toggle pin state
async function togglePin() {
  if (!campaignId.value || !props.entityId) return

  loading.value = true
  try {
    if (isPinned.value && pinId.value) {
      // Remove pin
      await $fetch(`/api/pinboard/${pinId.value}`, {
        method: 'DELETE',
      })
      pinboardStore.removePin(pinId.value)
    } else {
      // Add pin - fetch full pin data to add to store
      const result = await $fetch<{ pinId: number; success: boolean }>('/api/pinboard', {
        method: 'POST',
        body: { campaignId: campaignId.value, entityId: props.entityId },
      })

      // Fetch the newly created pin with all its data
      const pins = await $fetch<PinboardItem[]>('/api/pinboard', {
        query: { campaignId: campaignId.value },
      })
      const newPin = pins.find((p) => p.pin_id === result.pinId)
      if (newPin) {
        pinboardStore.addPin(newPin)
      }
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409) {
      // Already pinned - refresh store to sync state
      await pinboardStore.fetchPins(Number(campaignId.value))
    } else {
      console.error('Failed to toggle pin:', error)
    }
  } finally {
    loading.value = false
  }
}

// Watch campaign changes to refresh pins
watch(campaignId, async (newCampaignId) => {
  if (newCampaignId) {
    await pinboardStore.fetchPins(Number(newCampaignId))
  } else {
    pinboardStore.clearPins()
  }
})
</script>

<template>
  <!-- Icon-only variant -->
  <v-btn
    v-if="variant === 'icon' || !variant"
    :icon="isPinned ? 'mdi-pin-off' : 'mdi-pin'"
    :size="size || 'small'"
    :loading="loading"
    :color="isPinned ? 'primary' : undefined"
    variant="text"
    :title="isPinned ? t('pinboard.unpin') : t('pinboard.pin')"
    @click.stop="togglePin"
  />

  <!-- Text button variant -->
  <v-btn
    v-else-if="variant === 'text'"
    :prepend-icon="isPinned ? 'mdi-pin-off' : 'mdi-pin'"
    :loading="loading"
    :color="isPinned ? 'primary' : undefined"
    variant="text"
    :size="size || 'default'"
    @click.stop="togglePin"
  >
    {{ isPinned ? t('pinboard.unpin') : t('pinboard.pin') }}
  </v-btn>

  <!-- Chip variant -->
  <v-chip
    v-else-if="variant === 'chip'"
    :prepend-icon="isPinned ? 'mdi-pin-off' : 'mdi-pin'"
    :color="isPinned ? 'primary' : undefined"
    :size="size || 'small'"
    variant="tonal"
    class="cursor-pointer"
    @click.stop="togglePin"
  >
    <template v-if="loading">
      <v-progress-circular indeterminate size="12" width="2" />
    </template>
    <template v-else>
      {{ isPinned ? t('pinboard.unpin') : t('pinboard.pin') }}
    </template>
  </v-chip>
</template>
