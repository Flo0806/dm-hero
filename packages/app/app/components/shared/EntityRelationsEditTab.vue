<template>
  <div>
    <!-- Title -->
    <div class="text-h6 mb-4">
      {{ title }}
    </div>

    <!-- Relations List -->
    <v-list v-if="relations.length > 0" class="mb-3">
      <v-list-item v-for="relation in relations" :key="relation.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="relation.image_url" size="48">
            <v-img :src="`/uploads/${relation.image_url}`" />
          </v-avatar>
          <v-icon v-else :icon="icon" color="primary" />
        </template>

        <v-list-item-title>
          {{ relation.name }}
          <!-- Custom chips slot -->
          <slot name="title-chips" :relation="relation" />
        </v-list-item-title>

        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1">
            {{ getRelationTypeLabel(relation.relation_type) }}
          </v-chip>
          <!-- Custom subtitle slot -->
          <slot name="subtitle" :relation="relation" />
        </v-list-item-subtitle>

        <template #append>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', relation.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <!-- Add New Relation -->
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start> mdi-plus </v-icon>
          {{ addButtonLabel }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <!-- Entity Selection -->
          <v-select
            v-model="selectedEntityId"
            :items="availableEntities"
            item-title="name"
            item-value="id"
            :label="selectLabel"
            variant="outlined"
            class="mb-3"
          />

          <!-- Relation Type Selection -->
          <v-select
            v-model="selectedRelationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="relationTypeLabel"
            :placeholder="relationTypePlaceholder"
            variant="outlined"
            class="mb-3"
          />

          <!-- Custom Fields Slot (for quantity, equipped, etc.) -->
          <slot
            name="custom-fields"
            :selected-entity-id="selectedEntityId"
            :selected-relation-type="selectedRelationType"
          />

          <!-- Add Button -->
          <v-btn
            color="primary"
            prepend-icon="mdi-link"
            :disabled="!selectedEntityId || !selectedRelationType"
            :loading="adding"
            @click="handleAdd"
          >
            {{ addButtonLabel }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
interface Relation {
  id: number
  name: string
  relation_type: string
  image_url?: string | null
  notes?: Record<string, unknown> | null
  // Allow additional custom fields
  [key: string]: unknown
}

interface Entity {
  id: number
  name: string
}

interface RelationTypeSuggestion {
  title: string
  value: string
}

interface Props {
  relations: Relation[]
  availableEntities: Entity[]
  relationTypeSuggestions: RelationTypeSuggestion[]
  title: string
  addButtonLabel: string
  selectLabel: string
  relationTypeLabel: string
  relationTypePlaceholder?: string
  icon?: string
  adding?: boolean
  entityType?: 'npc' | 'location' | 'item' | 'faction' | 'lore'
}

const props = withDefaults(defineProps<Props>(), {
  relationTypePlaceholder: '',
  icon: 'mdi-link',
  adding: false,
  entityType: 'npc',
})

const emit = defineEmits<{
  remove: [relationId: number]
  add: [data: { entityId: number; relationType: string }]
}>()

const { t } = useI18n()

// Local state for add form
const selectedEntityId = ref<number | null>(null)
const selectedRelationType = ref<string | null>(null)

function handleAdd() {
  if (!selectedEntityId.value || !selectedRelationType.value) return

  emit('add', {
    entityId: selectedEntityId.value,
    relationType: selectedRelationType.value,
  })

  // Reset form
  selectedEntityId.value = null
  selectedRelationType.value = null
}

function getRelationTypeLabel(relationType: string): string {
  // Try entity-specific translation first
  const entitySpecificKey = `${props.entityType}s.relationTypes.${relationType}`
  const translated = t(entitySpecificKey)

  // If translation exists, use it; otherwise fallback to relationType
  return translated !== entitySpecificKey ? translated : relationType
}
</script>
