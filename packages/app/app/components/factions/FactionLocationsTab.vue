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
            {{ location.relation_type }}
          </v-chip>
        </v-list-item-subtitle>
        <template #append>
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
      class="mb-3"
    />

    <v-combobox
      v-model="localRelationType"
      :items="relationTypeSuggestions"
      :label="$t('factions.locationType')"
      :placeholder="$t('factions.locationTypePlaceholder')"
      variant="outlined"
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
  (e: 'remove', relationId: number): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()

const localLocationId = ref<number | null>(null)
const localRelationType = ref('')

const relationTypeSuggestions = computed(() => [
  t('factions.locationTypes.headquarters'),
  t('factions.locationTypes.hideout'),
  t('factions.locationTypes.meetingPlace'),
  t('factions.locationTypes.territory'),
  t('factions.locationTypes.safehouse'),
  t('factions.locationTypes.baseOfOperations'),
])

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
</script>
