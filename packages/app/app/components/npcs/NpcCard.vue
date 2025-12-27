<template>
  <v-card
    :id="`npc-${npc.id}`"
    hover
    :class="['d-flex flex-column npc-card', { 'highlighted-card': isHighlighted }]"
    style="height: 100%; cursor: pointer"
    @click="$emit('view', npc)"
  >
    <!-- Pin Button (top right) -->
    <SharedPinButton
      :entity-id="npc.id"
      variant="icon"
      size="small"
      class="pin-button"
      @click.stop
    />

    <!-- Card Header with Image & Status -->
    <div class="d-flex align-start pa-4 pb-3">
      <!-- Avatar (clickable if image exists) -->
      <v-avatar
        :color="npc.image_url ? undefined : 'grey-lighten-2'"
        size="80"
        rounded="lg"
        class="mr-3 flex-shrink-0"
        :style="npc.image_url ? 'cursor: pointer;' : ''"
        @click.stop="npc.image_url ? openImagePreview() : null"
      >
        <v-img v-if="npc.image_url" :src="`/uploads/${npc.image_url}`" cover />
        <v-icon v-else icon="mdi-account" size="40" color="grey" />
      </v-avatar>

      <!-- Name & Metadata -->
      <div class="flex-grow-1" style="min-width: 0">
        <h3 class="text-h6 mb-2" style="line-height: 1.2">{{ npc.name }}</h3>

        <!-- Type & Status Chips -->
        <div v-if="npc.metadata?.type || npc.metadata?.status" class="d-flex flex-wrap gap-1 mb-2">
          <v-chip
            v-if="npc.metadata?.type"
            :prepend-icon="getNpcTypeIcon(npc.metadata.type)"
            size="x-small"
            color="primary"
            variant="tonal"
          >
            {{ $t(`npcs.types.${npc.metadata.type}`) }}
          </v-chip>
          <v-chip
            v-if="npc.metadata?.status"
            :prepend-icon="getNpcStatusIcon(npc.metadata.status)"
            :color="getNpcStatusColor(npc.metadata.status)"
            size="x-small"
            variant="flat"
          >
            {{ $t(`npcs.statuses.${npc.metadata.status}`) }}
          </v-chip>
        </div>

        <!-- Race & Class (always shown, takes same vertical space) -->
        <div
          class="text-caption text-medium-emphasis"
          :style="{ minHeight: npc.metadata?.type || npc.metadata?.status ? '20px' : '44px' }"
        >
          <span v-if="npc.metadata?.race">{{ getRaceDisplayName(npc.metadata.race) }}</span>
          <span v-if="npc.metadata?.race && npc.metadata?.class"> • </span>
          <span v-if="npc.metadata?.class">{{ getClassDisplayName(npc.metadata.class) }}</span>
        </div>
      </div>
    </div>

    <!-- Description (Fixed 3 lines) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0">
      <div class="npc-description">
        <p v-if="npc.description" class="text-body-2 text-medium-emphasis mb-0">
          {{ npc.description }}
        </p>
        <p v-else class="text-body-2 text-disabled mb-0 font-italic">
          {{ $t('common.noDescription') }}
        </p>
      </div>
    </v-card-text>

    <!-- Info Badges (Bottom) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0; margin-top: auto">
      <!-- Row 1: Metadata Badges (Location, Faction) - Fixed Height -->
      <div class="d-flex flex-wrap mb-2" style="gap: 6px; min-height: 28px">
        <!-- Location Badge -->
        <v-chip
          v-if="npc.metadata?.location"
          prepend-icon="mdi-map-marker"
          size="small"
          variant="outlined"
          color="primary"
        >
          {{ npc.metadata.location }}
        </v-chip>

        <!-- Faction Badge (async loaded) -->
        <v-chip
          v-if="counts?.factionName"
          prepend-icon="mdi-shield-account"
          size="small"
          variant="outlined"
          color="secondary"
        >
          {{ counts.factionName }}
        </v-chip>
      </div>

      <!-- Row 2: Count Badges (Relations, Items, Documents, Images) -->
      <div class="d-flex flex-wrap" style="gap: 6px">
        <!-- Relations Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-account-group"
              size="small"
              variant="outlined"
              :color="counts.relations > 0 ? 'primary' : undefined"
            >
              {{ counts.relations }}
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
          <span>{{ $t('npcs.badgeTooltips.relations') }}</span>
        </v-tooltip>

        <!-- Items Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-bag-personal"
              size="small"
              variant="outlined"
              :color="counts.items > 0 ? 'primary' : undefined"
            >
              {{ counts.items }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-bag-personal"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('npcs.badgeTooltips.items') }}</span>
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
              :color="(counts.locations || 0) > 0 ? 'primary' : undefined"
            >
              {{ counts.locations || 0 }}
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
          <span>{{ $t('npcs.badgeTooltips.locations') }}</span>
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
          <span>{{ $t('npcs.badgeTooltips.documents') }}</span>
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
          <span>{{ $t('npcs.badgeTooltips.images') }}</span>
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
              :color="(counts.lore || 0) > 0 ? 'primary' : undefined"
            >
              {{ counts.lore || 0 }}
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
          <span>{{ $t('npcs.badgeTooltips.lore') }}</span>
        </v-tooltip>

        <!-- Memberships Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-shield-account"
              size="small"
              variant="outlined"
              :color="counts.memberships > 0 ? 'primary' : undefined"
            >
              {{ counts.memberships }}
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
          <span>{{ $t('npcs.badgeTooltips.memberships') }}</span>
        </v-tooltip>

        <!-- Players Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-account-star"
              size="small"
              variant="outlined"
              :color="(counts.players || 0) > 0 ? 'primary' : undefined"
            >
              {{ counts.players || 0 }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-account-star"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('npcs.badgeTooltips.players') }}</span>
        </v-tooltip>
      </div>
    </v-card-text>

    <!-- Actions -->
    <v-divider />
    <v-card-actions class="px-4">
      <v-btn icon="mdi-eye" size="small" variant="text" @click.stop="$emit('view', npc)">
        <v-icon>mdi-eye</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.view') }}
        </v-tooltip>
      </v-btn>
      <v-btn icon size="small" variant="text" @click.stop="openChaosGraph">
        <v-icon>mdi-graph</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('chaos.title') }}
        </v-tooltip>
      </v-btn>
      <v-btn
        icon="mdi-download"
        size="small"
        variant="text"
        :disabled="!npc.image_url"
        @click.stop="$emit('download', npc)"
      >
        <v-icon>mdi-download</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.download') }}
        </v-tooltip>
      </v-btn>

      <v-spacer />
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', npc)">
        <v-icon>mdi-pencil</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.edit') }}
        </v-tooltip>
      </v-btn>
      <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="$emit('delete', npc)">
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
    :image-url="`/uploads/${npc.image_url}`"
    :title="npc.name"
    :subtitle="previewSubtitle"
    :chips="previewChips"
    :download-file-name="npc.name"
  />
</template>

<script setup lang="ts">
import type { NPC } from '~~/types/npc'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import { getNpcTypeIcon, getNpcStatusIcon, getNpcStatusColor } from '~/utils/npc-icons'

interface Props {
  npc: NPC
  isHighlighted?: boolean
  races?: Array<{ name: string; name_de?: string | null; name_en?: string | null }>
  classes?: Array<{ name: string; name_de?: string | null; name_en?: string | null }>
}

const props = withDefaults(defineProps<Props>(), {
  isHighlighted: false,
  races: () => [],
  classes: () => [],
})

defineEmits<{
  view: [npc: NPC]
  edit: [npc: NPC]
  download: [npc: NPC]
  delete: [npc: NPC]
}>()

const { locale, t } = useI18n()
const { getCounts } = useNpcCounts()
const router = useRouter()

// Navigate to Chaos Graph
function openChaosGraph() {
  router.push(`/chaos/${props.npc.id}`)
}

// Get counts reactively from the composable
const counts = computed(() => getCounts(props.npc.id) || props.npc._counts)

// Image Preview State
const showImagePreview = ref(false)

function openImagePreview() {
  if (!props.npc.image_url) return
  showImagePreview.value = true
}

// Build chips for preview dialog
const previewChips = computed(() => {
  const chips = []

  if (props.npc.metadata?.type) {
    chips.push({
      text: t(`npcs.types.${props.npc.metadata.type}`),
      icon: getNpcTypeIcon(props.npc.metadata.type),
      color: 'primary',
      variant: 'tonal' as const,
    })
  }

  if (props.npc.metadata?.status) {
    chips.push({
      text: t(`npcs.statuses.${props.npc.metadata.status}`),
      icon: getNpcStatusIcon(props.npc.metadata.status),
      color: getNpcStatusColor(props.npc.metadata.status),
      variant: 'flat' as const,
    })
  }

  return chips
})

// Build subtitle for preview dialog (Race • Class)
const previewSubtitle = computed(() => {
  const parts = []
  if (props.npc.metadata?.race) parts.push(getRaceDisplayName(props.npc.metadata.race))
  if (props.npc.metadata?.class) parts.push(getClassDisplayName(props.npc.metadata.class))
  return parts.join(' • ')
})

// Helper functions for display names
function getRaceDisplayName(raceName: string): string {
  const race = props.races.find((r) => r.name === raceName)
  if (!race) return raceName

  if (race.name_de && race.name_en) {
    return locale.value === 'de' ? race.name_de : race.name_en
  }
  return race.name
}

function getClassDisplayName(className: string): string {
  const classData = props.classes.find((c) => c.name === className)
  if (!classData) return className

  if (classData.name_de && classData.name_en) {
    return locale.value === 'de' ? classData.name_de : classData.name_en
  }
  return classData.name
}

// Icon helpers imported from ~/utils/npc-icons
</script>

<style scoped>
.npc-card {
  transition: all 0.3s ease;
  position: relative;
}

.pin-button {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.npc-description {
  display: -webkit-box;
  line-clamp: 3;
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
