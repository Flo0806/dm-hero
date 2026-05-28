<template>
  <v-card
    hover
    density="compact"
    class="d-flex align-center pa-2 ga-2"
    :draggable="draggable"
    :style="{ cursor: draggable ? 'grab' : 'pointer' }"
    @click="$emit('open', entity)"
    @dragstart="onDragStart"
  >
    <v-avatar
      :color="entity.image_url ? undefined : 'grey-lighten-2'"
      size="32"
      rounded="lg"
      class="flex-shrink-0"
    >
      <v-img v-if="entity.image_url" :src="`/uploads/${entity.image_url}`" cover />
      <v-icon v-else :icon="fallbackIcon" size="18" color="grey" />
    </v-avatar>

    <div class="flex-grow-1 text-truncate">
      <div class="text-body-small font-weight-medium text-truncate">
        {{ entity.name }}
      </div>
      <div v-if="entity.subtitle" class="text-caption text-medium-emphasis text-truncate">
        {{ entity.subtitle }}
      </div>
    </div>

    <v-icon
      v-if="draggable"
      icon="mdi-drag-vertical"
      size="16"
      class="text-medium-emphasis flex-shrink-0"
    />
  </v-card>
</template>

<script setup lang="ts">
/**
 * Compact entity card — name + thumb + optional subtitle. Used for the
 * folder view's "drag-pool" overview below the open folder.
 *
 * Stays type-agnostic on purpose: caller passes `fallbackIcon` to match the
 * entity type (mdi-account for NPC, mdi-sword for Item, etc.) and an optional
 * subtitle (race, type, faction-tag, …).
 */
export interface CompactEntity {
  id: number
  name: string
  image_url?: string | null
  subtitle?: string | null
}

const props = withDefaults(
  defineProps<{
    entity: CompactEntity
    fallbackIcon?: string
    draggable?: boolean
  }>(),
  { fallbackIcon: 'mdi-circle-outline', draggable: false },
)

const emit = defineEmits<{
  'open': [entity: CompactEntity]
  'drag-start': [entity: CompactEntity, event: DragEvent]
}>()

function onDragStart(event: DragEvent) {
  if (!event.dataTransfer) return
  emit('drag-start', props.entity, event)
}
</script>
