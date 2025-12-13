<template>
  <div>
    <div class="text-h6 mb-4">
      {{ $t('factions.locationsList') }}
    </div>

    <v-progress-linear v-if="loadingLocations" indeterminate />

    <v-list v-else-if="locations.length > 0">
      <v-list-item v-for="location in locations" :key="location.id" class="mb-2" border>
        <template #prepend>
          <v-icon icon="mdi-map-marker" color="primary" />
        </template>
        <v-list-item-title>
          {{ location.name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1">
            {{ $t(`factions.locationTypes.${location.relation_type}`, location.relation_type) }}
          </v-chip>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="editLocation(location)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', location.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-map-marker-outline"
      :title="$t('factions.noLocations')"
      :text="$t('factions.noLocationsText')"
    />

    <!-- Edit Location Link Dialog -->
    <v-dialog v-model="showEditDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('common.editLocationLink') }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="editForm.relationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('factions.locationType')"
            variant="outlined"
            clearable
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

    <v-divider class="my-4" />

    <div class="text-h6 mb-4">
      {{ $t('factions.addLocation') }}
    </div>

    <v-select
      v-model="localLocationId"
      :items="availableLocations"
      item-title="name"
      item-value="id"
      :label="$t('factions.selectLocation')"
      variant="outlined"
      clearable
      class="mb-3"
    />

    <v-select
      v-model="localRelationType"
      :items="relationTypeSuggestions"
      item-title="title"
      item-value="value"
      :label="$t('factions.locationType')"
      :placeholder="$t('factions.locationTypePlaceholder')"
      variant="outlined"
      clearable
      class="mb-3"
    />

    <v-btn
      color="primary"
      prepend-icon="mdi-link"
      :disabled="!localLocationId || !localRelationType"
      :loading="adding"
      @click="handleAdd"
    >
      {{ $t('factions.addLocation') }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { useTabDirtyState } from '~/composables/useDialogDirtyState'

const { t } = useI18n()

// Register with parent dialog's dirty state management
const { markDirty } = useTabDirtyState('factionLocations', t('common.locations'))

interface FactionLocation {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  name: string
  image_url?: string | null
  description?: string | null
  direction?: 'outgoing' | 'incoming'
}

interface Location {
  id: number
  name: string
}

interface Props {
  locations: FactionLocation[]
  availableLocations: Location[]
  loadingLocations: boolean
  adding: boolean
}

interface Emits {
  (e: 'add', payload: { locationId: number; relationType: string }): void
  (e: 'update', payload: { relationId: number; relationType: string }): void
  (e: 'remove', relationId: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localLocationId = ref<number | null>(null)
const localRelationType = ref('')

// Edit dialog state
const showEditDialog = ref(false)
const editingLocation = ref<FactionLocation | null>(null)
const editForm = ref({
  relationType: '',
})
const saving = ref(false)

// Track dirty state: form has selection or edit dialog is open
const isDirty = computed(() => !!localLocationId.value || !!localRelationType.value || showEditDialog.value)
watch(isDirty, (dirty) => markDirty(dirty), { immediate: true })

const FACTION_LOCATION_TYPES = [
  'headquarters',
  'hideout',
  'meetingPlace',
  'territory',
  'safehouse',
  'baseOfOperations',
  'warehouse',
  'temple',
  'training_ground',
  'outpost',
  'embassy',
  'stronghold',
]

const relationTypeSuggestions = computed(() =>
  FACTION_LOCATION_TYPES.map((type) => ({
    value: type,
    title: t(`factions.locationTypes.${type}`),
  })),
)

function handleAdd() {
  if (!localLocationId.value || !localRelationType.value) return

  emit('add', {
    locationId: localLocationId.value,
    relationType: localRelationType.value,
  })

  // Reset form
  localLocationId.value = null
  localRelationType.value = ''
}

function editLocation(location: FactionLocation) {
  editingLocation.value = location
  editForm.value = {
    relationType: location.relation_type || '',
  }
  showEditDialog.value = true
}

function saveEdit() {
  if (!editingLocation.value || !editForm.value.relationType) return

  saving.value = true
  emit('update', {
    relationId: editingLocation.value.id,
    relationType: editForm.value.relationType,
  })

  // Close dialog (parent will handle the API call and reload)
  closeEditDialog()
  saving.value = false
}

function closeEditDialog() {
  showEditDialog.value = false
  editingLocation.value = null
  editForm.value = { relationType: '' }
}
</script>
