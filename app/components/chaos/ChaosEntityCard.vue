<template>
  <div
    class="chaos-entity-card"
    :class="{
      'chaos-entity-card--center': isCenter,
      'chaos-entity-card--highlighted': isHighlighted,
    }"
    :style="cardStyle"
    @mouseenter="$emit('hover', entity)"
    @mouseleave="$emit('hover', null)"
    @click="$emit('click', entity)"
  >
    <!-- Action Buttons (top right) -->
    <div class="chaos-entity-card__actions">
      <v-btn
        icon
        size="x-small"
        variant="text"
        density="compact"
        @click.stop="$emit('view', entity)"
      >
        <v-icon size="16">mdi-eye</v-icon>
        <v-tooltip activator="parent" location="top">{{ $t('common.view') }}</v-tooltip>
      </v-btn>
      <v-btn
        icon
        size="x-small"
        variant="text"
        density="compact"
        @click.stop="$emit('edit', entity)"
      >
        <v-icon size="16">mdi-pencil</v-icon>
        <v-tooltip activator="parent" location="top">{{ $t('common.edit') }}</v-tooltip>
      </v-btn>
    </div>

    <!-- Entity Image or Icon -->
    <div class="chaos-entity-card__avatar">
      <v-avatar v-if="entity.image_url" :size="isCenter ? 80 : 56">
        <v-img :src="`/uploads/${entity.image_url}`" cover />
      </v-avatar>
      <v-avatar v-else :size="isCenter ? 80 : 56" :color="entityType?.color || 'grey'">
        <v-icon :size="isCenter ? 40 : 28" color="white">
          {{ entityType?.icon || 'mdi-help' }}
        </v-icon>
      </v-avatar>
    </div>

    <!-- Entity Name -->
    <div class="chaos-entity-card__name" :class="{ 'text-body-1': isCenter, 'text-body-2': !isCenter }">
      {{ entity.name }}
    </div>

    <!-- Entity Type Badge -->
    <div class="chaos-entity-card__type">
      <v-chip :color="entityType?.color" size="x-small" variant="tonal">
        {{ entityType?.name }}
      </v-chip>
    </div>

    <!-- Relation Label (for connected entities) -->
    <div v-if="relationLabel" class="chaos-entity-card__relation">
      {{ relationLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Entity {
  id: number
  name: string
  description: string | null
  image_url: string | null
  type_id: number
  metadata: Record<string, unknown> | null
}

interface EntityType {
  id: number
  name: string
  icon: string
  color: string
}

const props = defineProps<{
  entity: Entity
  entityType: EntityType | null
  isCenter?: boolean
  isHighlighted?: boolean
  relationLabel?: string
}>()

defineEmits<{
  hover: [entity: Entity | null]
  click: [entity: Entity]
  view: [entity: Entity]
  edit: [entity: Entity]
}>()

const cardStyle = computed(() => {
  const borderColor = props.entityType?.color || '#888'
  return {
    '--card-border-color': borderColor,
  }
})
</script>

<style scoped>
.chaos-entity-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  background: rgb(var(--v-theme-surface));
  border: 2px solid var(--card-border-color, #888);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  width: 150px;
  height: 180px;
  position: relative;
  z-index: 5; /* Above back SVG lines (z-index: 1) */
}

.chaos-entity-card:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.chaos-entity-card--center {
  width: 180px;
  height: 200px;
  padding: 16px 20px;
  border-width: 3px;
  box-shadow: 0 4px 24px rgba(var(--v-theme-primary), 0.3);
}

.chaos-entity-card--highlighted {
  box-shadow: 0 0 20px var(--card-border-color);
  z-index: 20; /* Above the highlighted SVG line */
  position: relative;
  transform: scale(1.05);
}

.chaos-entity-card__actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.chaos-entity-card:hover .chaos-entity-card__actions {
  opacity: 1;
}

.chaos-entity-card__avatar {
  margin-bottom: 8px;
}

.chaos-entity-card__name {
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  max-width: 100%;
  min-height: 2.4em; /* Reserve space for 2 lines (1.2 line-height × 2) */
}

.chaos-entity-card__type {
  margin-top: 4px;
}

.chaos-entity-card__relation {
  margin-top: 8px;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
