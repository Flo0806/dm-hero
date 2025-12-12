<script setup lang="ts">
import type { PinboardItem } from '~~/types/pinboard'
import type { EntityPreviewType } from '~~/app/components/shared/EntityPreviewDialog.vue'
import draggable from 'vuedraggable'

const { t } = useI18n()
const campaignStore = useCampaignStore()
const pinboardStore = usePinboardStore()

const campaignId = computed(() => campaignStore.activeCampaignId)

// State
const previewEntityId = ref<number | null>(null)
const previewType = ref<EntityPreviewType>('npc')
const showPreview = ref(false)
const expanded = ref(true)
const isDragging = ref(false)

// Use store for pins - create a local copy for draggable
const loading = computed(() => pinboardStore.loading)

// Local pins array for draggable (needs to be writable)
const localPins = ref<PinboardItem[]>([])

// Sync from store to local
watch(
  () => pinboardStore.pins,
  (newPins) => {
    localPins.value = [...newPins]
  },
  { immediate: true, deep: true },
)

// Fetch pins on mount and when campaign changes
async function fetchPins() {
  if (!campaignId.value) return
  await pinboardStore.fetchPins(Number(campaignId.value))
}

// Handle drag end - save new order
async function onDragEnd() {
  isDragging.value = false

  // Get new order of pin IDs
  const pinIds = localPins.value.map((p) => p.pin_id)

  // Update store
  pinboardStore.reorderPins(pinIds)

  // Persist to backend
  try {
    await $fetch('/api/pinboard/reorder', {
      method: 'PATCH',
      body: { pinIds },
    })
  } catch (error) {
    console.error('Failed to save pin order:', error)
    // Revert on error
    await fetchPins()
  }
}

// Remove pin
async function removePin(pinId: number) {
  try {
    await $fetch(`/api/pinboard/${pinId}`, {
      method: 'DELETE',
    })
    pinboardStore.removePin(pinId)
  } catch (error) {
    console.error('Failed to remove pin:', error)
  }
}

// Show entity preview
function showEntityPreview(pin: { id: number; type: EntityPreviewType }) {
  previewEntityId.value = pin.id
  previewType.value = pin.type
  showPreview.value = true
}

// Get icon for entity type
function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    npc: 'mdi-account',
    location: 'mdi-map-marker',
    item: 'mdi-sword',
    faction: 'mdi-shield-account',
    lore: 'mdi-book-open-page-variant',
    player: 'mdi-account-star',
  }
  return icons[type.toLowerCase()] || 'mdi-help-circle'
}

// Get color for entity type
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    npc: 'blue',
    location: 'green',
    item: 'amber',
    faction: 'purple',
    lore: 'deep-orange',
    player: 'teal',
  }
  return colors[type.toLowerCase()] || 'grey'
}

// Watch campaign ID
watch(
  campaignId,
  (newId) => {
    if (newId) {
      fetchPins()
    } else {
      pinboardStore.clearPins()
    }
  },
  { immediate: true },
)

// Expose refresh method (for backwards compatibility)
defineExpose({
  refresh: fetchPins,
})
</script>

<template>
  <v-card class="pinboard-card" :class="{ 'pinboard-collapsed': !expanded }">
    <v-card-title
      class="pinboard-header d-flex align-center cursor-pointer"
      @click="expanded = !expanded"
    >
      <v-icon class="mr-2" size="small">mdi-pin</v-icon>
      {{ t('pinboard.title') }}
      <v-chip size="x-small" class="ml-2" color="primary" variant="tonal">
        {{ localPins.length }}
      </v-chip>
      <v-spacer />
      <v-icon>{{ expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
    </v-card-title>

    <v-expand-transition>
      <div v-show="expanded">
        <v-card-text class="pinboard-content pa-2">
          <div v-if="loading" class="text-center py-4">
            <v-progress-circular indeterminate color="primary" size="24" />
          </div>

          <div v-else-if="localPins.length === 0" class="text-center py-4 text-medium-emphasis">
            <v-icon size="48" class="mb-2" color="grey">mdi-pin-off</v-icon>
            <div class="text-body-2">{{ t('pinboard.empty') }}</div>
            <div class="text-caption">{{ t('pinboard.emptyHint') }}</div>
          </div>

          <draggable
            v-else
            v-model="localPins"
            item-key="pin_id"
            handle=".drag-handle"
            :animation="200"
            ghost-class="pin-ghost"
            drag-class="pin-drag"
            class="pinboard-items d-flex flex-wrap ga-1"
            @start="isDragging = true"
            @end="onDragEnd"
          >
            <template #item="{ element: pin }">
              <v-chip
                size="small"
                :color="getTypeColor(pin.type)"
                variant="tonal"
                class="pinboard-chip"
                :class="{ 'is-dragging': isDragging }"
                closable
                @click="showEntityPreview(pin)"
                @click:close="removePin(pin.pin_id)"
              >
                <template #prepend>
                  <v-icon
                    class="drag-handle mr-1"
                    size="x-small"
                    @click.stop
                  >
                    mdi-drag-vertical
                  </v-icon>
                </template>
                <v-avatar v-if="pin.image_url" start size="20" class="ml-n1">
                  <v-img :src="`/uploads/${pin.image_url}`" cover />
                </v-avatar>
                <v-icon v-else :icon="getTypeIcon(pin.type)" size="x-small" class="mr-1" />
                <span class="chip-text">{{ pin.name }}</span>
              </v-chip>
            </template>
          </draggable>
        </v-card-text>
      </div>
    </v-expand-transition>

    <!-- Entity Preview Dialog -->
    <SharedEntityPreviewDialog
      v-model="showPreview"
      :entity-id="previewEntityId"
      :entity-type="previewType"
    />
  </v-card>
</template>

<style scoped>
.pinboard-card {
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  background: rgba(var(--v-theme-surface), 0.95);
}

.pinboard-header {
  padding: 8px 12px;
  font-size: 0.9rem;
  background: rgba(var(--v-theme-primary), 0.05);
  border-bottom: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.pinboard-collapsed .pinboard-header {
  border-bottom: none;
}

.pinboard-content {
  max-height: 400px;
  overflow-y: auto;
}

.pinboard-chip {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.pinboard-chip:hover {
  transform: scale(1.02);
}

.pinboard-chip.is-dragging {
  cursor: grabbing;
}

.drag-handle {
  cursor: grab;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.drag-handle:hover {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.chip-text {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Drag & Drop styles */
.pin-ghost {
  opacity: 0.4;
}

.pin-drag {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>
