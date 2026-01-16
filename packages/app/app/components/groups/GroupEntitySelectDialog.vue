<template>
  <v-dialog v-model="internalShow" max-width="700" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-plus-circle</v-icon>
        {{ $t('groups.addEntities') }}
      </v-card-title>

      <v-divider />

      <v-card-text>
        <!-- Entity Type Selector -->
        <v-select
          v-model="selectedType"
          :items="entityTypes"
          :label="$t('groups.selectEntityType')"
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

        <v-list v-else-if="filteredEntities.length > 0" lines="two" style="max-height: 400px; overflow-y: auto">
          <v-list-item
            v-for="entity in filteredEntities"
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
              <v-chip v-if="isAlreadyInGroup(entity.id)" size="x-small" color="success" variant="tonal">
                {{ $t('groups.alreadyInGroup') }}
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
        <v-chip v-if="selectedEntityIds.length > 0" size="small" color="primary">
          {{ $t('groups.selectedCount', { count: selectedEntityIds.length }) }}
        </v-chip>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :disabled="selectedEntityIds.length === 0"
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
import type { GroupMember } from '~~/types/group'

const { t } = useI18n()
const campaignStore = useCampaignStore()

interface Entity {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

interface Props {
  modelValue: boolean
  groupId: number | null
  existingMembers?: GroupMember[]
}

const props = withDefaults(defineProps<Props>(), {
  existingMembers: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  added: [count: number]
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Entity type options
const entityTypes = [
  { title: t('npcs.title'), value: 'NPC' },
  { title: t('locations.title'), value: 'Location' },
  { title: t('items.title'), value: 'Item' },
  { title: t('factions.title'), value: 'Faction' },
  { title: t('lore.title'), value: 'Lore' },
  { title: t('players.title'), value: 'Player' },
]

const selectedType = ref('NPC')
const searchQuery = ref('')
const searching = ref(false)
const loading = ref(false)
const adding = ref(false)
const entities = ref<Entity[]>([])
const selectedEntityIds = ref<number[]>([])

let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Check if entity is already in group
function isAlreadyInGroup(entityId: number): boolean {
  return props.existingMembers.some((m) => m.entity_id === entityId)
}

// Filter out already selected/in-group entities for search
const filteredEntities = computed(() => {
  return entities.value
})

// Load entities when type changes
watch(selectedType, () => {
  selectedEntityIds.value = []
  loadEntities()
})

// Search debounce
watch(searchQuery, (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searching.value = true
  searchTimeout = setTimeout(() => loadEntities(query), 300)
})

// Load on open
watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      selectedEntityIds.value = []
      loadEntities()
    }
  },
)

async function loadEntities(search?: string) {
  if (!campaignStore.activeCampaignId) return

  loading.value = true

  const endpoint = getEndpointForType(selectedType.value)
  const query: Record<string, string | number> = { campaignId: campaignStore.activeCampaignId }
  if (search?.trim()) {
    query.search = search.trim()
  }

  const data = await $fetch<Entity[]>(endpoint, { query })
  entities.value = data
  loading.value = false
  searching.value = false
}

function getEndpointForType(type: string): string {
  const endpoints: Record<string, string> = {
    NPC: '/api/npcs',
    Location: '/api/locations',
    Item: '/api/items',
    Faction: '/api/factions',
    Lore: '/api/lore',
    Player: '/api/players',
  }
  return endpoints[type] || '/api/npcs'
}

function toggleEntity(entityId: number) {
  const index = selectedEntityIds.value.indexOf(entityId)
  if (index === -1) {
    selectedEntityIds.value.push(entityId)
  } else {
    selectedEntityIds.value.splice(index, 1)
  }
}

async function addSelected() {
  if (!props.groupId || selectedEntityIds.value.length === 0) return

  adding.value = true

  await $fetch(`/api/groups/${props.groupId}/members`, {
    method: 'POST',
    body: { entityIds: selectedEntityIds.value },
  })

  emit('added', selectedEntityIds.value.length)
  adding.value = false
  close()
}

function close() {
  emit('update:modelValue', false)
  searchQuery.value = ''
  selectedEntityIds.value = []
}

// Entity type icons
function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Location: 'mdi-map-marker',
    Item: 'mdi-sword',
    Faction: 'mdi-shield-account',
    Lore: 'mdi-book-open-variant',
    Player: 'mdi-account-star',
  }
  return icons[type] || 'mdi-help'
}

// Avatar color by type
function getAvatarColor(type: string): string {
  const colors: Record<string, string> = {
    NPC: 'blue-lighten-4',
    Location: 'green-lighten-4',
    Item: 'orange-lighten-4',
    Faction: 'purple-lighten-4',
    Lore: 'brown-lighten-4',
    Player: 'cyan-lighten-4',
  }
  return colors[type] || 'grey-lighten-3'
}
</script>
