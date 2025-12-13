<template>
  <div>
    <div class="text-h6 mb-4">
      {{ $t('npcs.factionMemberships') }}
    </div>

    <v-list v-if="memberships.length > 0" class="mb-3">
      <v-list-item v-for="membership in memberships" :key="membership.id" class="mb-2" border>
        <template #prepend>
          <v-icon icon="mdi-shield-account" color="primary" />
        </template>
        <v-list-item-title>
          {{ membership.to_entity_name || membership.name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1">
            {{ translateMembershipType(membership.relation_type) }}
          </v-chip>
          <span
            v-if="membership.notes && typeof membership.notes === 'object' && 'rank' in membership.notes"
            class="text-caption"
          >
            {{ $t('npcs.rank') }}: {{ membership.notes.rank }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="editMembership(membership)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', membership.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-shield-account-outline"
      :title="$t('npcs.noMemberships')"
      :text="$t('npcs.noMembershipsText')"
    />

    <v-divider class="my-4" />

    <div class="text-h6 mb-4">
      {{ $t('npcs.addFactionMembership') }}
    </div>

    <v-select
      v-model="localFactionId"
      :items="factions"
      item-title="name"
      item-value="id"
      :label="$t('npcs.selectFaction')"
      variant="outlined"
      clearable
      class="mb-3"
    />

    <v-select
      v-model="localRelationType"
      :items="membershipTypeSuggestions"
      item-title="title"
      item-value="value"
      :label="$t('npcs.membershipType')"
      :placeholder="$t('npcs.membershipTypePlaceholder')"
      variant="outlined"
      clearable
      class="mb-3"
    />

    <v-text-field
      v-model="localRank"
      :label="$t('npcs.rank')"
      :placeholder="$t('npcs.rankPlaceholder')"
      variant="outlined"
      class="mb-3"
    />

    <v-btn
      color="primary"
      prepend-icon="mdi-link"
      block
      :disabled="!localFactionId || !localRelationType"
      :loading="adding"
      @click="handleAdd"
    >
      {{ $t('npcs.addFactionMembership') }}
    </v-btn>

    <!-- Edit Membership Dialog -->
    <v-dialog v-model="showEditDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('npcs.editMembership') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="editForm.relationType"
            :items="membershipTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('npcs.membershipType')"
            variant="outlined"
            clearable
            class="mb-3"
          />
          <v-text-field
            v-model="editForm.rank"
            :label="$t('npcs.rank')"
            :placeholder="$t('npcs.rankPlaceholder')"
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
import { FACTION_MEMBERSHIP_TYPES } from '~~/types/faction'
import { useTabDirtyState } from '~/composables/useDialogDirtyState'

const { t, te } = useI18n()

// Register with parent dialog's dirty state management
const { markDirty } = useTabDirtyState('memberships', t('npcs.memberships'))

// Translate membership type - check if translation exists, otherwise show raw value
function translateMembershipType(type: string): string {
  const key = `npcs.membershipTypes.${type}`
  return te(key) ? t(key) : type
}

interface Membership {
  id: number
  from_entity_id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  name?: string // Legacy fallback for to_entity_name
}

interface Faction {
  id: number
  name: string
}

interface Props {
  memberships: Membership[]
  factions: Faction[]
  adding: boolean
}

interface Emits {
  (e: 'add', payload: { factionId: number; relationType: string; rank?: string }): void
  (e: 'update', payload: { membershipId: number; relationType: string; rank?: string }): void
  (e: 'remove', membershipId: number): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

// Add form state
const localFactionId = ref<number | null>(null)
const localRelationType = ref('')
const localRank = ref('')

// Edit dialog state
const showEditDialog = ref(false)
const editingMembership = ref<Membership | null>(null)
const editForm = ref({
  relationType: '',
  rank: '',
})
const saving = ref(false)

// Track dirty state: form has data or edit dialog is open
const isDirty = computed(() => {
  const hasFormData = !!localFactionId.value || !!localRelationType.value || !!localRank.value
  return hasFormData || showEditDialog.value
})

// Notify parent dialog about dirty state
watch(isDirty, (dirty) => markDirty(dirty), { immediate: true })

const membershipTypeSuggestions = computed(() =>
  FACTION_MEMBERSHIP_TYPES.map((type) => ({
    value: type,
    title: t(`factions.membershipTypes.${type}`),
  })),
)

function handleAdd() {
  if (!localFactionId.value || !localRelationType.value) return

  emit('add', {
    factionId: localFactionId.value,
    relationType: localRelationType.value,
    rank: localRank.value || undefined,
  })

  // Reset form
  localFactionId.value = null
  localRelationType.value = ''
  localRank.value = ''
}

function editMembership(membership: Membership) {
  editingMembership.value = membership
  editForm.value = {
    relationType: membership.relation_type,
    rank: (membership.notes as { rank?: string } | null)?.rank || '',
  }
  showEditDialog.value = true
}

function saveEdit() {
  if (!editingMembership.value || !editForm.value.relationType) return

  saving.value = true
  emit('update', {
    membershipId: editingMembership.value.id,
    relationType: editForm.value.relationType,
    rank: editForm.value.rank || undefined,
  })

  // Close dialog (parent will handle the API call and reload)
  closeEditDialog()
  saving.value = false
}

function closeEditDialog() {
  showEditDialog.value = false
  editingMembership.value = null
  editForm.value = { relationType: '', rank: '' }
}
</script>
