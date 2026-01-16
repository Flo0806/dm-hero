<template>
  <v-dialog v-model="internalShow" max-width="900" scrollable>
    <v-card v-if="group">
      <!-- Header with Avatar & Name -->
      <v-card-title class="d-flex align-center pa-4">
        <v-avatar :color="group.color || 'grey-lighten-2'" size="64" rounded="lg" class="mr-4">
          <v-icon :icon="group.icon || 'mdi-folder-multiple'" size="32" :color="getContrastColor(group.color)" />
        </v-avatar>
        <div class="flex-grow-1">
          <h2 class="text-h5">{{ group.name }}</h2>
          <div class="text-body-2 text-medium-emphasis">
            {{ $t('groups.memberCount', totalMembers) }}
          </div>
        </div>
      </v-card-title>

      <v-divider />

      <!-- Description (if exists) -->
      <v-card-text v-if="group.description" class="py-3">
        <p class="text-body-2 mb-0">{{ group.description }}</p>
      </v-card-text>

      <v-divider v-if="group.description" />

      <!-- Tabs by Entity Type -->
      <v-tabs v-model="activeTab" bg-color="surface">
        <v-tab value="all">
          <v-icon start>mdi-view-list</v-icon>
          {{ $t('groups.all') }}
          <v-chip size="x-small" class="ml-2">{{ totalMembers }}</v-chip>
        </v-tab>
        <v-tab v-for="tab in visibleTabs" :key="tab.type" :value="tab.type">
          <v-icon start>{{ tab.icon }}</v-icon>
          {{ tab.label }}
          <v-chip size="x-small" class="ml-2">{{ tab.count }}</v-chip>
        </v-tab>
      </v-tabs>

      <v-divider />

      <!-- Tab Content -->
      <v-card-text style="max-height: 500px; overflow-y: auto">
        <v-window v-model="activeTab">
          <!-- All Members Tab -->
          <v-window-item value="all">
            <GroupMembersList
              :members="members"
              :loading="loading"
              @remove="removeMember"
              @click="handleMemberClick"
            />
          </v-window-item>

          <!-- Entity Type Tabs -->
          <v-window-item v-for="tab in visibleTabs" :key="tab.type" :value="tab.type">
            <GroupMembersList
              :members="getMembersByType(tab.type)"
              :loading="loading"
              @remove="removeMember"
              @click="handleMemberClick"
            />
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <!-- Footer Actions -->
      <v-card-actions class="px-4">
        <v-btn variant="text" prepend-icon="mdi-pencil" @click="$emit('edit', group)">
          {{ $t('common.edit') }}
        </v-btn>
        <v-btn variant="text" prepend-icon="mdi-plus" color="primary" @click="$emit('add-entities', group)">
          {{ $t('groups.addEntities') }}
        </v-btn>
        <v-btn
          variant="text"
          prepend-icon="mdi-delete-sweep"
          color="error"
          :disabled="totalMembers === 0"
          @click="$emit('delete-all', group)"
        >
          {{ $t('groups.deleteAll') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { getContrastColor, type EntityGroup, type GroupMember } from '~~/types/group'
import GroupMembersList from './GroupMembersList.vue'

const { t } = useI18n()

interface Props {
  modelValue: boolean
  group: EntityGroup | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [group: EntityGroup]
  'add-entities': [group: EntityGroup]
  'delete-all': [group: EntityGroup]
  'member-removed': [groupId: number]
  'member-click': [entityId: number, entityType: string]
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const activeTab = ref('all')
const loading = ref(false)
const members = ref<GroupMember[]>([])

// Entity type configuration
const entityTypes = [
  { type: 'NPC', icon: 'mdi-account-group', label: t('npcs.title') },
  { type: 'Location', icon: 'mdi-map-marker', label: t('locations.title') },
  { type: 'Item', icon: 'mdi-sword', label: t('items.title') },
  { type: 'Faction', icon: 'mdi-shield-account', label: t('factions.title') },
  { type: 'Lore', icon: 'mdi-book-open-variant', label: t('lore.title') },
  { type: 'Player', icon: 'mdi-account-star', label: t('players.title') },
]

// Calculate counts per type
const countsByType = computed(() => {
  const counts: Record<string, number> = {}
  for (const member of members.value) {
    counts[member.entity_type] = (counts[member.entity_type] || 0) + 1
  }
  return counts
})

// Only show tabs with members
const visibleTabs = computed(() => {
  return entityTypes
    .filter((et) => (countsByType.value[et.type] || 0) > 0)
    .map((et) => ({
      ...et,
      count: countsByType.value[et.type] || 0,
    }))
})

const totalMembers = computed(() => members.value.length)

// Filter members by type
function getMembersByType(type: string): GroupMember[] {
  return members.value.filter((m) => m.entity_type === type)
}

// Load members when dialog opens
watch(
  () => [props.modelValue, props.group?.id] as const,
  async ([isVisible, groupId]) => {
    if (isVisible && groupId) {
      await loadMembers(groupId)
    }
  },
  { immediate: true },
)

async function loadMembers(groupId: number) {
  loading.value = true
  const data = await $fetch<GroupMember[]>(`/api/groups/${groupId}/members`)
  members.value = data
  loading.value = false
}

// Expose refresh method for parent to call after adding entities
async function refresh() {
  if (props.group?.id) {
    await loadMembers(props.group.id)
  }
}

defineExpose({ refresh })

async function removeMember(entityId: number) {
  if (!props.group) return
  await $fetch(`/api/groups/${props.group.id}/members/${entityId}`, { method: 'DELETE' })
  members.value = members.value.filter((m) => m.entity_id !== entityId)
  emit('member-removed', props.group.id)
}

function handleMemberClick(entityId: number, entityType: string) {
  emit('member-click', entityId, entityType)
}

function close() {
  emit('update:modelValue', false)
  activeTab.value = 'all'
}

</script>
