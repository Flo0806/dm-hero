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
            :label="$t('npcs.npcRelationType')"
            variant="outlined"
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
          <v-select
            v-model="localNpcId"
            :items="availableNpcs || []"
            item-title="name"
            item-value="id"
            :label="$t('npcs.selectNpc')"
            variant="outlined"
            class="mb-3"
          />

          <v-combobox
            v-model="localRelationType"
            :items="npcRelationTypeSuggestions"
            :label="$t('npcs.npcRelationType')"
            :placeholder="$t('npcs.npcRelationTypePlaceholder')"
            variant="outlined"
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
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

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

const npcRelationTypeSuggestions = computed(() => [
  t('npcs.npcRelationTypes.ally'),
  t('npcs.npcRelationTypes.enemy'),
  t('npcs.npcRelationTypes.family'),
  t('npcs.npcRelationTypes.friend'),
  t('npcs.npcRelationTypes.rival'),
  t('npcs.npcRelationTypes.mentor'),
  t('npcs.npcRelationTypes.student'),
  t('npcs.npcRelationTypes.colleague'),
])

// Extract text from notes (can be string, object with text property, or null)
function getNotesText(notes: string | Record<string, unknown> | null): string {
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  if (typeof notes === 'object' && 'text' in notes) return String(notes.text)
  return ''
}

function openEditDialog(relation: NpcRelation) {
  editRelationId.value = relation.id
  editRelationType.value = relation.relation_type
  editNotes.value = getNotesText(relation.notes)
  editDialog.value = true
}

function saveEdit() {
  if (!editRelationId.value || !editRelationType.value) return

  saving.value = true
  emit('update', {
    relationId: editRelationId.value,
    relationType: editRelationType.value,
    notes: editNotes.value || undefined,
  })

  // Close dialog (parent will reload data)
  editDialog.value = false
  saving.value = false
}

function handleAdd() {
  if (!localNpcId.value || !localRelationType.value) return

  emit('add', {
    npcId: localNpcId.value,
    relationType: localRelationType.value,
    notes: localNotes.value || undefined,
  })

  // Reset form
  localNpcId.value = null
  localRelationType.value = ''
  localNotes.value = ''
}
</script>
