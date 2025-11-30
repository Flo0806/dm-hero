<template>
  <div>
    <!-- Loading State -->
    <v-progress-linear v-if="loadingFactions" indeterminate class="mb-3" />

    <!-- Factions List -->
    <v-list v-else-if="factionRelations.length > 0" class="mb-3">
      <v-list-item
        v-for="relation in factionRelations"
        :key="relation.id"
        class="mb-2"
        border
      >
        <template #prepend>
          <v-avatar v-if="relation.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${relation.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-shield" />
          </v-avatar>
        </template>
        <v-list-item-title>
          {{ relation.to_entity_name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip v-if="relation.relation_type" size="small" class="mr-1">
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
      icon="mdi-shield-outline"
      :title="$t('common.noLinkedFactions')"
      :text="$t('common.noLinkedFactionsText')"
    />

    <!-- Add Faction Relation Form -->
    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('common.addFactionLink') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-select
            v-model="localFactionId"
            :items="availableFactions"
            item-title="name"
            item-value="id"
            :label="$t('common.selectFaction')"
            variant="outlined"
            class="mb-3"
          />

          <v-select
            v-model="localRelationType"
            :items="relationTypeSuggestions"
            :label="$t('common.relationType')"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="localNotes"
            :label="$t('common.relationNotes')"
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
            {{ $t('common.addFactionLink') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-dialog v-model="showEditDialog" max-width="600">
      <v-card>
        <v-card-title>{{ $t('common.editRelation') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="editForm.relationType"
            :items="relationTypeSuggestions"
            :label="$t('common.relationType')"
            variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="editForm.notes"
            :label="$t('common.relationNotes')"
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

interface FactionRelation {
  id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: string | null
  image_url: string | null
}

interface Props {
  entityId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  changed: []
}>()

// State
const factionRelations = ref<FactionRelation[]>([])
const availableFactions = ref<{ id: number; name: string }[]>([])
const loadingFactions = ref(false)
const adding = ref(false)
const saving = ref(false)

const localFactionId = ref<number | null>(null)
const localRelationType = ref('')
const localNotes = ref('')

const showEditDialog = ref(false)
const editingRelation = ref<FactionRelation | null>(null)
const editForm = ref({
  relationType: '',
  notes: '',
})

const relationTypeSuggestions = computed(() => [
  t('factions.relationTypes.member'),
  t('factions.relationTypes.ally'),
  t('factions.relationTypes.enemy'),
  t('factions.relationTypes.leader'),
  t('factions.relationTypes.founder'),
  t('factions.relationTypes.supporter'),
  t('factions.relationTypes.informant'),
])

// Load factions on mount and when entityId changes
watch(
  () => props.entityId,
  async () => {
    await loadFactions()
  },
  { immediate: true },
)

// Load available factions from store
watch(
  () => entitiesStore.factions,
  (factions) => {
    if (factions) {
      availableFactions.value = factions.map((f) => ({
        id: f.id,
        name: f.name,
      }))
    }
  },
  { immediate: true },
)

async function loadFactions() {
  if (!props.entityId) return

  loadingFactions.value = true
  try {
    const relations = await $fetch<
      Array<{
        id: number
        from_entity_id: number
        to_entity_id: number
        name: string
        relation_type: string
        notes: string | null
        image_url: string | null
        direction: 'outgoing' | 'incoming'
      }>
    >(`/api/entities/${props.entityId}/related/factions`)

    factionRelations.value = relations.map((rel) => ({
      id: rel.id,
      to_entity_id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      to_entity_name: rel.name,
      to_entity_type: 'Faction',
      relation_type: rel.relation_type,
      notes: rel.notes,
      image_url: rel.image_url,
    }))
  } catch (error) {
    console.error('Failed to load faction relations:', error)
    factionRelations.value = []
  } finally {
    loadingFactions.value = false
  }
}

async function handleAdd() {
  if (!localFactionId.value || !localRelationType.value) return

  adding.value = true

  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: localFactionId.value,
        relationType: localRelationType.value,
        notes: localNotes.value || null,
      },
    })

    const faction = availableFactions.value.find((f) => f.id === localFactionId.value)

    factionRelations.value.push({
      id: relation.id,
      to_entity_id: localFactionId.value,
      to_entity_name: faction?.name || '',
      to_entity_type: 'Faction',
      relation_type: localRelationType.value,
      notes: localNotes.value || null,
      image_url: null,
    })

    // Reset form
    localFactionId.value = null
    localRelationType.value = ''
    localNotes.value = ''

    emit('changed')
  } catch (error) {
    console.error('Failed to add faction relation:', error)
  } finally {
    adding.value = false
  }
}

function editRelation(relation: FactionRelation) {
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
    const updated = await $fetch<FactionRelation>(`/api/entity-relations/${editingRelation.value.id}`, {
      method: 'PATCH',
      body: {
        relationType: editForm.value.relationType,
        notes: editForm.value.notes || null,
      },
    })

    const index = factionRelations.value.findIndex((r) => r.id === editingRelation.value!.id)
    if (index !== -1 && factionRelations.value[index]) {
      factionRelations.value[index].relation_type = updated.relation_type
      factionRelations.value[index].notes = updated.notes
    }

    closeEditDialog()
    emit('changed')
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

    factionRelations.value = factionRelations.value.filter((r) => r.id !== relationId)
    emit('changed')
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
