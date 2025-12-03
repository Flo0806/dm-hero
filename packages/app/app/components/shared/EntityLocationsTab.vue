<template>
  <div>
    <!-- Loading State -->
    <v-progress-linear v-if="loadingLocations" indeterminate class="mb-3" />

    <!-- Locations List -->
    <v-list v-else-if="locationRelations.length > 0" class="mb-3">
      <v-list-item
        v-for="relation in locationRelations"
        :key="relation.id"
        class="mb-2"
        border
      >
        <template #prepend>
          <v-icon icon="mdi-map-marker" color="primary" />
        </template>
        <v-list-item-title>
          {{ relation.to_entity_name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1">
            {{ relation.relation_type }}
          </v-chip>
          <span v-if="relation.notes" class="text-caption">
            {{ relation.notes }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="editRelation(relation)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="removeRelation(relation.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-map-marker-outline"
      :title="$t('npcs.noLinkedLocations')"
      :text="$t('npcs.noLinkedLocationsText')"
    />

    <!-- Add Location Relation Form -->
    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start> mdi-plus </v-icon>
          {{ $t('npcs.addLocationLink') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-select
            v-model="localLocationId"
            :items="availableLocations"
            item-title="name"
            item-value="id"
            :label="$t('npcs.selectLocation')"
            variant="outlined"
            class="mb-3"
          />

          <v-select
            v-model="localRelationType"
            :items="relationTypeSuggestions"
            :label="$t('npcs.relationType')"
            :placeholder="$t('npcs.relationTypePlaceholder')"
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
            :disabled="!localLocationId || !localRelationType"
            :loading="adding"
            @click="handleAdd"
          >
            {{ $t('npcs.addLocationLink') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-dialog v-model="showEditDialog" max-width="600">
      <v-card>
        <v-card-title>{{ $t('npcs.editRelation') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="editForm.relationType"
            :items="relationTypeSuggestions"
            :label="$t('npcs.relationType')"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="editForm.notes"
            :label="$t('npcs.relationNotes')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeEditDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" @click="saveRelation">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const entitiesStore = useEntitiesStore()

interface LocationRelation {
  id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: string | null
}

interface Relation {
  id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: string | null
}

interface Props {
  entityId: number
}

const props = defineProps<Props>()

// State
const locationRelations = ref<LocationRelation[]>([])
const availableLocations = ref<{ id: number; name: string }[]>([])
const loadingLocations = ref(false)
const adding = ref(false)
const saving = ref(false)

const localLocationId = ref<number | null>(null)
const localRelationType = ref('')
const localNotes = ref('')

const showEditDialog = ref(false)
const editingRelation = ref<LocationRelation | null>(null)
const editForm = ref({
  relationType: '',
  notes: '',
})

const relationTypeSuggestions = computed(() => [
  t('npcs.relationTypes.livesIn'),
  t('npcs.relationTypes.worksAt'),
  t('npcs.relationTypes.visitsOften'),
  t('npcs.relationTypes.bornIn'),
  t('npcs.relationTypes.hidesIn'),
  t('npcs.relationTypes.owns'),
  t('npcs.relationTypes.searchesFor'),
  t('npcs.relationTypes.banishedFrom'),
])

// Load locations on mount and when entityId changes
watch(
  () => props.entityId,
  async () => {
    await loadLocations()
  },
  { immediate: true },
)

// Load available locations from store
watch(
  () => entitiesStore.locations,
  (locations) => {
    if (locations) {
      availableLocations.value = locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
      }))
    }
  },
  { immediate: true },
)

async function loadLocations() {
  if (!props.entityId) return

  loadingLocations.value = true
  try {
    const relations = await $fetch<
      Array<{
        id: number
        from_entity_id: number
        to_entity_id: number
        name: string
        relation_type: string
        notes: string | null
        direction: 'outgoing' | 'incoming'
      }>
    >(`/api/entities/${props.entityId}/related/locations`)

    locationRelations.value = relations.map((rel) => ({
      id: rel.id, // Relation ID
      to_entity_id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      to_entity_name: rel.name,
      to_entity_type: 'Location',
      relation_type: rel.relation_type,
      notes: rel.notes,
    }))
  } catch (error) {
    console.error('Failed to load location relations:', error)
    locationRelations.value = []
  } finally {
    loadingLocations.value = false
  }
}

async function handleAdd() {
  if (!localLocationId.value || !localRelationType.value) return

  adding.value = true

  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: localLocationId.value,
        relationType: localRelationType.value,
        notes: localNotes.value || null,
      },
    })

    // Get location name from availableLocations
    const location = availableLocations.value.find((loc) => loc.id === localLocationId.value)

    locationRelations.value.push({
      id: relation.id,
      to_entity_id: localLocationId.value,
      to_entity_name: location?.name || '',
      to_entity_type: 'Location',
      relation_type: localRelationType.value,
      notes: localNotes.value || null,
    })

    // Reset form
    localLocationId.value = null
    localRelationType.value = ''
    localNotes.value = ''
  } catch (error) {
    console.error('Failed to add location relation:', error)
  } finally {
    adding.value = false
  }
}

function editRelation(relation: LocationRelation) {
  editingRelation.value = relation
  editForm.value = {
    relationType: relation.relation_type,
    notes: relation.notes || '',
  }
  showEditDialog.value = true
}

async function saveRelation() {
  if (!editingRelation.value) return

  saving.value = true

  try {
    const updated = await $fetch<Relation>(`/api/entity-relations/${editingRelation.value.id}`, {
      method: 'PATCH',
      body: {
        relationType: editForm.value.relationType,
        notes: editForm.value.notes || null,
      },
    })

    // Update in local array
    const index = locationRelations.value.findIndex((r) => r.id === editingRelation.value!.id)
    if (index !== -1 && locationRelations.value[index]) {
      locationRelations.value[index].relation_type = updated.relation_type
      locationRelations.value[index].notes = updated.notes
    }

    closeEditDialog()
  } catch (error) {
    console.error('Failed to update relation:', error)
  } finally {
    saving.value = false
  }
}

async function removeRelation(relationId: number) {
  try {
    await $fetch(`/api/entity-relations/${relationId}`, {
      method: 'DELETE',
    })

    // Remove from local array
    locationRelations.value = locationRelations.value.filter((r) => r.id !== relationId)
  } catch (error) {
    console.error('Failed to remove relation:', error)
  }
}

function closeEditDialog() {
  showEditDialog.value = false
  editingRelation.value = null
  editForm.value = {
    relationType: '',
    notes: '',
  }
}
</script>
