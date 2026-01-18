<template>
  <v-dialog v-model="internalShow" max-width="600" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :icon="targetIcon" class="mr-2" />
        {{ dialogTitle }}
      </v-card-title>

      <v-chip class="mx-4 mb-2" size="small" color="primary" variant="tonal">
        {{ $t('quickLink.relationLabel', { relation: translatedRelationType }) }}
      </v-chip>

      <v-divider />

      <v-card-text>
        <!-- Search -->
        <v-text-field
          v-model="searchQuery"
          :placeholder="$t('quickLink.searchPlaceholder')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          autofocus
          class="mb-4"
          :loading="searching"
        />

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <!-- Entity List -->
        <v-list v-else-if="filteredEntities.length > 0" lines="two" class="entity-list">
          <v-list-item
            v-for="entity in filteredEntities"
            :key="entity.id"
            class="mb-1"
            rounded
            @click="selectEntity(entity)"
          >
            <template #prepend>
              <v-avatar :color="avatarColor" size="40">
                <v-img v-if="entity.image_url" :src="`/uploads/${entity.image_url}`" />
                <v-icon v-else :icon="targetIcon" />
              </v-avatar>
            </template>

            <v-list-item-title>{{ entity.name }}</v-list-item-title>
            <v-list-item-subtitle v-if="entity.description" class="text-truncate">
              {{ entity.description }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <!-- Empty State -->
        <div v-else class="text-center py-8 text-medium-emphasis">
          {{ $t('common.noResults') }}
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">
          {{ $t('common.cancel') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { QUICK_LINK_CONFIG } from '~~/types/quick-link'

const { t } = useI18n()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

interface Entity {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

interface Props {
  modelValue: boolean
  sourceEntity: { id: number; name: string }
  sourceType: string
  targetType: 'NPC' | 'Location' | 'Item' | 'Faction' | 'Lore' | 'Player'
  relationType: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  linked: [payload: { entityId: number; entityName: string }]
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// State
const searchQuery = ref('')
const searching = ref(false)
const loading = ref(false)
const entities = ref<Entity[]>([])
const linking = ref(false)
const existingLinkedIds = ref<Set<number>>(new Set())

let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Get target config for icon and i18n
const targetConfig = computed(() => {
  const configs = QUICK_LINK_CONFIG[props.sourceType] || []
  return configs.find((c) => c.targetType === props.targetType)
})

const targetIcon = computed(() => {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Location: 'mdi-map-marker',
    Item: 'mdi-sword',
    Faction: 'mdi-shield-account',
    Lore: 'mdi-book-open-variant',
    Player: 'mdi-account-star',
  }
  return icons[props.targetType] || 'mdi-help'
})

const avatarColor = computed(() => {
  const colors: Record<string, string> = {
    NPC: 'blue-lighten-4',
    Location: 'green-lighten-4',
    Item: 'orange-lighten-4',
    Faction: 'purple-lighten-4',
    Lore: 'brown-lighten-4',
    Player: 'cyan-lighten-4',
  }
  return colors[props.targetType] || 'grey-lighten-3'
})

const translatedRelationType = computed(() => {
  if (!targetConfig.value) return props.relationType
  return t(`${targetConfig.value.i18nPrefix}.${props.relationType}`, props.relationType)
})

const dialogTitle = computed(() => {
  const typeLabel = t(`entityTypes.${props.targetType}`)
  return t('quickLink.selectTitle', { type: typeLabel, name: props.sourceEntity.name })
})

const filteredEntities = computed(() => {
  // Filter out the source entity itself AND already linked entities
  return entities.value.filter(
    (e) => e.id !== props.sourceEntity.id && !existingLinkedIds.value.has(e.id),
  )
})

// Load existing linked entities (bidirectional) to filter them out
async function loadExistingLinkedEntities() {
  try {
    const typeMap: Record<string, string> = {
      NPC: 'npcs',
      Location: 'locations',
      Item: 'items',
      Faction: 'factions',
      Lore: 'lore',
      Player: 'players',
    }
    const typePath = typeMap[props.targetType] || props.targetType.toLowerCase()
    const linked = await $fetch<Array<{ from_entity_id: number; to_entity_id: number }>>(
      `/api/entities/${props.sourceEntity.id}/related/${typePath}`,
    )
    // Extract the linked entity IDs (could be from either direction)
    const ids = linked.map((r) =>
      r.from_entity_id === props.sourceEntity.id ? r.to_entity_id : r.from_entity_id,
    )
    existingLinkedIds.value = new Set(ids)
  } catch {
    // If it fails, just show all entities
    existingLinkedIds.value = new Set()
  }
}

// Load entities when dialog opens or target type changes
watch(
  [() => props.modelValue, () => props.targetType],
  async ([visible]) => {
    if (visible && props.targetType) {
      searchQuery.value = ''
      await loadExistingLinkedEntities()
      loadEntities()
    }
  },
  { immediate: true },
)

// Search debounce
watch(searchQuery, (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searching.value = true
  searchTimeout = setTimeout(() => loadEntities(query), 300)
})

async function loadEntities(search?: string) {
  if (!campaignStore.activeCampaignId) return

  loading.value = true

  const endpoint = getEndpointForType(props.targetType)
  const query: Record<string, string | number> = { campaignId: campaignStore.activeCampaignId }
  if (search?.trim()) {
    query.search = search.trim()
  }

  try {
    const data = await $fetch<Entity[]>(endpoint, { query })
    entities.value = data
  } catch (error) {
    console.error('Failed to load entities:', error)
    entities.value = []
  } finally {
    loading.value = false
    searching.value = false
  }
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

async function selectEntity(entity: Entity) {
  if (linking.value) return

  linking.value = true

  try {
    // Build relation body
    const body: {
      fromEntityId: number
      toEntityId: number
      relationType: string
      notes?: { quantity: number }
    } = {
      fromEntityId: props.sourceEntity.id,
      toEntityId: entity.id,
      relationType: props.relationType,
    }

    // Add default quantity for Item → NPC/Location relations (like in ItemEditDialog)
    if (props.sourceType === 'Item' && (props.targetType === 'NPC' || props.targetType === 'Location')) {
      body.notes = { quantity: 1 }
    }

    await $fetch('/api/entity-relations', {
      method: 'POST',
      body,
    })

    emit('linked', { entityId: entity.id, entityName: entity.name })
    snackbarStore.success(t('quickLink.linked', { name: entity.name }))
    close()
  } catch (error) {
    const err = error as { statusCode?: number }
    if (err.statusCode === 409) {
      snackbarStore.error(t('quickLink.alreadyLinked'))
    } else {
      console.error('Failed to create relation:', error)
      snackbarStore.error(t('common.error'))
    }
  } finally {
    linking.value = false
  }
}

function close() {
  emit('update:modelValue', false)
  searchQuery.value = ''
  existingLinkedIds.value = new Set()
}
</script>

<style scoped>
.entity-list {
  max-height: 400px;
  overflow-y: auto;
}
</style>
