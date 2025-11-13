<template>
  <v-card
    :id="`faction-${faction.id}`"
    hover
    :class="['d-flex flex-column faction-card', { 'highlighted-card': isHighlighted }]"
    style="height: 100%; cursor: pointer"
    @click="$emit('view', faction)"
  >
    <!-- Card Header with Image & Type -->
    <div class="d-flex align-start pa-4 pb-3">
      <!-- Avatar (clickable if image exists) -->
      <v-avatar
        :color="faction.image_url ? undefined : 'grey-lighten-2'"
        size="80"
        rounded="lg"
        class="mr-3 flex-shrink-0"
        :style="faction.image_url ? 'cursor: pointer;' : ''"
        @click.stop="faction.image_url ? openImagePreview() : null"
      >
        <v-img v-if="faction.image_url" :src="`/uploads/${faction.image_url}`" cover />
        <v-icon v-else icon="mdi-shield-account" size="40" color="grey" />
      </v-avatar>

      <!-- Name & Metadata -->
      <div class="flex-grow-1" style="min-width: 0">
        <h3 class="text-h6 mb-2" style="line-height: 1.2">{{ faction.name }}</h3>

        <!-- Type & Alignment Chips -->
        <div
          v-if="faction.metadata?.type || faction.metadata?.alignment"
          class="d-flex flex-wrap gap-1 mb-2"
        >
          <v-chip
            v-if="faction.metadata?.type"
            :prepend-icon="getFactionTypeIcon(faction.metadata.type)"
            size="x-small"
            color="primary"
            variant="tonal"
          >
            {{ $t(`factions.types.${faction.metadata.type}`) }}
          </v-chip>
          <v-chip
            v-if="faction.metadata?.alignment"
            :prepend-icon="getAlignmentIcon(faction.metadata.alignment)"
            :color="getAlignmentColor(faction.metadata.alignment)"
            size="x-small"
            variant="flat"
          >
            {{ $t(`factions.alignments.${faction.metadata.alignment}`) }}
          </v-chip>
        </div>

        <!-- Leader (always shown, takes same vertical space) -->
        <div
          class="text-caption text-medium-emphasis"
          :style="{
            minHeight: faction.metadata?.type || faction.metadata?.alignment ? '20px' : '44px',
          }"
        >
          <span v-if="faction.leader_name">{{ $t('factions.leader') }}: {{ faction.leader_name }}</span>
        </div>
      </div>
    </div>

    <!-- Description (Fixed 3 lines) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0">
      <div class="faction-description">
        <p v-if="faction.description" class="text-body-2 text-medium-emphasis mb-0">
          {{ faction.description }}
        </p>
        <p v-else class="text-body-2 text-disabled mb-0 font-italic">
          {{ $t('common.noDescription') }}
        </p>
      </div>
    </v-card-text>

    <!-- Info Badges (Bottom) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0; margin-top: auto">
      <!-- Count Badges (Members, Lore, Documents, Images) -->
      <div class="d-flex flex-wrap" style="gap: 6px">
        <!-- Members Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-account-group"
              size="small"
              variant="outlined"
              :color="counts.members > 0 ? 'primary' : undefined"
            >
              {{ counts.members }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-account-group"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('factions.badgeTooltips.members') }}</span>
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
          <span>{{ $t('factions.badgeTooltips.lore') }}</span>
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
          <span>{{ $t('factions.badgeTooltips.documents') }}</span>
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
          <span>{{ $t('factions.badgeTooltips.images') }}</span>
        </v-tooltip>
      </div>
    </v-card-text>

    <!-- Actions -->
    <v-divider />
    <v-card-actions class="px-4">
      <v-btn icon="mdi-eye" size="small" variant="text" @click.stop="$emit('view', faction)">
        <v-icon>mdi-eye</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.view') }}
        </v-tooltip>
      </v-btn>
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', faction)">
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
        :disabled="!faction.image_url"
        @click.stop="$emit('download', faction)"
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
        @click.stop="$emit('delete', faction)"
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
    :image-url="`/uploads/${faction.image_url}`"
    :title="faction.name"
    :subtitle="previewSubtitle"
    :chips="previewChips"
    :download-file-name="faction.name"
  />
</template>

<script setup lang="ts">
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'

interface Faction {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  leader_name?: string | null
  metadata?: {
    type?: string
    size?: string
    alignment?: string
  } | null
  _counts?: {
    members: number
    lore: number
    documents: number
    images: number
  }
}

interface Props {
  faction: Faction
  isHighlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isHighlighted: false,
})

defineEmits<{
  view: [faction: Faction]
  edit: [faction: Faction]
  download: [faction: Faction]
  delete: [faction: Faction]
}>()

const { getCounts } = useFactionCounts()
const { t } = useI18n()

// Get counts reactively from the composable
const counts = computed(() => getCounts(props.faction.id) || props.faction._counts)

// Image Preview State
const showImagePreview = ref(false)

function openImagePreview() {
  if (!props.faction.image_url) return
  showImagePreview.value = true
}

// Build chips for preview dialog
const previewChips = computed(() => {
  const chips = []

  if (props.faction.metadata?.type) {
    chips.push({
      text: t(`factions.types.${props.faction.metadata.type}`),
      icon: getFactionTypeIcon(props.faction.metadata.type),
      color: 'primary',
      variant: 'tonal' as const,
    })
  }

  if (props.faction.metadata?.alignment) {
    chips.push({
      text: t(`factions.alignments.${props.faction.metadata.alignment}`),
      icon: getAlignmentIcon(props.faction.metadata.alignment),
      color: getAlignmentColor(props.faction.metadata.alignment),
      variant: 'flat' as const,
    })
  }

  return chips
})

// Build subtitle for preview dialog
const previewSubtitle = computed(() => {
  const parts = []
  if (props.faction.leader_name) parts.push(`${t('factions.leader')}: ${props.faction.leader_name}`)
  if (props.faction.metadata?.size) parts.push(t(`factions.sizes.${props.faction.metadata.size}`))
  return parts.join(' • ')
})

// Icon helpers
function getFactionTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    guild: 'mdi-hammer-wrench',
    government: 'mdi-bank',
    military: 'mdi-sword-cross',
    criminal: 'mdi-skull',
    religious: 'mdi-church',
    merchant: 'mdi-cart',
    arcane: 'mdi-wizard-hat',
    secret: 'mdi-eye-off',
    mercenary: 'mdi-sword',
    noble: 'mdi-crown',
  }
  return icons[type] || 'mdi-shield-account'
}

function getAlignmentIcon(alignment: string): string {
  const icons: Record<string, string> = {
    lawful_good: 'mdi-shield-check',
    neutral_good: 'mdi-heart',
    chaotic_good: 'mdi-hand-heart',
    lawful_neutral: 'mdi-scale-balance',
    true_neutral: 'mdi-minus-circle',
    chaotic_neutral: 'mdi-dice-multiple',
    lawful_evil: 'mdi-gavel',
    neutral_evil: 'mdi-skull',
    chaotic_evil: 'mdi-fire',
  }
  return icons[alignment] || 'mdi-help'
}

function getAlignmentColor(alignment: string): string {
  const colors: Record<string, string> = {
    lawful_good: 'blue',
    neutral_good: 'green',
    chaotic_good: 'cyan',
    lawful_neutral: 'grey',
    true_neutral: 'grey-darken-2',
    chaotic_neutral: 'orange',
    lawful_evil: 'red-darken-2',
    neutral_evil: 'red',
    chaotic_evil: 'red-darken-4',
  }
  return colors[alignment] || 'grey'
}
</script>

<style scoped>
.faction-card {
  transition: all 0.3s ease;
}

.faction-description {
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
