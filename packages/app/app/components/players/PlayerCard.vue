<template>
  <v-card
    :id="`player-${player.id}`"
    hover
    :class="['d-flex flex-column player-card', { 'highlighted-card': isHighlighted }]"
    style="height: 100%; cursor: pointer"
    @click="$emit('view', player)"
    @contextmenu.prevent="quickLink.openContextMenu"
  >
    <!-- Pin Button (top right) -->
    <SharedPinButton
      :entity-id="player.id"
      variant="icon"
      size="small"
      class="pin-button"
      @click.stop
    />

    <!-- Card Header with Image -->
    <div class="d-flex align-start pa-4 pb-3">
      <!-- Avatar (clickable if image exists) -->
      <v-avatar
        :color="player.image_url ? undefined : 'grey-lighten-2'"
        size="80"
        rounded="lg"
        class="mr-3 flex-shrink-0"
        :style="player.image_url ? 'cursor: pointer;' : ''"
        @click.stop="player.image_url ? openImagePreview() : null"
      >
        <v-img v-if="player.image_url" :src="`/uploads/${player.image_url}`" cover />
        <v-icon v-else icon="mdi-account-star" size="40" color="grey" />
      </v-avatar>

      <!-- Name & Contact Info -->
      <div class="flex-grow-1" style="min-width: 0">
        <h3 class="text-h6 mb-2" style="line-height: 1.2">{{ player.name }}</h3>

        <!-- Contact Info -->
        <div class="d-flex flex-column" style="gap: 4px">
          <div v-if="player.metadata?.discord" class="text-caption text-medium-emphasis d-flex align-center">
            <v-icon size="14" class="mr-1">mdi-discord</v-icon>
            {{ player.metadata.discord }}
          </div>
          <div v-if="player.metadata?.email" class="text-caption text-medium-emphasis d-flex align-center">
            <v-icon size="14" class="mr-1">mdi-email</v-icon>
            {{ player.metadata.email }}
          </div>
          <div v-if="player.metadata?.phone" class="text-caption text-medium-emphasis d-flex align-center">
            <v-icon size="14" class="mr-1">mdi-phone</v-icon>
            {{ player.metadata.phone }}
          </div>
        </div>
      </div>
    </div>

    <!-- Description (Fixed 3 lines) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0">
      <div class="player-description">
        <p v-if="player.description" class="text-body-2 text-medium-emphasis mb-0">
          {{ player.description }}
        </p>
        <p v-else class="text-body-2 text-disabled mb-0 font-italic">
          {{ $t('common.noDescription') }}
        </p>
      </div>
    </v-card-text>

    <!-- Info Badges (Bottom) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0; margin-top: auto">
      <!-- Group Badges -->
      <div v-if="counts?.groups?.length" class="d-flex flex-wrap mb-2" style="gap: 6px">
        <v-chip
          v-for="group in counts.groups"
          :key="group.id"
          :prepend-icon="group.icon || 'mdi-folder-multiple'"
          :color="group.color || undefined"
          size="small"
          variant="tonal"
          @click.stop="$emit('open-group', group.id)"
        >
          {{ group.name }}
        </v-chip>
      </div>

      <div class="d-flex flex-wrap" style="gap: 6px">
        <!-- Characters Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-account-group"
              size="small"
              variant="outlined"
              :color="counts.characters > 0 ? 'primary' : undefined"
              class="clickable-chip"
              @click.stop="$emit('open-tab', player, 'characters')"
            >
              {{ counts.characters }}
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
          <span>{{ $t('players.badgeTooltips.characters') }}</span>
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
              class="clickable-chip"
              @click.stop="$emit('open-tab', player, 'items')"
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
          <span>{{ $t('players.badgeTooltips.items') }}</span>
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
              class="clickable-chip"
              @click.stop="$emit('open-tab', player, 'locations')"
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
          <span>{{ $t('players.badgeTooltips.locations') }}</span>
        </v-tooltip>

        <!-- Factions Count Badge -->
        <v-tooltip location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-if="counts"
              v-bind="tooltipProps"
              prepend-icon="mdi-shield"
              size="small"
              variant="outlined"
              :color="counts.factions > 0 ? 'primary' : undefined"
              class="clickable-chip"
              @click.stop="$emit('open-tab', player, 'factions')"
            >
              {{ counts.factions }}
            </v-chip>
            <v-chip
              v-else
              v-bind="tooltipProps"
              prepend-icon="mdi-shield"
              size="small"
              variant="outlined"
              disabled
            >
              <v-progress-circular indeterminate size="12" width="2" />
            </v-chip>
          </template>
          <span>{{ $t('players.badgeTooltips.factions') }}</span>
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
              class="clickable-chip"
              @click.stop="$emit('open-tab', player, 'lore')"
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
          <span>{{ $t('players.badgeTooltips.lore') }}</span>
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
              class="clickable-chip"
              @click.stop="$emit('open-tab', player, 'documents')"
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
          <span>{{ $t('players.badgeTooltips.documents') }}</span>
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
              class="clickable-chip"
              @click.stop="$emit('open-tab', player, 'images')"
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
          <span>{{ $t('players.badgeTooltips.images') }}</span>
        </v-tooltip>
      </div>
    </v-card-text>

    <!-- Actions -->
    <v-divider />
    <v-card-actions class="px-4">
      <v-btn icon="mdi-eye" size="small" variant="text" @click.stop="$emit('view', player)">
        <v-icon>mdi-eye</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.view') }}
        </v-tooltip>
      </v-btn>
      <v-btn icon="mdi-graph" size="small" variant="text" color="primary" @click.stop="$emit('chaos', player)">
        <v-icon>mdi-graph</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('chaos.title') }}
        </v-tooltip>
      </v-btn>
      <v-btn
        icon="mdi-download"
        size="small"
        variant="text"
        :disabled="!player.image_url"
        @click.stop="$emit('download', player)"
      >
        <v-icon>mdi-download</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.download') }}
        </v-tooltip>
      </v-btn>
      <v-spacer />
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', player)">
        <v-icon>mdi-pencil</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('common.edit') }}
        </v-tooltip>
      </v-btn>
      <v-btn
        icon="mdi-delete"
        size="small"
        variant="text"
        color="error"
        @click.stop="$emit('delete', player)"
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
    :image-url="`/uploads/${player.image_url}`"
    :title="player.name"
    :subtitle="previewSubtitle"
    :download-file-name="player.name"
  />

  <!-- Quick Link Context Menu -->
  <QuickLinkContextMenu
    v-model="quickLink.showContextMenu.value"
    v-bind="quickLink.contextMenuProps.value"
    @select="quickLink.handleQuickLinkSelect"
    @add-to-group="quickLink.handleAddToGroup"
    @create-group="quickLink.handleCreateGroup"
  />

  <!-- Quick Link Entity Select Dialog -->
  <QuickLinkEntitySelectDialog
    v-model="quickLink.showEntitySelectDialog.value"
    v-bind="quickLink.entitySelectDialogProps.value"
    @linked="quickLink.handleLinked"
  />
</template>

<script setup lang="ts">
import type { Player } from '~~/types/player'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import QuickLinkContextMenu from '~/components/shared/QuickLinkContextMenu.vue'
import QuickLinkEntitySelectDialog from '~/components/shared/QuickLinkEntitySelectDialog.vue'

interface Props {
  player: Player
  isHighlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isHighlighted: false,
})

const emit = defineEmits<{
  view: [player: Player]
  edit: [player: Player]
  download: [player: Player]
  delete: [player: Player]
  chaos: [player: Player]
  'open-group': [groupId: number]
  'add-to-group': [payload: { entityId: number; groupId: number }]
  'create-group': [entityId: number]
  linked: []
  'open-tab': [player: Player, tab: string]
}>()

// Get counts reactively from the composable (shared cache)
const { getCounts } = usePlayerCounts()
const counts = computed(() => getCounts(props.player.id) || props.player._counts)

// Quick Link - using composable for all state and handlers
const quickLink = useQuickLink({
  entityId: props.player.id,
  entityName: props.player.name,
  sourceType: 'Player',
  groups: computed(() => counts.value?.groups),
  onLinked: () => emit('linked'),
  onAddToGroup: (groupId) => emit('add-to-group', { entityId: props.player.id, groupId }),
  onCreateGroup: () => emit('create-group', props.player.id),
})

// Image Preview State
const showImagePreview = ref(false)

function openImagePreview() {
  if (!props.player.image_url) return
  showImagePreview.value = true
}

// Build subtitle for preview dialog
const previewSubtitle = computed(() => {
  const parts = []
  if (props.player.metadata?.discord) parts.push(props.player.metadata.discord)
  if (props.player.metadata?.email) parts.push(props.player.metadata.email)
  return parts.join(' • ')
})
</script>

<style scoped>
.player-card {
  transition: all 0.3s ease;
  position: relative;
}

.pin-button {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.player-description {
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

/* Clickable count badges with hover effect */
.clickable-chip {
  cursor: pointer;
  transition: transform 0.15s ease;
}

.clickable-chip:hover {
  transform: scale(1.1);
}
</style>
