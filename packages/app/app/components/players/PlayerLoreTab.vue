<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <!-- Lore List -->
    <v-list v-else-if="loreEntries.length > 0" class="mb-3">
      <v-list-item v-for="lore in loreEntries" :key="lore.relation_id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="lore.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${lore.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-book-open-variant" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ lore.name }}</v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1" color="primary" variant="tonal">
            {{ $t(`players.loreRelationTypes.${lore.relation_type}`, lore.relation_type) }}
          </v-chip>
          <span v-if="lore.notes" class="text-caption">
            {{ lore.notes.substring(0, 80) }}{{ lore.notes.length > 80 ? '...' : '' }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            color="primary"
            class="mr-1"
            @click="openEditDialog(lore)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="removeLore(lore.relation_id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-book-open-variant"
      :title="$t('players.noLore')"
      :text="$t('players.noLoreText')"
    />

    <!-- Edit Relation Dialog -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('players.editLoreRelation') }}</v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editRelationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('players.loreRelationType')"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="editNotes"
            :label="$t('players.loreRelationNotes')"
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

    <!-- Add Lore Relation Form -->
    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('players.addLore') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-autocomplete
            v-model="selectedLoreId"
            :items="availableLore"
            item-title="name"
            item-value="id"
            :label="$t('common.selectLore')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-combobox
            v-model="selectedRelationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('players.loreRelationType')"
            :placeholder="$t('players.loreRelationTypePlaceholder')"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="selectedNotes"
            :label="$t('players.loreRelationNotes')"
            :placeholder="$t('players.loreRelationNotesPlaceholder')"
            variant="outlined"
            rows="2"
            class="mb-3"
            persistent-placeholder
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-link"
            :disabled="!selectedLoreId || !selectedRelationType"
            :loading="adding"
            @click="addLore"
          >
            {{ $t('players.addLore') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { PLAYER_RELATION_TYPES } from '~~/types/player'

const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

interface LoreEntry {
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

const loreEntries = ref<LoreEntry[]>([])
const availableLore = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const adding = ref(false)
const saving = ref(false)

// Add form state
const selectedLoreId = ref<number | null>(null)
const selectedRelationType = ref<string | { value: string; title: string } | null>(null)
const selectedNotes = ref('')

// Edit dialog state
const editDialog = ref(false)
const editRelationId = ref<number | null>(null)
const editRelationType = ref<string | { value: string; title: string }>('')
const editNotes = ref('')

// Relation type suggestions using PLAYER_RELATION_TYPES
const relationTypeSuggestions = computed(() =>
  PLAYER_RELATION_TYPES.map((type) => ({
    value: type,
    title: t(`players.loreRelationTypes.${type}`),
  })),
)

watch(
  () => props.entityId,
  async () => {
    await loadLore()
    await loadAvailableLore()
  },
  { immediate: true },
)

watch(
  () => entitiesStore.lore,
  (storeLore) => {
    if (storeLore) {
      availableLore.value = storeLore.map((l) => ({ id: l.id, name: l.name }))
    }
  },
  { immediate: true },
)

async function loadAvailableLore() {
  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) return

  if (!entitiesStore.lore || entitiesStore.lore.length === 0) {
    await entitiesStore.fetchLore(campaignId)
  }
}

// Extract text from notes (can be string, object with text property, or null)
function getNotesText(notes: string | Record<string, unknown> | null): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  if (typeof notes === 'object' && 'text' in notes) return String(notes.text)
  return null
}

async function loadLore() {
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
    >(`/api/entities/${props.entityId}/related/lore`)

    loreEntries.value = relations.map((rel) => ({
      relation_id: rel.id,
      id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      name: rel.name,
      description: rel.description,
      image_url: rel.image_url,
      relation_type: rel.relation_type || 'knows',
      notes: getNotesText(rel.notes),
    }))
  } catch (error) {
    console.error('Failed to load lore:', error)
    loreEntries.value = []
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

async function addLore() {
  const relationType = getRelationTypeValue(selectedRelationType.value)
  if (!selectedLoreId.value || !relationType) return

  adding.value = true
  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: selectedLoreId.value,
        relationType,
        notes: selectedNotes.value || null,
      },
    })

    const lore = availableLore.value.find((l) => l.id === selectedLoreId.value)
    const loreFromStore = entitiesStore.lore?.find((l) => l.id === selectedLoreId.value)

    loreEntries.value.push({
      relation_id: relation.id,
      id: selectedLoreId.value,
      name: lore?.name || '',
      description: null,
      image_url: loreFromStore?.image_url || null,
      relation_type: relationType,
      notes: selectedNotes.value || null,
    })

    // Reset form
    selectedLoreId.value = null
    selectedRelationType.value = null
    selectedNotes.value = ''
    emit('changed')
  } catch (error) {
    console.error('Failed to add lore:', error)
  } finally {
    adding.value = false
  }
}

async function removeLore(relationId: number) {
  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    loreEntries.value = loreEntries.value.filter((l) => l.relation_id !== relationId)
    emit('changed')
  } catch (error) {
    console.error('Failed to remove lore:', error)
  }
}

function openEditDialog(lore: LoreEntry) {
  editRelationId.value = lore.relation_id
  const suggestion = relationTypeSuggestions.value.find((s) => s.value === lore.relation_type)
  editRelationType.value = suggestion || lore.relation_type
  editNotes.value = lore.notes || ''
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

    const lore = loreEntries.value.find((l) => l.relation_id === editRelationId.value)
    if (lore) {
      lore.relation_type = relationType
      lore.notes = editNotes.value || null
    }

    editDialog.value = false
    emit('changed')
  } catch (error) {
    console.error('Failed to update lore relation:', error)
  } finally {
    saving.value = false
  }
}
</script>
