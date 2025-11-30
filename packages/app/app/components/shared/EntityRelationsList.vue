<template>
  <div class="pa-4">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="entities.length === 0" class="text-center py-8 text-medium-emphasis">
      {{ emptyMessage }}
    </div>

    <!-- Entity List -->
    <v-list v-else lines="two">
      <v-list-item
        v-for="entity in entities"
        :key="entity.id"
        class="mb-2"
        :style="clickable ? 'cursor: pointer' : ''"
        @click="clickable ? $emit('click', entity.id) : null"
      >
        <!-- Avatar -->
        <template #prepend>
          <v-avatar :color="getAvatarColor()" size="48">
            <v-img v-if="entity.image_url" :src="`/uploads/${entity.image_url}`" />
            <v-icon v-else>{{ getIcon() }}</v-icon>
          </v-avatar>
        </template>

        <!-- Title -->
        <v-list-item-title class="font-weight-medium">
          {{ entity.name }}
          <!-- Rarity Chip (for Items) -->
          <v-chip v-if="entity.rarity" size="x-small" :color="getRarityColor(entity.rarity)" class="ml-2">
            {{ $t(`items.rarities.${entity.rarity}`) }}
          </v-chip>
        </v-list-item-title>

        <!-- Subtitle with Metadata Chips -->
        <v-list-item-subtitle>
          <div class="d-flex align-center gap-2 mt-1">
            <!-- Relation Type Chip -->
            <v-chip v-if="showRelationType && entity.relation_type" size="x-small" color="primary" variant="tonal">
              {{ getRelationTypeLabel(entity.relation_type) }}
            </v-chip>

            <!-- Item-specific metadata -->
            <template v-if="entityType === 'item'">
              <v-chip v-if="entity.quantity && entity.quantity > 1" size="x-small" variant="outlined">
                {{ entity.quantity }}x
              </v-chip>
              <v-chip v-if="entity.equipped" size="x-small" color="success" variant="tonal">
                {{ $t('npcs.equipped') }}
              </v-chip>
            </template>

            <!-- Location-specific metadata -->
            <v-chip v-if="entityType === 'location' && entity.type" size="x-small" variant="outlined">
              {{ $t(`locations.types.${entity.type}`) }}
            </v-chip>

            <!-- Description -->
            <span v-if="entity.description" class="text-caption text-medium-emphasis">
              {{ entity.description }}
            </span>
          </div>
        </v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
interface Entity {
  id: number
  name: string
  description?: string | null
  relation_type?: string
  image_url?: string | null
  direction?: 'outgoing' | 'incoming'
  // Item-specific
  rarity?: string
  quantity?: number
  equipped?: boolean
  // Location-specific
  type?: string
  region?: string
}

interface Props {
  entities: Entity[]
  loading?: boolean
  entityType: 'item' | 'location' | 'lore' | 'npc' | 'faction'
  emptyMessage: string
  showRelationType?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showRelationType: true,
  clickable: true,
})

defineEmits<{
  click: [entityId: number]
}>()

const { t } = useI18n()

// Helper functions
function getIcon(): string {
  const icons: Record<string, string> = {
    item: 'mdi-treasure-chest',
    location: 'mdi-map-marker',
    lore: 'mdi-book-open-variant',
    npc: 'mdi-account',
    faction: 'mdi-shield-account',
  }
  return icons[props.entityType] || 'mdi-help'
}

function getAvatarColor(): string {
  const colors: Record<string, string> = {
    item: 'secondary',
    location: 'accent',
    lore: 'grey-lighten-2',
    npc: 'primary',
    faction: 'secondary',
  }
  return colors[props.entityType] || 'grey'
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: 'grey',
    uncommon: 'green',
    rare: 'blue',
    very_rare: 'purple',
    legendary: 'orange',
    artifact: 'red',
  }
  return colors[rarity] || 'grey'
}

function getRelationTypeLabel(relationType: string): string {
  // Try entity-specific translation first
  const entitySpecificKey = `${props.entityType}s.relationTypes.${relationType}`
  const translated = t(entitySpecificKey)

  // If translation exists, use it; otherwise fallback to relationType
  return translated !== entitySpecificKey ? translated : relationType
}
</script>
