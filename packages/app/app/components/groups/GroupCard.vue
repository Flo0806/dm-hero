<template>
  <v-card
    :id="`group-${group.id}`"
    hover
    :class="['d-flex flex-column group-card', { 'highlighted-card': isHighlighted }]"
    style="height: 100%; cursor: pointer"
    @click="$emit('view', group)"
    @contextmenu.prevent="openContextMenu"
  >
    <!-- Pin Button (top right) -->
    <SharedPinButton
      :group-id="group.id"
      variant="icon"
      size="small"
      class="pin-button"
      @click.stop
    />

    <!-- Card Header with Icon & Name -->
    <div class="d-flex align-start pa-4 pb-3">
      <!-- Icon Avatar -->
      <v-avatar :color="group.color || 'grey-lighten-2'" size="64" rounded="lg" class="mr-3 flex-shrink-0">
        <v-icon :icon="group.icon || 'mdi-folder-multiple'" size="32" :color="getContrastColor(group.color)" />
      </v-avatar>

      <!-- Name & Description -->
      <div class="flex-grow-1" style="min-width: 0">
        <h3 class="text-h6 mb-2" style="line-height: 1.2">{{ group.name }}</h3>

        <!-- Member Count -->
        <div class="text-caption text-medium-emphasis">
          <span v-if="totalMembers > 0">{{ $t('groups.memberCount', totalMembers) }}</span>
          <span v-else class="text-disabled">{{ $t('groups.noMembers') }}</span>
        </div>
      </div>
    </div>

    <!-- Description (Fixed 3 lines) -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0">
      <div class="group-description">
        <p v-if="group.description" class="text-body-2 text-medium-emphasis mb-0">
          {{ group.description }}
        </p>
        <p v-else class="text-body-2 text-disabled mb-0 font-italic">
          {{ $t('common.noDescription') }}
        </p>
      </div>
    </v-card-text>

    <!-- Entity Type Badges -->
    <v-card-text class="pt-0 pb-3" style="flex-grow: 0; margin-top: auto">
      <div class="d-flex flex-wrap" style="gap: 6px">
        <v-tooltip v-for="(count, type) in sortedTypeCounts" :key="type" location="top">
          <template #activator="{ props: tooltipProps }">
            <v-chip
              v-bind="tooltipProps"
              :prepend-icon="getEntityTypeIcon(type)"
              size="small"
              variant="outlined"
              :color="count > 0 ? 'primary' : undefined"
              class="clickable-chip"
              @click.stop="$emit('open-tab', group, type as string)"
            >
              {{ count }}
            </v-chip>
          </template>
          <span>{{ $t(`entityTypes.${type}`) }}</span>
        </v-tooltip>
      </div>
    </v-card-text>

    <!-- Actions -->
    <v-divider />
    <v-card-actions class="px-4">
      <v-btn icon="mdi-eye" size="small" variant="text" @click.stop="$emit('view', group)">
        <v-icon>mdi-eye</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ $t('common.view') }}</v-tooltip>
      </v-btn>
      <v-spacer />
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', group)">
        <v-icon>mdi-pencil</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ $t('common.edit') }}</v-tooltip>
      </v-btn>
      <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="$emit('delete', group)">
        <v-icon>mdi-delete</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ $t('common.delete') }}</v-tooltip>
      </v-btn>
    </v-card-actions>
  </v-card>

  <!-- Context Menu -->
  <GroupsGroupAddMemberMenu
    v-model="showContextMenu"
    :position="contextMenuPosition"
    @select="handleAddMemberSelect"
  />
</template>

<script setup lang="ts">
import { getContrastColor, type EntityGroup, type GroupCounts } from '~~/types/group'

interface Props {
  group: EntityGroup
  counts?: GroupCounts | null
  isHighlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  counts: null,
  isHighlighted: false,
})

const emit = defineEmits<{
  view: [group: EntityGroup]
  edit: [group: EntityGroup]
  delete: [group: EntityGroup]
  'add-member': [group: EntityGroup, entityType: string]
  'open-tab': [group: EntityGroup, entityType: string]
}>()

// Context menu state
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

function openContextMenu(event: MouseEvent) {
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  showContextMenu.value = true
}

function handleAddMemberSelect(entityType: string) {
  emit('add-member', props.group, entityType)
}

// Total members count
const totalMembers = computed(() => {
  if (props.counts) return props.counts.total
  if (props.group._counts) return props.group._counts.total
  return 0
})

// Entity type counts (only show types with members)
const sortedTypeCounts = computed(() => {
  const byType = props.counts?.byType || props.group._counts?.byType || {}
  // Show all entity types in consistent order
  const order = ['NPC', 'Location', 'Item', 'Faction', 'Lore', 'Player']
  const result: Record<string, number> = {}
  for (const type of order) {
    if (byType[type] !== undefined || totalMembers.value > 0) {
      result[type] = byType[type] || 0
    }
  }
  // Only show badges if there are any members at all
  if (totalMembers.value === 0) return {}
  return result
})

// Get icon for entity type
function getEntityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Location: 'mdi-map-marker',
    Item: 'mdi-sword',
    Faction: 'mdi-shield-account',
    Lore: 'mdi-book-open-variant',
    Player: 'mdi-account-star',
  }
  return icons[type] || 'mdi-help'
}

</script>

<style scoped>
.group-card {
  transition: all 0.3s ease;
  position: relative;
}

.pin-button {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.group-description {
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
