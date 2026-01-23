<template>
  <div>
    <!-- NPC Relations List -->
    <v-list
      v-if="
        npcRelations.filter(
          (r) => (r.related_npc_type || r.to_entity_type) === 'NPC',
        ).length > 0
      "
      class="mb-3"
    >
      <v-list-item
        v-for="relation in npcRelations.filter(
          (r) => (r.related_npc_type || r.to_entity_type) === 'NPC',
        )"
        :key="relation.id"
        class="mb-2"
        border
      >
        <template #prepend>
          <v-icon icon="mdi-account" color="primary" />
        </template>
        <v-list-item-title>
          {{ relation.related_npc_name || relation.to_entity_name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1" color="primary" variant="tonal">
            {{ $t(`npcs.npcRelationTypes.${relation.relation_type}`, relation.relation_type) }}
          </v-chip>
          <span v-if="getNotesText(relation.notes)" class="text-caption">
            {{ getNotesText(relation.notes) }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            color="primary"
            class="mr-1"
            @click="openEditDialog(relation)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', relation.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <!-- Edit Relation Dialog -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('npcs.editRelation') }}</v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editRelationType"
            :items="npcRelationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('npcs.npcRelationType')"
            variant="outlined"
            clearable
            class="mb-3"
          />
          <v-textarea
            v-model="editNotes"
            :label="$t('npcs.relationNotes')"
            variant="outlined"
            rows="2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" @click="saveEdit">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add NPC Relation Form -->
    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start> mdi-plus </v-icon>
          {{ $t('npcs.addNpcRelation') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-autocomplete
            v-model="localNpcId"
            :items="availableNpcs || []"
            item-title="name"
            item-value="id"
            :label="$t('npcs.selectNpc')"
            variant="outlined"
            clearable
            class="mb-3"
          >
            <template #prepend-item>
              <v-list-item class="text-primary" @click="showQuickCreate = true">
                <template #prepend>
                  <v-icon>mdi-plus</v-icon>
                </template>
                <v-list-item-title>{{ $t('quickCreate.newNpc') }}</v-list-item-title>
              </v-list-item>
              <v-divider class="my-1" />
            </template>
          </v-autocomplete>

          <v-combobox
            v-model="localRelationType"
            :items="npcRelationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('npcs.npcRelationType')"
            :placeholder="$t('npcs.npcRelationTypePlaceholder')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-textarea
            v-model="localNotes"
            :label="$t('npcs.relationNotes')"
            :placeholder="$t('npcs.relationNotesPlaceholder')"
            variant="outlined"
            rows="2"
            class="mb-3"
            persistent-placeholder
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-link"
            :disabled="!localNpcId || !localRelationType"
            :loading="adding"
            @click="handleAdd"
          >
            {{ $t('npcs.addNpcRelation') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Quick Create Dialog -->
    <SharedQuickCreateEntityDialog
      v-model="showQuickCreate"
      entity-type="NPC"
      @created="handleQuickCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { NPC_RELATION_TYPES } from '~~/types/npc'

const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

// Register with parent dialog's dirty state management
const { markDirty } = useTabDirtyState('npcRelations', t('npcs.npcRelations'))

interface NpcRelation {
  id: number
  related_npc_id: number
  related_npc_name: string
  related_npc_type: string
  relation_type: string
  notes: string | Record<string, unknown> | null
  image_url: string | null
  direction: 'outgoing' | 'incoming'
  // Legacy fields for backwards compat with locations
  to_entity_id?: number
  to_entity_name?: string
  to_entity_type?: string
}

interface AvailableNpc {
  id: number
  name: string
}

interface Props {
  npcRelations: NpcRelation[]
  availableNpcs: AvailableNpc[]
  adding: boolean
}

interface Emits {
  (e: 'add', payload: { npcId: number; relationType: string; notes?: string }): void
  (e: 'update', payload: { relationId: number; relationType: string; notes?: string }): void
  (e: 'remove', relationId: number): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const localNpcId = ref<number | null>(null)
const localRelationType = ref('')
const localNotes = ref('')

// Edit dialog state
const editDialog = ref(false)
const editRelationId = ref<number | null>(null)
const editRelationType = ref('')
const editNotes = ref('')
const saving = ref(false)

// Quick Create state
const showQuickCreate = ref(false)

// Track dirty state: form has data or edit dialog is open
const isDirty = computed(() => {
  // localRelationType can be string or {value, title} object from combobox
  const hasRelationType = typeof localRelationType.value === 'string'
    ? !!localRelationType.value
    : !!(localRelationType.value as { value?: string } | null)?.value
  const hasFormData = !!localNpcId.value || hasRelationType || !!localNotes.value
  return hasFormData || editDialog.value
})

// Notify parent dialog about dirty state
watch(isDirty, (dirty) => markDirty(dirty), { immediate: true })

const npcRelationTypeSuggestions = computed(() =>
  NPC_RELATION_TYPES.map((type) => ({
    value: type,
    title: t(`npcs.npcRelationTypes.${type}`),
  })).sort((a, b) => a.title.localeCompare(b.title)),
)

// Extract text from notes (can be string, JSON string, object with text property, or null)
function getNotesText(notes: string | Record<string, unknown> | null): string {
  if (!notes) return ''

  // If it's a string, try to parse as JSON first
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes)
      if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) {
        return String(parsed.text)
      }
      return notes
    } catch {
      return notes
    }
  }

  // If it's already an object with text property
  if (typeof notes === 'object' && 'text' in notes) {
    return String(notes.text)
  }

  return ''
}

function openEditDialog(relation: NpcRelation) {
  editRelationId.value = relation.id
  editRelationType.value = relation.relation_type
  editNotes.value = getNotesText(relation.notes)
  editDialog.value = true
}

// Extract value from combobox selection (can be string or {value, title} object)
function getRelationTypeValue(val: string | { value: string; title: string } | null): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object' && 'value' in val) return val.value
  return ''
}

function saveEdit() {
  const relationType = getRelationTypeValue(editRelationType.value as string | { value: string; title: string })
  if (!editRelationId.value || !relationType) return

  saving.value = true
  emit('update', {
    relationId: editRelationId.value,
    relationType,
    notes: editNotes.value || undefined,
  })

  // Close dialog (parent will reload data)
  editDialog.value = false
  saving.value = false
}

function handleAdd() {
  const relationType = getRelationTypeValue(localRelationType.value as string | { value: string; title: string })
  if (!localNpcId.value || !relationType) return

  emit('add', {
    npcId: localNpcId.value,
    relationType,
    notes: localNotes.value || undefined,
  })

  // Reset form
  localNpcId.value = null
  localRelationType.value = ''
  localNotes.value = ''
}

async function handleQuickCreated(newEntity: { id: number; name: string }) {
  // Reload NPCs to include the new NPC
  const campaignId = campaignStore.activeCampaignId
  if (campaignId) {
    await entitiesStore.fetchNPCs(campaignId, true)
    // Set default counts for the new NPC so it doesn't show loading spinner
    const { setCounts } = useNpcCounts()
    setCounts(newEntity.id, {
      relations: 0,
      items: 0,
      locations: 0,
      documents: 0,
      images: 0,
      memberships: 0,
      lore: 0,
      notes: 0,
      players: 0,
      factions: [],
      factionName: null,
      groups: [],
    })
  }

  // Pre-select the new NPC in the autocomplete (user still needs to click "Link")
  localNpcId.value = newEntity.id

  snackbarStore.success(t('quickCreate.created', { name: newEntity.name }))
}
</script>
