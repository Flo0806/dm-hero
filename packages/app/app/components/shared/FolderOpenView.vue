<template>
  <div>
    <!-- Header: icon + name + close -->
    <div class="d-flex align-center mb-4">
      <v-icon
        :icon="folder.icon || 'mdi-folder-open'"
        :color="folder.color || 'primary'"
        size="40"
        class="mr-3 flex-shrink-0"
      />
      <div class="flex-grow-1" style="min-width: 0">
        <h2 class="text-headline-medium text-truncate" :title="folder.name">
          {{ folder.name }}
        </h2>
        <div class="text-body-small text-medium-emphasis">
          {{ $t('folders.entityCount', folder.entity_count) }}
        </div>
      </div>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        :title="$t('common.close')"
        @click="$emit('close')"
      />
    </div>

    <v-divider class="mb-4" />

    <!-- Top: entities in this folder (~2/3) -->
    <div class="text-overline text-medium-emphasis mb-2">
      {{ $t('folders.contentsLabel') }}
    </div>
    <div class="folder-contents mb-4">
      <slot name="contents" />
    </div>

    <v-divider class="mb-4" />

    <!-- Bottom: entities without a folder, compact (~1/3 drag pool) -->
    <div class="text-overline text-medium-emphasis mb-2">
      {{ $t('folders.poolLabel') }}
    </div>
    <div class="folder-pool">
      <slot name="pool" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EntityFolderWithCount } from '~~/types/folder'

defineProps<{ folder: EntityFolderWithCount }>()
const emit = defineEmits<{ close: [] }>()

// Close on ESC. Listener is global but only while this view is mounted.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  if (import.meta.client) window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKeydown)
})
</script>
