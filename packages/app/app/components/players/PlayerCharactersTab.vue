<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <!-- Characters List -->
    <v-list v-else-if="characters.length > 0" class="mb-3">
      <v-list-item v-for="npc in characters" :key="npc.relation_id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="npc.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${npc.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-account" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ npc.name }}</v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1" color="primary" variant="tonal">
            {{ $t(`npcs.npcRelationTypes.${npc.relation_type}`, npc.relation_type) }}
          </v-chip>
          <span v-if="npc.notes" class="text-caption">
            {{ npc.notes.substring(0, 80) }}{{ npc.notes.length > 80 ? '...' : '' }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            color="primary"
            class="mr-1"
            @click="openEditDialog(npc)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="removeCharacter(npc.relation_id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-account-off"
      :title="$t('players.noCharacters')"
      :text="$t('players.noCharactersText')"
    />

    <!-- Edit Relation Dialog -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('players.editCharacterRelation') }}</v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editRelationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('players.characterRelationType')"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="editNotes"
            :label="$t('players.characterRelationNotes')"
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

    <!-- Add Character Relation Form -->
    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('players.addCharacter') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-autocomplete
            v-model="selectedNpcId"
            :items="availableNpcs"
            item-title="name"
            item-value="id"
            :label="$t('common.selectNpc')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-combobox
            v-model="selectedRelationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('players.characterRelationType')"
            :placeholder="$t('players.characterRelationTypePlaceholder')"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="selectedNotes"
            :label="$t('players.characterRelationNotes')"
            :placeholder="$t('players.characterRelationNotesPlaceholder')"
            variant="outlined"
            rows="2"
            class="mb-3"
            persistent-placeholder
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-account-plus"
            :disabled="!selectedNpcId || !selectedRelationType"
            :loading="adding"
            @click="addCharacter"
          >
            {{ $t('players.addCharacter') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { NPC_RELATION_TYPES } from '~~/types/npc'

const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

interface Character {
  relation_id: number
  id: number
  name: string
  description: string | null
  image_url: string | null
  relation_type: string
  notes: string | null
}

interface Props {
  entityId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  changed: []
}>()

const characters = ref<Character[]>([])
const availableNpcs = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const adding = ref(false)
const saving = ref(false)

// Add form state
const selectedNpcId = ref<number | null>(null)
const selectedRelationType = ref<string | { value: string; title: string } | null>(null)
const selectedNotes = ref('')

// Edit dialog state
const editDialog = ref(false)
const editRelationId = ref<number | null>(null)
const editRelationType = ref<string | { value: string; title: string }>('')
const editNotes = ref('')

// Relation type suggestions using NPC_RELATION_TYPES
const relationTypeSuggestions = computed(() =>
  NPC_RELATION_TYPES.map((type) => ({
    value: type,
    title: t(`npcs.npcRelationTypes.${type}`),
  })),
)

watch(
  () => props.entityId,
  async () => {
    await loadCharacters()
    // Ensure NPCs are loaded for the dropdown
    await loadAvailableNpcs()
  },
  { immediate: true },
)

watch(
  () => entitiesStore.npcs,
  (npcs) => {
    if (npcs) {
      availableNpcs.value = npcs.map((n) => ({ id: n.id, name: n.name }))
    }
  },
  { immediate: true },
)

async function loadAvailableNpcs() {
  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) return

  // Only fetch if not already loaded
  if (!entitiesStore.npcs || entitiesStore.npcs.length === 0) {
    await entitiesStore.fetchNPCs(campaignId)
  }
}

// Extract text from notes (can be string, object with text property, or null)
function getNotesText(notes: string | Record<string, unknown> | null): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  if (typeof notes === 'object' && 'text' in notes) return String(notes.text)
  return null
}

async function loadCharacters() {
  if (!props.entityId) return

  loading.value = true
  try {
    const relations = await $fetch<
      Array<{
        id: number
        from_entity_id: number
        to_entity_id: number
        name: string
        description: string | null
        image_url: string | null
        relation_type: string | null
        notes: string | Record<string, unknown> | null
        direction: 'outgoing' | 'incoming'
      }>
    >(`/api/entities/${props.entityId}/related/npcs`)

    characters.value = relations.map((rel) => ({
      relation_id: rel.id,
      id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      name: rel.name,
      description: rel.description,
      image_url: rel.image_url,
      relation_type: rel.relation_type || 'friend',
      notes: getNotesText(rel.notes),
    }))
  } catch (error) {
    console.error('Failed to load characters:', error)
    characters.value = []
  } finally {
    loading.value = false
  }
}

// Extract value from combobox selection (can be string or {value, title} object)
function getRelationTypeValue(val: string | { value: string; title: string } | null): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object' && 'value' in val) return val.value
  return ''
}

async function addCharacter() {
  const relationType = getRelationTypeValue(selectedRelationType.value)
  if (!selectedNpcId.value || !relationType) return

  adding.value = true
  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: selectedNpcId.value,
        relationType,
        notes: selectedNotes.value || null,
      },
    })

    const npc = availableNpcs.value.find((n) => n.id === selectedNpcId.value)
    const npcFromStore = entitiesStore.npcs?.find((n) => n.id === selectedNpcId.value)

    characters.value.push({
      relation_id: relation.id,
      id: selectedNpcId.value,
      name: npc?.name || '',
      description: null,
      image_url: npcFromStore?.image_url || null,
      relation_type: relationType,
      notes: selectedNotes.value || null,
    })

    // Reset form
    selectedNpcId.value = null
    selectedRelationType.value = null
    selectedNotes.value = ''
    emit('changed')
  } catch (error) {
    console.error('Failed to add character:', error)
  } finally {
    adding.value = false
  }
}

async function removeCharacter(relationId: number) {
  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    characters.value = characters.value.filter((c) => c.relation_id !== relationId)
    emit('changed')
  } catch (error) {
    console.error('Failed to remove character:', error)
  }
}

function openEditDialog(character: Character) {
  editRelationId.value = character.relation_id
  // Find the matching suggestion object for proper display
  const suggestion = relationTypeSuggestions.value.find((s) => s.value === character.relation_type)
  editRelationType.value = suggestion || character.relation_type
  editNotes.value = character.notes || ''
  editDialog.value = true
}

async function saveEdit() {
  const relationType = getRelationTypeValue(editRelationType.value)
  if (!editRelationId.value || !relationType) return

  saving.value = true
  try {
    await $fetch(`/api/entity-relations/${editRelationId.value}`, {
      method: 'PATCH',
      body: {
        relationType,
        notes: editNotes.value || null,
      },
    })

    // Update local state
    const character = characters.value.find((c) => c.relation_id === editRelationId.value)
    if (character) {
      character.relation_type = relationType
      character.notes = editNotes.value || null
    }

    editDialog.value = false
    emit('changed')
  } catch (error) {
    console.error('Failed to update character relation:', error)
  } finally {
    saving.value = false
  }
}
</script>
