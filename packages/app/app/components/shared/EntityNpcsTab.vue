<template>
  <div>
    <!-- Add NPC Section -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-autocomplete
          v-model="localNpcId"
          :items="availableNpcs"
          item-title="name"
          item-value="id"
          :label="$t('common.selectNpc')"
          :placeholder="$t('common.selectNpcPlaceholder')"
          variant="outlined"
          clearable
          :loading="loading"
          class="mb-2"
        />

        <v-select
          v-if="showMembershipType && membershipTypeSuggestions.length > 0"
          v-model="localMembershipType"
          :items="membershipTypeSuggestions"
          item-title="title"
          item-value="value"
          :label="$t('common.membershipType')"
          variant="outlined"
          clearable
          class="mb-2"
        />

        <v-text-field
          v-if="showRank"
          v-model="localRank"
          :label="$t('common.rank')"
          :placeholder="$t('common.rankPlaceholder')"
          variant="outlined"
          class="mb-2"
        />

        <v-btn color="primary" block :disabled="!canAdd" @click="handleAdd">
          <v-icon start>mdi-account-plus</v-icon>
          {{ $t('common.linkNpc') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Linked NPCs List -->
    <v-list v-if="linkedNpcs.length > 0" class="pa-0">
      <v-list-item v-for="npc in linkedNpcs" :key="npc.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="showAvatar && npc.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${npc.image_url}`" />
          </v-avatar>
          <v-avatar v-else-if="showAvatar" size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-account" />
          </v-avatar>
          <v-icon v-else icon="mdi-account" color="primary" class="mr-3" />
        </template>

        <v-list-item-title>{{ npc.name }}</v-list-item-title>

        <v-list-item-subtitle>
          <v-chip v-if="showMembershipType && npc.relation_type" size="small" class="mr-1" color="primary" variant="tonal">
            {{ getMembershipTypeLabel(npc.relation_type) }}
          </v-chip>
          <span v-if="showRank && npc.notes?.rank" class="text-caption mr-2">
            {{ $t('common.rank') }}: {{ npc.notes.rank }}
          </span>
          <span v-if="npc.description" class="text-caption text-medium-emphasis">
            {{ npc.description.substring(0, 100) }}{{ npc.description.length > 100 ? '...' : '' }}
          </span>
        </v-list-item-subtitle>

        <template #append>
          <v-btn
            v-if="showMembershipType || showRank"
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="editNpc(npc)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', npc.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-account-off"
      :title="$t('common.noLinkedNpcs')"
      :text="$t('common.noLinkedNpcsText')"
    />

    <!-- Edit NPC Link Dialog -->
    <v-dialog v-model="showEditDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('common.editMemberLink') }}</v-card-title>
        <v-card-text>
          <v-select
            v-if="showMembershipType && membershipTypeSuggestions.length > 0"
            v-model="editForm.membershipType"
            :items="membershipTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('common.membershipType')"
            variant="outlined"
            clearable
            class="mb-3"
          />
          <v-text-field
            v-if="showRank"
            v-model="editForm.rank"
            :label="$t('common.rank')"
            :placeholder="$t('common.rankPlaceholder')"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeEditDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" @click="saveEdit">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useTabDirtyState } from '~/composables/useDialogDirtyState'

const { t } = useI18n()

// Register with parent dialog's dirty state management
const { markDirty } = useTabDirtyState('npcs', t('npcs.title'))

interface LinkedNpc {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
  relation_type?: string | null
  notes?: { rank?: string } | null
}

interface AvailableNpc {
  id: number
  name: string
}

interface MembershipTypeSuggestion {
  title: string
  value: string
}

interface Props {
  linkedNpcs: LinkedNpc[]
  availableNpcs: AvailableNpc[]
  loading?: boolean
  // Display options
  showAvatar?: boolean
  showMembershipType?: boolean
  showRank?: boolean
  // Membership type suggestions (for select dropdown)
  membershipTypeSuggestions?: MembershipTypeSuggestion[]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showAvatar: true,
  showMembershipType: false,
  showRank: false,
  membershipTypeSuggestions: () => [],
})

const emit = defineEmits<{
  add: [payload: { npcId: number; membershipType?: string; rank?: string }]
  update: [payload: { relationId: number; membershipType?: string; rank?: string }]
  remove: [npcId: number]
}>()

const localNpcId = ref<number | null>(null)
const localMembershipType = ref<string>('')
const localRank = ref<string>('')

// Edit dialog state
const showEditDialog = ref(false)
const editingNpc = ref<LinkedNpc | null>(null)
const editForm = ref({
  membershipType: '',
  rank: '',
})
const saving = ref(false)

// Track dirty state: form has selection or edit dialog is open
const isDirty = computed(() => {
  const hasFormData = !!localNpcId.value || !!localMembershipType.value || !!localRank.value
  return hasFormData || showEditDialog.value
})
watch(isDirty, (dirty) => markDirty(dirty), { immediate: true })

const canAdd = computed(() => {
  if (!localNpcId.value) return false
  if (props.showMembershipType && props.membershipTypeSuggestions.length > 0 && !localMembershipType.value) return false
  return true
})

function getMembershipTypeLabel(membershipType: string): string {
  // Try to find in suggestions first
  const suggestion = props.membershipTypeSuggestions.find((s) => s.value === membershipType)
  if (suggestion) return suggestion.title
  return membershipType
}

function handleAdd() {
  if (!localNpcId.value) return

  const payload: { npcId: number; membershipType?: string; rank?: string } = {
    npcId: localNpcId.value,
  }

  if (props.showMembershipType && localMembershipType.value) {
    payload.membershipType = localMembershipType.value
  }

  if (props.showRank && localRank.value) {
    payload.rank = localRank.value
  }

  emit('add', payload)

  // Reset form
  localNpcId.value = null
  localMembershipType.value = ''
  localRank.value = ''
}

function editNpc(npc: LinkedNpc) {
  editingNpc.value = npc
  editForm.value = {
    membershipType: npc.relation_type || '',
    rank: npc.notes?.rank || '',
  }
  showEditDialog.value = true
}

function saveEdit() {
  if (!editingNpc.value) return

  saving.value = true
  emit('update', {
    relationId: editingNpc.value.id,
    membershipType: editForm.value.membershipType || undefined,
    rank: editForm.value.rank || undefined,
  })

  // Close dialog (parent will handle the API call and reload)
  closeEditDialog()
  saving.value = false
}

function closeEditDialog() {
  showEditDialog.value = false
  editingNpc.value = null
  editForm.value = { membershipType: '', rank: '' }
}
</script>
