<template>
  <v-card class="dashboard-card h-100" variant="outlined">
    <v-card-text class="pa-4">
      <div class="d-flex align-center justify-space-between mb-3">
        <div class="d-flex align-center">
          <v-icon icon="mdi-pin" color="primary" size="24" class="mr-2" />
          <span class="text-subtitle-1 font-weight-medium">{{ $t('dashboard.pinboard.title') }}</span>
        </div>
      </div>

      <div v-if="pins.length > 0">
        <!-- Pinned items list -->
        <div class="d-flex flex-column ga-2">
          <div
            v-for="pin in previewPins"
            :key="pin.pin_id"
            class="pin-item d-flex align-center py-2 px-3 rounded-lg cursor-pointer"
            @click="openEntity(pin)"
          >
            <div class="position-relative flex-shrink-0 mr-2">
              <v-avatar size="36" :color="pin.image_url ? undefined : getTypeColor(pin.type)">
                <v-img v-if="pin.image_url" :src="`/uploads/${pin.image_url}`" cover />
                <v-icon v-else :icon="getTypeIcon(pin.type)" size="20" />
              </v-avatar>
              <v-avatar v-if="pin.image_url" size="16" :color="getTypeColor(pin.type)" class="type-badge">
                <v-icon :icon="getTypeIcon(pin.type)" size="10" color="white" />
              </v-avatar>
            </div>
            <div class="flex-grow-1 overflow-hidden">
              <div class="text-body-2 font-weight-medium text-truncate">{{ pin.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ getTypeLabel(pin.type) }}</div>
            </div>
          </div>
        </div>

        <div v-if="pins.length > 4" class="text-caption text-medium-emphasis mt-2 text-center">
          {{ $t('dashboard.pinboard.more', { count: pins.length - 4 }) }}
        </div>
      </div>

      <div v-else class="d-flex flex-column align-center text-center py-4">
        <v-icon icon="mdi-pin-off" size="32" class="text-medium-emphasis mb-2" />
        <p class="text-body-2 text-medium-emphasis">
          {{ $t('dashboard.pinboard.empty') }}
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { PinboardItem } from '~~/types/pinboard'

const { t } = useI18n()

const props = defineProps<{
  pins: PinboardItem[]
}>()

const emit = defineEmits<{
  openEntity: [pin: PinboardItem]
}>()

// Show first 4 pins as preview
const previewPins = computed(() => props.pins.slice(0, 4))

const typeIcons: Record<string, string> = {
  npc: 'mdi-account-group',
  location: 'mdi-map-marker',
  item: 'mdi-sword',
  faction: 'mdi-shield',
  lore: 'mdi-book-open-variant',
  player: 'mdi-account-star',
}

const typeColors: Record<string, string> = {
  npc: '#D4A574',
  location: '#8B7355',
  item: '#CC8844',
  faction: '#7B92AB',
  lore: '#9B8B7A',
  player: '#A8C686',
}

function getTypeIcon(type: string): string {
  const key = type.toLowerCase()
  return typeIcons[key] || 'mdi-help-circle-outline'
}

function getTypeColor(type: string): string {
  const key = type.toLowerCase()
  return typeColors[key] || '#888888'
}

function getTypeLabel(type: string): string {
  const key = type.toLowerCase()
  // Handle plural form for translation key
  const pluralKey = key === 'lore' ? 'lore' : `${key}s`
  return t(`categories.${pluralKey}.title`)
}

function openEntity(pin: PinboardItem) {
  emit('openEntity', pin)
}
</script>

<style scoped>
.pin-item {
  background: rgba(var(--v-theme-surface), 0.5);
  transition: all 0.15s ease;
}

.pin-item:hover {
  background: rgba(var(--v-theme-primary), 0.1);
}

.type-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  border: 2px solid rgb(var(--v-theme-surface));
}
</style>
