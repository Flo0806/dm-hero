<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <!-- Items List -->
    <v-list v-else-if="items.length > 0" class="mb-3">
      <v-list-item v-for="item in items" :key="item.relation_id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="item.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${item.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-sword" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ item.name }}</v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1" color="primary" variant="tonal">
            {{ $t(`players.itemRelationTypes.${item.relation_type}`, item.relation_type) }}
          </v-chip>
          <span v-if="item.notes" class="text-caption">
            {{ item.notes.substring(0, 80) }}{{ item.notes.length > 80 ? '...' : '' }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            color="primary"
            class="mr-1"
            @click="openEditDialog(item)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="removeItem(item.relation_id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-sword-cross"
      :title="$t('players.noItems')"
      :text="$t('players.noItemsText')"
    />

    <!-- Edit Relation Dialog -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('players.editItemRelation') }}</v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editRelationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('players.itemRelationType')"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="editNotes"
            :label="$t('players.itemRelationNotes')"
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

    <!-- Add Item Relation Form -->
    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('players.addItem') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-autocomplete
            v-model="selectedItemId"
            :items="availableItems"
            item-title="name"
            item-value="id"
            :label="$t('common.selectItem')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-combobox
            v-model="selectedRelationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('players.itemRelationType')"
            :placeholder="$t('players.itemRelationTypePlaceholder')"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="selectedNotes"
            :label="$t('players.itemRelationNotes')"
            :placeholder="$t('players.itemRelationNotesPlaceholder')"
            variant="outlined"
            rows="2"
            class="mb-3"
            persistent-placeholder
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-link"
            :disabled="!selectedItemId || !selectedRelationType"
            :loading="adding"
            @click="addItem"
          >
            {{ $t('players.addItem') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { NPC_ITEM_RELATION_TYPES } from '~~/types/npc'

const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

interface PlayerItem {
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

const items = ref<PlayerItem[]>([])
const availableItems = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const adding = ref(false)
const saving = ref(false)

// Add form state
const selectedItemId = ref<number | null>(null)
const selectedRelationType = ref<string | { value: string; title: string } | null>(null)
const selectedNotes = ref('')

// Edit dialog state
const editDialog = ref(false)
const editRelationId = ref<number | null>(null)
const editRelationType = ref<string | { value: string; title: string }>('')
const editNotes = ref('')

// Relation type suggestions using NPC_ITEM_RELATION_TYPES
const relationTypeSuggestions = computed(() =>
  NPC_ITEM_RELATION_TYPES.map((type) => ({
    value: type,
    title: t(`players.itemRelationTypes.${type}`),
  })),
)

watch(
  () => props.entityId,
  async () => {
    await loadItems()
    await loadAvailableItems()
  },
  { immediate: true },
)

watch(
  () => entitiesStore.items,
  (storeItems) => {
    if (storeItems) {
      availableItems.value = storeItems.map((i) => ({ id: i.id, name: i.name }))
    }
  },
  { immediate: true },
)

async function loadAvailableItems() {
  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) return

  if (!entitiesStore.items || entitiesStore.items.length === 0) {
    await entitiesStore.fetchItems(campaignId)
  }
}

// Extract text from notes (can be string, object with text property, or null)
function getNotesText(notes: string | Record<string, unknown> | null): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  if (typeof notes === 'object' && 'text' in notes) return String(notes.text)
  return null
}

async function loadItems() {
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
    >(`/api/entities/${props.entityId}/related/items`)

    items.value = relations.map((rel) => ({
      relation_id: rel.id,
      id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      name: rel.name,
      description: rel.description,
      image_url: rel.image_url,
      relation_type: rel.relation_type || 'owns',
      notes: getNotesText(rel.notes),
    }))
  } catch (error) {
    console.error('Failed to load items:', error)
    items.value = []
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

async function addItem() {
  const relationType = getRelationTypeValue(selectedRelationType.value)
  if (!selectedItemId.value || !relationType) return

  adding.value = true
  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: selectedItemId.value,
        relationType,
        notes: selectedNotes.value || null,
      },
    })

    const item = availableItems.value.find((i) => i.id === selectedItemId.value)
    const itemFromStore = entitiesStore.items?.find((i) => i.id === selectedItemId.value)

    items.value.push({
      relation_id: relation.id,
      id: selectedItemId.value,
      name: item?.name || '',
      description: null,
      image_url: itemFromStore?.image_url || null,
      relation_type: relationType,
      notes: selectedNotes.value || null,
    })

    // Reset form
    selectedItemId.value = null
    selectedRelationType.value = null
    selectedNotes.value = ''
    emit('changed')
  } catch (error) {
    console.error('Failed to add item:', error)
  } finally {
    adding.value = false
  }
}

async function removeItem(relationId: number) {
  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    items.value = items.value.filter((i) => i.relation_id !== relationId)
    emit('changed')
  } catch (error) {
    console.error('Failed to remove item:', error)
  }
}

function openEditDialog(item: PlayerItem) {
  editRelationId.value = item.relation_id
  const suggestion = relationTypeSuggestions.value.find((s) => s.value === item.relation_type)
  editRelationType.value = suggestion || item.relation_type
  editNotes.value = item.notes || ''
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

    const item = items.value.find((i) => i.relation_id === editRelationId.value)
    if (item) {
      item.relation_type = relationType
      item.notes = editNotes.value || null
    }

    editDialog.value = false
    emit('changed')
  } catch (error) {
    console.error('Failed to update item relation:', error)
  } finally {
    saving.value = false
  }
}
</script>
