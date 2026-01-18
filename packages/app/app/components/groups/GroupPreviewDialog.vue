<template>
  <v-dialog v-model="dialogOpen" max-width="600" scrollable>
    <v-card v-if="group">
      <!-- Header with Icon & Name -->
      <v-card-title class="d-flex align-center pa-4">
        <v-avatar :color="group.color || 'grey-lighten-2'" size="48" rounded="lg" class="mr-3">
          <v-icon :icon="group.icon || 'mdi-folder-multiple'" size="24" :color="getContrastColor(group.color)" />
        </v-avatar>
        <div class="flex-grow-1">
          <h3 class="text-h6">{{ group.name }}</h3>
          <div class="text-body-2 text-medium-emphasis">
            {{ $t('groups.memberCount', totalMembers) }}
          </div>
        </div>
        <SharedPinButton :group-id="groupId!" variant="icon" size="small" />
      </v-card-title>

      <v-divider />

      <!-- Description (if exists) -->
      <v-card-text v-if="group.description" class="py-3">
        <p class="text-body-2 mb-0">{{ group.description }}</p>
      </v-card-text>

      <v-divider v-if="group.description" />

      <!-- ALL Members (scrollable) -->
      <v-card-text style="max-height: 400px; overflow-y: auto">
        <div v-if="loading" class="d-flex justify-center py-4">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <div v-else-if="members.length === 0" class="text-center py-4 text-medium-emphasis">
          {{ $t('groups.noMembers') }}
        </div>

        <v-list v-else density="compact" class="pa-0">
          <v-list-item
            v-for="member in members"
            :key="member.entity_id"
            class="px-0 cursor-pointer"
            :class="{ 'bg-surface-light': selectedMemberId === member.entity_id }"
            @click="openMemberPreview(member)"
          >
            <template #prepend>
              <v-avatar size="32" :color="member.entity_image_url ? undefined : getTypeColor(member.entity_type)">
                <v-img v-if="member.entity_image_url" :src="`/uploads/${member.entity_image_url}`" cover />
                <v-icon v-else :icon="getTypeIcon(member.entity_type)" size="16" />
              </v-avatar>
            </template>
            <v-list-item-title class="text-body-2">{{ member.entity_name }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              {{ $t(`entityTypes.${member.entity_type}`) }}
            </v-list-item-subtitle>
            <template #append>
              <v-icon icon="mdi-chevron-right" size="small" class="text-medium-emphasis" />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-divider />

      <!-- Actions -->
      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-open-in-new" @click="goToGroupsPage">
          {{ $t('sessions.goToPage') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Loading state when group not yet loaded -->
    <v-card v-else>
      <v-card-text class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- Nested Entity Preview Dialog - opens ON TOP of group dialog -->
  <SharedEntityPreviewDialog
    v-model="showEntityPreview"
    :entity-id="previewEntityId"
    :entity-type="previewEntityType"
  />
</template>

<script setup lang="ts">
import { getContrastColor, type EntityGroup, type GroupMember } from '~~/types/group'
import type { EntityPreviewType } from '~/components/shared/EntityPreviewDialog.vue'

interface Props {
  modelValue: boolean
  groupId: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'member-click': [entityId: number, entityType: string]
}>()

const router = useRouter()

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const loading = ref(false)
const group = ref<EntityGroup | null>(null)
const members = ref<GroupMember[]>([])

// Nested entity preview state
const showEntityPreview = ref(false)
const previewEntityId = ref<number | null>(null)
const previewEntityType = ref<EntityPreviewType>('npc')
const selectedMemberId = ref<number | null>(null)

const totalMembers = computed(() => members.value.length)

// Type icons mapping
const typeIcons: Record<string, string> = {
  NPC: 'mdi-account',
  Location: 'mdi-map-marker',
  Item: 'mdi-sword',
  Faction: 'mdi-shield-account',
  Lore: 'mdi-book-open-variant',
  Player: 'mdi-account-star',
}

const typeColors: Record<string, string> = {
  NPC: '#D4A574',
  Location: '#8B7355',
  Item: '#CC8844',
  Faction: '#7B92AB',
  Lore: '#9B8B7A',
  Player: '#A8C686',
}

function getTypeIcon(type: string): string {
  return typeIcons[type] || 'mdi-help-circle-outline'
}

function getTypeColor(type: string): string {
  return typeColors[type] || '#888888'
}

// Load group and members when dialog opens
watch(
  () => [props.modelValue, props.groupId] as const,
  async ([isOpen, groupId]) => {
    if (isOpen && groupId) {
      await loadGroup(groupId)
    } else if (!isOpen) {
      // Reset selected member when dialog closes
      selectedMemberId.value = null
    }
  },
  { immediate: true },
)

async function loadGroup(groupId: number) {
  loading.value = true
  try {
    const [groupData, membersData] = await Promise.all([
      $fetch<EntityGroup>(`/api/groups/${groupId}`),
      $fetch<GroupMember[]>(`/api/groups/${groupId}/members`),
    ])
    group.value = groupData
    members.value = membersData
  } catch (error) {
    console.error('Failed to load group:', error)
    group.value = null
    members.value = []
  } finally {
    loading.value = false
  }
}

function openMemberPreview(member: GroupMember) {
  // Mark as selected for visual feedback
  selectedMemberId.value = member.entity_id

  // Open nested entity preview dialog (group dialog stays open!)
  previewEntityId.value = member.entity_id
  previewEntityType.value = member.entity_type.toLowerCase() as EntityPreviewType
  showEntityPreview.value = true

  // Also emit for backwards compatibility (in case parent wants to know)
  emit('member-click', member.entity_id, member.entity_type)
}

function goToGroupsPage() {
  if (group.value) {
    router.push(`/groups?highlight=${props.groupId}`)
  }
  close()
}

function close() {
  emit('update:modelValue', false)
}
</script>
