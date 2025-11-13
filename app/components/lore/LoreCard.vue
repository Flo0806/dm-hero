<template>
  <v-card
    :id="`lore-${lore.id}`"
    hover
    :class="['d-flex flex-column lore-card', { 'highlighted-card': isHighlighted }]"
    style="height: 100%; cursor: pointer"
    @click="$emit('view', lore)"
  >
    <!-- Card Header with Image & Type -->
    <div class="d-flex align-start pa-4 pb-3">
      <!-- Avatar (clickable if image exists) -->
      <v-avatar
        :color="lore.image_url ? undefined : 'grey-lighten-2'"
        size="80"
        rounded="lg"
        class="mr-3 flex-shrink-0"
        :style="lore.image_url ? 'cursor: pointer;' : ''"
        @click.stop="lore.image_url ? openImagePreview() : null"
      >
        <v-img v-if="lore.image_url" :src="`/uploads/${lore.image_url}`" cover />
        <v-icon v-else icon="mdi-book-open-variant" size="40" color="grey" />
      </v-avatar>

      <!-- Name & Metadata -->
      <div class="flex-grow-1" style="min-width: 0">
        <h3 class="text-h6 mb-2" style="line-height: 1.2">{{ lore.name }}</h3>

        <!-- Type Chip -->
        <div v-if="lore.metadata?.type" class="d-flex flex-wrap gap-1 mb-2">
          <v-chip
            :prepend-icon="getLoreTypeIcon(lore.metadata.type)"
            size="x-small"
            color="primary"
            variant="tonal"
          >
            {{ $t(`lore.types.${lore.metadata.type}`) }}
          </v-chip>
        </div>

        <!-- Date (for events) - always shown, takes same vertical space -->
        <div
          class="text-caption text-medium-emphasis"
          :style="{ minHeight: lore.metadata?.type ? '20px' : '44px' }"
        >
          <template v-if="lore.metadata?.date">
            <v-icon icon="mdi-calendar" size="14" class="mr-1" />
            {{ lore.metadata.date }}
          </template>
        </div>
      </div>
    </div>

    <!-- Description (Fixed 3 lines) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0">
      <div class="lore-description">
        <p v-if="lore.description" class="text-body-2 text-medium-emphasis mb-0">
          {{ lore.description }}
        </p>
        <p v-else class="text-body-2 text-disabled mb-0 font-italic">
          {{ $t('common.noDescription') }}
        </p>
      </div>
    </v-card-text>

    <!-- Info Badges (Bottom) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0; margin-top: auto">
      <!-- Count Badges (NPCs, Items, Factions, Documents, Images) -->
      <div class="d-flex flex-wrap" style="gap: 6px">
        <!-- NPCs Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-account"
              size="small"
              variant="outlined"
              :color="counts.npcs > 0 ? 'primary' : undefined"
            >
              {{ counts.npcs }}
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
          <span>{{ $t('lore.badgeTooltips.npcs') }}</span>
        </v-tooltip>

        <!-- Items Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-sword"
              size="small"
              variant="outlined"
              :color="counts.items > 0 ? 'primary' : undefined"
            >
              {{ counts.items }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-sword"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('lore.badgeTooltips.items') }}</span>
        </v-tooltip>

        <!-- Factions Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-shield-account"
              size="small"
              variant="outlined"
              :color="counts.factions > 0 ? 'primary' : undefined"
            >
              {{ counts.factions }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-shield-account"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('lore.badgeTooltips.factions') }}</span>
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
          <span>{{ $t('lore.badgeTooltips.documents') }}</span>
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
          <span>{{ $t('lore.badgeTooltips.images') }}</span>
        </v-tooltip>
      </div>
    </v-card-text>

    <!-- Actions -->
    <v-divider />
    <v-card-actions class="px-4">
      <v-btn icon="mdi-eye" size="small" variant="text" @click.stop="$emit('view', lore)">
        <v-icon>mdi-eye</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.view') }}
        </v-tooltip>
      </v-btn>
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', lore)">
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
        :disabled="!lore.image_url"
        @click.stop="$emit('download', lore)"
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
        @click.stop="$emit('delete', lore)"
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
    :image-url="`/uploads/${lore.image_url}`"
    :title="lore.name"
    :subtitle="previewSubtitle"
    :chips="previewChips"
    :download-file-name="lore.name"
  />
</template>

<script setup lang="ts">
import type { Lore } from '../../../types/lore'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'

interface Props {
  lore: Lore
  isHighlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isHighlighted: false,
})

defineEmits<{
  view: [lore: Lore]
  edit: [lore: Lore]
  download: [lore: Lore]
  delete: [lore: Lore]
}>()

const { getCounts } = useLoreCounts()
const { t } = useI18n()

// Get counts reactively from the composable
const counts = computed(() => getCounts(props.lore.id) || props.lore._counts)

// Image Preview State
const showImagePreview = ref(false)

function openImagePreview() {
  if (!props.lore.image_url) return
  showImagePreview.value = true
}

// Build chips for preview dialog
const previewChips = computed(() => {
  const chips = []

  if (props.lore.metadata?.type) {
    chips.push({
      text: t(`lore.types.${props.lore.metadata.type}`),
      icon: getLoreTypeIcon(props.lore.metadata.type),
      color: 'primary',
      variant: 'tonal' as const,
    })
  }

  return chips
})

// Build subtitle for preview dialog
const previewSubtitle = computed(() => {
  const parts = []
  if (props.lore.metadata?.type) {
    parts.push(t(`lore.types.${props.lore.metadata.type}`))
  }
  if (props.lore.metadata?.date) {
    parts.push(props.lore.metadata.date)
  }
  return parts.join(' • ')
})

// Icon helper for lore types
function getLoreTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    object: 'mdi-cube',
    plant: 'mdi-flower',
    place: 'mdi-map-marker',
    event: 'mdi-calendar-star',
    creature: 'mdi-dragon',
    concept: 'mdi-lightbulb',
    magic: 'mdi-wizard-hat',
    religion: 'mdi-church',
  }
  return icons[type] || 'mdi-book-open-variant'
}
</script>

<style scoped>
.lore-card {
  transition: all 0.3s ease;
}

.lore-description {
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
