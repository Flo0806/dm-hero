<template>
  <v-dialog v-model="internalShow" max-width="700" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-account-plus</v-icon>
        {{ $t('encounters.addParticipants') }}
      </v-card-title>

      <v-divider />

      <v-card-text>
        <!-- Entity Type Selector -->
        <v-select
          v-model="selectedType"
          :items="entityTypes"
          :label="$t('encounters.selectType')"
          variant="outlined"
          density="compact"
          class="mb-4"
        />

        <!-- Search -->
        <v-text-field
          v-model="searchQuery"
          :placeholder="$t('common.search')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          class="mb-4"
          :loading="searching"
        />

        <!-- Entity List -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <v-list v-else-if="entities.length > 0" lines="two" style="max-height: 400px; overflow-y: auto">
          <v-list-item
            v-for="entity in entities"
            :key="entity.id"
            :value="entity.id"
            :active="selectedEntityIds.includes(entity.id)"
            @click="toggleEntity(entity.id)"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="selectedEntityIds.includes(entity.id)"
                @update:model-value="toggleEntity(entity.id)"
              />
              <v-avatar :color="getAvatarColor(selectedType)" size="40" class="ml-2">
                <v-img v-if="entity.image_url" :src="`/uploads/${entity.image_url}`" />
                <v-icon v-else>{{ getEntityIcon(selectedType) }}</v-icon>
              </v-avatar>
            </template>

            <v-list-item-title>{{ entity.name }}</v-list-item-title>
            <v-list-item-subtitle v-if="entity.description" class="text-truncate">
              {{ entity.description }}
            </v-list-item-subtitle>

            <template #append>
              <v-chip
                v-if="isInEncounter(entity.id)"
                size="x-small"
                color="info"
                variant="tonal"
              >
                {{ $t('encounters.alreadyInEncounter') }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>

        <div v-else class="text-center py-8 text-medium-emphasis">
          {{ $t('common.noResults') }}
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-chip v-if="totalSelectedCount > 0" size="small" color="primary">
          {{ totalSelectedCount }}
        </v-chip>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :disabled="totalSelectedCount === 0"
          :loading="adding"
          @click="addSelected"
        >
          {{ $t('common.add') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { EncounterParticipant } from '~~/types/encounter'

const { t } = useI18n()
const campaignStore = useCampaignStore()
const encounterStore = useEncounterStore()
const snackbarStore = useSnackbarStore()

interface Entity {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  encounterId: number
  existingParticipants?: EncounterParticipant[]
}>(), {
  existingParticipants: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'added': []
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

// Only NPC and Player for combat
const entityTypes = [
  { title: t('npcs.title'), value: 'NPC' },
  { title: t('players.title'), value: 'Player' },
]

const selectedType = ref('NPC')
const searchQuery = ref('')
const searching = ref(false)
const loading = ref(false)
const adding = ref(false)
const entities = ref<Entity[]>([])
const selectedEntityIdsByType = ref<Record<string, number[]>>({})

const selectedEntityIds = computed({
  get: () => selectedEntityIdsByType.value[selectedType.value] || [],
  set: (ids: number[]) => {
    selectedEntityIdsByType.value[selectedType.value] = ids
  },
})

const totalSelectedCount = computed(() => {
  return Object.values(selectedEntityIdsByType.value).reduce((sum, ids) => sum + ids.length, 0)
})

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function isInEncounter(entityId: number): boolean {
  return props.existingParticipants.some(p => p.entity_id === entityId)
}

watch(selectedType, () => {
  loadEntities()
})

watch(searchQuery, (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searching.value = true
  searchTimeout = setTimeout(() => loadEntities(query), 300)
})

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      selectedEntityIdsByType.value = {}
      selectedType.value = 'NPC'
      searchQuery.value = ''
      loadEntities()
    }
  },
)

async function loadEntities(search?: string) {
  if (!campaignStore.activeCampaignId) return

  loading.value = true
  const endpoint = selectedType.value === 'Player' ? '/api/players' : '/api/npcs'
  const query: Record<string, string | number> = { campaignId: campaignStore.activeCampaignId }
  if (search?.trim()) {
    query.search = search.trim()
  }

  try {
    const data = await $fetch<Entity[]>(endpoint, { query })
    entities.value = data
  }
  catch {
    entities.value = []
  }
  finally {
    loading.value = false
    searching.value = false
  }
}

function toggleEntity(entityId: number) {
  const currentIds = selectedEntityIds.value
  const index = currentIds.indexOf(entityId)
  if (index === -1) {
    selectedEntityIds.value = [...currentIds, entityId]
  }
  else {
    selectedEntityIds.value = currentIds.filter(id => id !== entityId)
  }
}

async function addSelected() {
  const allSelectedIds = Object.values(selectedEntityIdsByType.value).flat()
  if (allSelectedIds.length === 0) return

  adding.value = true
  try {
    const success = await encounterStore.addParticipants(props.encounterId, allSelectedIds)
    if (success) {
      snackbarStore.success(t('encounters.participantAdded'))
      emit('added')
      close()
    }
    else {
      snackbarStore.error(t('common.error'))
    }
  }
  finally {
    adding.value = false
  }
}

function close() {
  emit('update:modelValue', false)
  searchQuery.value = ''
  selectedEntityIdsByType.value = {}
}

function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Player: 'mdi-account-star',
  }
  return icons[type] || 'mdi-help'
}

function getAvatarColor(type: string): string {
  const colors: Record<string, string> = {
    NPC: 'blue-lighten-4',
    Player: 'cyan-lighten-4',
  }
  return colors[type] || 'grey-lighten-3'
}
</script>
