<template>
  <v-dialog v-model="dialogOpen" max-width="700" scrollable>
    <v-card v-if="entity">
      <v-card-title class="d-flex align-center">
        <v-icon :icon="entityIcon" :color="entityColor" class="mr-2" />
        {{ entity.name }}
        <template v-if="entityType === 'player' && entity.player_name">
          <span class="text-body-2 text-medium-emphasis ml-2">
            ({{ entity.player_name }})
          </span>
        </template>
      </v-card-title>

      <v-card-text style="max-height: 60vh">
        <!-- NPC Details -->
        <template v-if="entityType === 'npc'">
          <v-img
            v-if="entity.image_url"
            :src="`/uploads/${entity.image_url}`"
            :alt="entity.name"
            max-height="300"
            class="mb-4 rounded"
            cover
          />
          <div v-if="entity.description" class="text-body-1 mb-4">
            {{ entity.description }}
          </div>
          <v-divider class="my-4" />
          <div class="text-body-2">
            <div v-if="entity.race" class="mb-2">
              <strong>{{ $t('npcs.race') }}:</strong> {{ entity.race }}
            </div>
            <div v-if="entity.class" class="mb-2">
              <strong>{{ $t('npcs.class') }}:</strong> {{ entity.class }}
            </div>
            <div v-if="entity.faction" class="mb-2">
              <strong>{{ $t('npcs.faction') }}:</strong> {{ entity.faction }}
            </div>
          </div>
          <div v-if="entity.notes" class="mt-4">
            <strong>{{ $t('common.notes') }}:</strong>
            <div class="text-body-2 mt-2">{{ entity.notes }}</div>
          </div>
        </template>

        <!-- Location Details -->
        <template v-if="entityType === 'location'">
          <v-img
            v-if="entity.image_url"
            :src="`/uploads/${entity.image_url}`"
            :alt="entity.name"
            max-height="300"
            class="mb-4 rounded"
            cover
          />
          <div v-if="entity.description" class="text-body-1 mb-4">
            {{ entity.description }}
          </div>
          <v-divider class="my-4" />
          <div class="text-body-2">
            <div v-if="entity.type" class="mb-2">
              <strong>{{ $t('locations.type') }}:</strong> {{ entity.type }}
            </div>
            <div v-if="entity.region" class="mb-2">
              <strong>{{ $t('locations.region') }}:</strong> {{ entity.region }}
            </div>
          </div>
          <div v-if="entity.notes" class="mt-4">
            <strong>{{ $t('common.notes') }}:</strong>
            <div class="text-body-2 mt-2">{{ entity.notes }}</div>
          </div>
        </template>

        <!-- Item Details -->
        <template v-if="entityType === 'item'">
          <div class="position-relative">
            <v-img
              v-if="entity.image_url"
              :src="`/uploads/${entity.image_url}`"
              :alt="entity.name"
              max-height="300"
              class="mb-4 rounded"
              cover
            />
            <v-chip
              v-if="entity.rarity"
              :color="getRarityColor(entity.rarity)"
              class="position-absolute"
              style="top: 8px; right: 8px"
            >
              {{ $t(`items.rarities.${entity.rarity}`) }}
            </v-chip>
          </div>
          <div v-if="entity.description" class="text-body-1 mb-4">
            {{ entity.description }}
          </div>
          <v-divider class="my-4" />
          <div class="d-flex flex-wrap gap-2 mb-3">
            <v-chip v-if="entity.type" variant="tonal">
              <v-icon start>mdi-tag</v-icon>
              {{ $t(`items.types.${entity.type}`) }}
            </v-chip>
            <v-chip v-if="entity.attunement" color="purple" variant="tonal">
              <v-icon start>mdi-auto-fix</v-icon>
              {{ $t('items.requiresAttunement') }}
            </v-chip>
          </div>
          <div v-if="entity.notes" class="mt-4">
            <strong>{{ $t('common.notes') }}:</strong>
            <div class="text-body-2 mt-2">{{ entity.notes }}</div>
          </div>
        </template>

        <!-- Faction Details -->
        <template v-if="entityType === 'faction'">
          <v-img
            v-if="entity.image_url"
            :src="`/uploads/${entity.image_url}`"
            :alt="entity.name"
            max-height="300"
            class="mb-4 rounded"
            cover
          />
          <div v-if="entity.description" class="text-body-1 mb-4">
            {{ entity.description }}
          </div>
          <v-divider class="my-4" />
          <div class="text-body-2">
            <div v-if="entity.leader" class="mb-2">
              <strong>{{ $t('factions.leader') }}:</strong> {{ entity.leader }}
            </div>
            <div v-if="entity.alignment" class="mb-2">
              <strong>{{ $t('factions.alignment') }}:</strong> {{ entity.alignment }}
            </div>
          </div>
          <div v-if="entity.goals" class="mt-4">
            <strong>{{ $t('factions.goals') }}:</strong>
            <div class="text-body-2 mt-2">{{ entity.goals }}</div>
          </div>
          <div v-if="entity.notes" class="mt-4">
            <strong>{{ $t('common.notes') }}:</strong>
            <div class="text-body-2 mt-2">{{ entity.notes }}</div>
          </div>
        </template>

        <!-- Lore Details -->
        <template v-if="entityType === 'lore'">
          <v-img
            v-if="entity.image_url"
            :src="`/uploads/${entity.image_url}`"
            :alt="entity.name"
            max-height="300"
            class="mb-4 rounded"
            cover
          />
          <div v-if="entity.description" class="text-body-1 mb-4">
            {{ entity.description }}
          </div>
          <v-divider class="my-4" />
          <div class="text-body-2">
            <div v-if="entity.type" class="mb-2">
              <strong>{{ $t('lore.type') }}:</strong>
              {{ $t(`lore.types.${entity.type}`) }}
            </div>
            <div v-if="entity.date" class="mb-2">
              <strong>{{ $t('lore.date') }}:</strong> {{ entity.date }}
            </div>
          </div>
          <div v-if="entity.notes" class="mt-4">
            <strong>{{ $t('common.notes') }}:</strong>
            <div class="text-body-2 mt-2">{{ entity.notes }}</div>
          </div>
        </template>

        <!-- Player Details -->
        <template v-if="entityType === 'player'">
          <v-img
            v-if="entity.image_url"
            :src="`/uploads/${entity.image_url}`"
            :alt="entity.name"
            max-height="300"
            class="mb-4 rounded"
            cover
          />
          <div v-if="entity.description" class="text-body-1 mb-4">
            {{ entity.description }}
          </div>
          <v-divider class="my-4" />
          <div class="text-body-2">
            <div v-if="entity.player_name" class="mb-2">
              <strong>{{ $t('players.playerName') }}:</strong> {{ entity.player_name }}
            </div>
            <div v-if="entity.email" class="mb-2">
              <strong>{{ $t('players.email') }}:</strong> {{ entity.email }}
            </div>
            <div v-if="entity.discord" class="mb-2">
              <strong>{{ $t('players.discord') }}:</strong> {{ entity.discord }}
            </div>
          </div>
          <div v-if="entity.notes" class="mt-4">
            <strong>{{ $t('common.notes') }}:</strong>
            <div class="text-body-2 mt-2">{{ entity.notes }}</div>
          </div>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-open-in-new" @click="goToPage">
          {{ $t('sessions.goToPage') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
export type EntityPreviewType = 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player'

interface Props {
  modelValue: boolean
  entityType: EntityPreviewType
  entityId: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  navigate: [type: EntityPreviewType, id: number, name: string]
}>()

const router = useRouter()

// Dialog state
const dialogOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Entity data - using generic interface for all entity types
interface GenericEntity {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
  notes?: string | null
  [key: string]: unknown
}
const entity = ref<GenericEntity | null>(null)
const loading = ref(false)

// Entity type config
const entityConfig: Record<
  EntityPreviewType,
  { icon: string; color: string; endpoint: string; route: string }
> = {
  npc: { icon: 'mdi-account', color: 'blue', endpoint: '/api/npcs', route: '/npcs' },
  location: { icon: 'mdi-map-marker', color: 'green', endpoint: '/api/locations', route: '/locations' },
  item: { icon: 'mdi-sword', color: 'amber', endpoint: '/api/items', route: '/items' },
  faction: { icon: 'mdi-flag', color: 'purple', endpoint: '/api/factions', route: '/factions' },
  lore: { icon: 'mdi-book-open-variant', color: 'orange', endpoint: '/api/lore', route: '/lore' },
  player: { icon: 'mdi-account-star', color: 'pink', endpoint: '/api/players', route: '/players' },
}

const entityIcon = computed(() => entityConfig[props.entityType]?.icon || 'mdi-help')
const entityColor = computed(() => entityConfig[props.entityType]?.color || 'grey')

// Load entity when ID changes
watch(
  () => [props.entityId, props.modelValue],
  async ([newId, isOpen]) => {
    if (newId && isOpen) {
      await loadEntity(newId as number)
    }
  },
  { immediate: true },
)

async function loadEntity(id: number) {
  loading.value = true
  try {
    const config = entityConfig[props.entityType]
    entity.value = await $fetch<GenericEntity>(`${config.endpoint}/${id}`)
  } catch (error) {
    console.error('Failed to load entity:', error)
    entity.value = null
  } finally {
    loading.value = false
  }
}

function getRarityColor(rarity: unknown): string {
  const colors: Record<string, string> = {
    common: 'grey',
    uncommon: 'green',
    rare: 'blue',
    very_rare: 'purple',
    legendary: 'orange',
    artifact: 'red',
  }
  return (typeof rarity === 'string' && colors[rarity]) || 'grey'
}

function goToPage() {
  if (!entity.value) return
  const config = entityConfig[props.entityType]
  const entityName = entity.value.name as string
  // Use search + highlight params so the entity is visible and highlighted
  router.push(`${config.route}?search=${encodeURIComponent(entityName)}&highlight=${props.entityId}`)
  close()
}

function close() {
  emit('update:modelValue', false)
}
</script>
