<template>
  <div>
    <!-- Faction Relations List -->
    <v-list v-if="factionRelations.length > 0" class="mb-3">
      <v-list-item
        v-for="relation in factionRelations"
        :key="relation.id"
        class="mb-2"
        border
      >
        <template #prepend>
          <v-avatar v-if="relation.image_url" size="40" class="mr-3">
            <v-img :src="`/uploads/${relation.image_url}`" />
          </v-avatar>
          <v-icon v-else icon="mdi-account-group" color="primary" />
        </template>
        <v-list-item-title>
          {{ relation.related_faction_name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1" color="primary" variant="tonal">
            {{ $t(`factions.factionRelationTypes.${relation.relation_type}`, relation.relation_type) }}
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

    <!-- Empty State -->
    <v-alert v-else type="info" variant="tonal" class="mb-3">
      {{ $t('factions.noFactionRelationsText') }}
    </v-alert>

    <!-- Edit Relation Dialog -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('common.edit') }}</v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editRelationType"
            :items="factionRelationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('factions.factionRelationType')"
            variant="outlined"
            clearable
            class="mb-3"
          />
          <v-textarea
            v-model="editNotes"
            :label="$t('common.notes')"
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

    <!-- Add Faction Relation Form -->
    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('factions.addFactionRelation') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-select
            v-model="localFactionId"
            :items="availableFactions"
            item-title="name"
            item-value="id"
            :label="$t('factions.selectTargetFaction')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-combobox
            v-model="localRelationType"
            :items="factionRelationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('factions.factionRelationType')"
            :placeholder="$t('factions.factionRelationTypePlaceholder')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-textarea
            v-model="localNotes"
            :label="$t('common.notes')"
            variant="outlined"
            rows="2"
            class="mb-3"
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-link"
            :disabled="!localFactionId || !localRelationType"
            :loading="adding"
            @click="handleAdd"
          >
            {{ $t('factions.addFactionRelation') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { FACTION_RELATION_TYPES } from '~~/types/faction'
import { useTabDirtyState } from '~/composables/useDialogDirtyState'

const { t } = useI18n()

// Register with parent dialog's dirty state management
const { markDirty } = useTabDirtyState('factionRelations', t('factions.factionRelations'))

interface FactionRelation {
  id: number
  related_faction_id: number
  related_faction_name: string
  relation_type: string
  notes: string | Record<string, unknown> | null
  image_url: string | null
  direction: 'outgoing' | 'incoming'
}

interface AvailableFaction {
  id: number
  name: string
}

interface Props {
  factionRelations: FactionRelation[]
  availableFactions: AvailableFaction[]
  adding: boolean
}

interface Emits {
  (e: 'add', payload: { factionId: number; relationType: string; notes?: string }): void
  (e: 'update', payload: { relationId: number; relationType: string; notes?: string }): void
  (e: 'remove', relationId: number): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const localFactionId = ref<number | null>(null)
const localRelationType = ref('')
const localNotes = ref('')

// Edit dialog state
const editDialog = ref(false)
const editRelationId = ref<number | null>(null)
const editRelationType = ref('')
const editNotes = ref('')
const saving = ref(false)

// Track dirty state
const isDirty = computed(() => {
  const hasRelationType = typeof localRelationType.value === 'string'
    ? !!localRelationType.value
    : !!(localRelationType.value as { value?: string } | null)?.value
  return !!localFactionId.value || hasRelationType || !!localNotes.value || editDialog.value
})

watch(isDirty, (dirty) => markDirty(dirty), { immediate: true })

const factionRelationTypeSuggestions = computed(() =>
  FACTION_RELATION_TYPES.map((type) => ({
    value: type,
    title: t(`factions.factionRelationTypes.${type}`),
  })),
)

function getNotesText(notes: string | Record<string, unknown> | null): string {
  if (!notes) return ''

  // If it's a string, try to parse as JSON first
  if (typeof notes === 'string') {
    // Try to parse as JSON (might be '{"text":"bla"}')
    try {
      const parsed = JSON.parse(notes)
      if (typeof parsed === 'object' && parsed !== null && 'text' in parsed) {
        return String(parsed.text)
      }
      // If parsed but no text property, return original string
      return notes
    } catch {
      // Not JSON, return as plain text
      return notes
    }
  }

  // If it's already an object with text property
  if (typeof notes === 'object' && 'text' in notes) {
    return String(notes.text)
  }

  return ''
}

function getComboboxValue(val: string | { value: string; title: string } | null): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object' && 'value' in val) return val.value
  return ''
}

function openEditDialog(relation: FactionRelation) {
  editRelationId.value = relation.id
  editRelationType.value = relation.relation_type
  editNotes.value = getNotesText(relation.notes)
  editDialog.value = true
}

function saveEdit() {
  const relationType = getComboboxValue(editRelationType.value as string | { value: string; title: string })
  if (!editRelationId.value || !relationType) return

  saving.value = true
  emit('update', {
    relationId: editRelationId.value,
    relationType,
    notes: editNotes.value || undefined,
  })
  editDialog.value = false
  saving.value = false
}

function handleAdd() {
  const relationType = getComboboxValue(localRelationType.value as string | { value: string; title: string })
  if (!localFactionId.value || !relationType) return

  emit('add', {
    factionId: localFactionId.value,
    relationType,
    notes: localNotes.value || undefined,
  })

  localFactionId.value = null
  localRelationType.value = ''
  localNotes.value = ''
}
</script>
