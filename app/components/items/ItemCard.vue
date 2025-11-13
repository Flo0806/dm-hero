<template>
  <v-card
    :id="`item-${item.id}`"
    hover
    :class="['d-flex flex-column item-card', { 'highlighted-card': isHighlighted }]"
    style="height: 100%; cursor: pointer"
    @click="$emit('view', item)"
  >
    <!-- Card Header with Image & Rarity -->
    <div class="d-flex align-start pa-4 pb-3">
      <!-- Avatar (clickable if image exists) -->
      <v-avatar
        :color="item.image_url ? undefined : 'grey-lighten-2'"
        size="80"
        rounded="lg"
        class="mr-3 flex-shrink-0"
        :style="item.image_url ? 'cursor: pointer;' : ''"
        @click.stop="item.image_url ? openImagePreview() : null"
      >
        <v-img v-if="item.image_url" :src="`/uploads/${item.image_url}`" cover />
        <v-icon v-else icon="mdi-sword" size="40" color="grey" />
      </v-avatar>

      <!-- Name & Metadata -->
      <div class="flex-grow-1" style="min-width: 0">
        <h3 class="text-h6 mb-2" style="line-height: 1.2">{{ item.name }}</h3>

        <!-- Type & Rarity Chips -->
        <div v-if="item.metadata?.type || item.metadata?.rarity" class="d-flex flex-wrap gap-1 mb-2">
          <v-chip
            v-if="item.metadata?.type"
            :prepend-icon="getItemTypeIcon(item.metadata.type)"
            size="x-small"
            color="primary"
            variant="tonal"
          >
            {{ $t(`items.types.${item.metadata.type}`) }}
          </v-chip>
          <v-chip
            v-if="item.metadata?.rarity"
            :color="getRarityColor(item.metadata.rarity)"
            size="x-small"
            variant="flat"
          >
            {{ $t(`items.rarities.${item.metadata.rarity}`) }}
          </v-chip>
        </div>

        <!-- Value & Weight (always shown, takes same vertical space) -->
        <div
          class="text-caption text-medium-emphasis"
          :style="{ minHeight: item.metadata?.type || item.metadata?.rarity ? '20px' : '44px' }"
        >
          <span v-if="item.metadata?.value">{{ item.metadata.value }}</span>
          <span v-if="item.metadata?.value && item.metadata?.weight"> • </span>
          <span v-if="item.metadata?.weight">{{ item.metadata.weight }}</span>
        </div>
      </div>
    </div>

    <!-- Description (Fixed 3 lines) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0">
      <div class="item-description">
        <p v-if="item.description" class="text-body-2 text-medium-emphasis mb-0">
          {{ item.description }}
        </p>
        <p v-else class="text-body-2 text-disabled mb-0 font-italic">
          {{ $t('common.noDescription') }}
        </p>
      </div>
    </v-card-text>

    <!-- Info Badges (Bottom) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0; margin-top: auto">
      <!-- Count Badges (Owners, Locations, Documents, Images, Lore) -->
      <div class="d-flex flex-wrap" style="gap: 6px">
        <!-- Owners Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-account"
              size="small"
              variant="outlined"
              :color="counts.owners > 0 ? 'primary' : undefined"
            >
              {{ counts.owners }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-account"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('items.badgeTooltips.owners') }}</span>
        </v-tooltip>

        <!-- Locations Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-map-marker"
              size="small"
              variant="outlined"
              :color="counts.locations > 0 ? 'primary' : undefined"
            >
              {{ counts.locations }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-map-marker"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('items.badgeTooltips.locations') }}</span>
        </v-tooltip>

        <!-- Lore Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-book-open-variant"
              size="small"
              variant="outlined"
              :color="counts.lore > 0 ? 'primary' : undefined"
            >
              {{ counts.lore }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-book-open-variant"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('items.badgeTooltips.lore') }}</span>
        </v-tooltip>

        <!-- Documents Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-file-document"
              size="small"
              variant="outlined"
              :color="counts.documents > 0 ? 'primary' : undefined"
            >
              {{ counts.documents }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-file-document"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('items.badgeTooltips.documents') }}</span>
        </v-tooltip>

        <!-- Images Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-image"
              size="small"
              variant="outlined"
              :color="counts.images > 0 ? 'primary' : undefined"
            >
              {{ counts.images }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-image"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('items.badgeTooltips.images') }}</span>
        </v-tooltip>
      </div>
    </v-card-text>

    <!-- Actions -->
    <v-divider />
    <v-card-actions class="px-4">
      <v-btn icon="mdi-eye" size="small" variant="text" @click.stop="$emit('view', item)">
        <v-icon>mdi-eye</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.view') }}
        </v-tooltip>
      </v-btn>
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', item)">
        <v-icon>mdi-pencil</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.edit') }}
        </v-tooltip>
      </v-btn>
      <v-spacer />
      <v-btn
        icon="mdi-download"
        size="small"
        variant="text"
        :disabled="!item.image_url"
        @click.stop="$emit('download', item)"
      >
        <v-icon>mdi-download</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.download') }}
        </v-tooltip>
      </v-btn>
      <v-btn
        icon="mdi-delete"
        size="small"
        variant="text"
        color="error"
        @click.stop="$emit('delete', item)"
      >
        <v-icon>mdi-delete</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.delete') }}
        </v-tooltip>
      </v-btn>
    </v-card-actions>
  </v-card>

  <!-- Image Preview Dialog -->
  <ImagePreviewDialog
    v-model="showImagePreview"
    :image-url="`/uploads/${item.image_url}`"
    :title="item.name"
    :subtitle="previewSubtitle"
    :chips="previewChips"
    :download-file-name="item.name"
  />
</template>

<script setup lang="ts">
import type { Item } from '~~/types/item'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'

interface Props {
  item: Item
  isHighlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isHighlighted: false,
})

defineEmits<{
  view: [item: Item]
  edit: [item: Item]
  download: [item: Item]
  delete: [item: Item]
}>()

const { getCounts } = useItemCounts()
const { t } = useI18n()

// Get counts reactively from the composable
const counts = computed(() => getCounts(props.item.id) || props.item._counts)

// Image Preview State
const showImagePreview = ref(false)

function openImagePreview() {
  if (!props.item.image_url) return
  showImagePreview.value = true
}

// Build chips for preview dialog
const previewChips = computed(() => {
  const chips = []

  if (props.item.metadata?.type) {
    chips.push({
      text: t(`items.types.${props.item.metadata.type}`),
      icon: getItemTypeIcon(props.item.metadata.type),
      color: 'primary',
      variant: 'tonal' as const,
    })
  }

  if (props.item.metadata?.rarity) {
    chips.push({
      text: t(`items.rarities.${props.item.metadata.rarity}`),
      color: getRarityColor(props.item.metadata.rarity),
      variant: 'flat' as const,
    })
  }

  return chips
})

// Build subtitle for preview dialog
const previewSubtitle = computed(() => {
  const parts = []
  if (props.item.metadata?.value) parts.push(props.item.metadata.value)
  if (props.item.metadata?.weight) parts.push(props.item.metadata.weight)
  return parts.join(' • ')
})

// Helper function for rarity colors
function getRarityColor(rarity: string) {
  const colors: Record<string, string> = {
    common: 'grey',
    uncommon: 'green',
    rare: 'blue',
    very_rare: 'purple',
    legendary: 'orange',
    artifact: 'red',
  }
  return colors[rarity] || 'grey'
}

// Icon helper for item types
function getItemTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    weapon: 'mdi-sword',
    armor: 'mdi-shield',
    potion: 'mdi-bottle-tonic',
    scroll: 'mdi-script-text',
    wand: 'mdi-magic-staff',
    ring: 'mdi-ring',
    wondrous: 'mdi-star-circle',
    tool: 'mdi-hammer-wrench',
    consumable: 'mdi-fire',
    treasure: 'mdi-treasure-chest',
    quest: 'mdi-exclamation',
    other: 'mdi-package-variant',
  }
  return icons[type] || 'mdi-sword'
}
</script>

<style scoped>
.item-card {
  transition: all 0.3s ease;
}

.item-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 60px;
}

.highlighted-card {
  animation: highlight-pulse 2s ease-in-out;
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.4) !important;
}

@keyframes highlight-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(var(--v-theme-primary), 0.4);
  }
}
</style>
