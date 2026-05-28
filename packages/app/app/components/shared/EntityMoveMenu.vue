<template>
  <v-menu location="bottom end" :close-on-content-click="true">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        icon="mdi-folder-move-outline"
        size="small"
        variant="text"
        :color="currentFolderId ? 'primary' : undefined"
        @click.stop
      >
        <v-icon>mdi-folder-move-outline</v-icon>
        <v-tooltip activator="parent" location="bottom">
          {{ $t('folders.moveTo') }}
        </v-tooltip>
      </v-btn>
    </template>

    <v-list density="compact" min-width="220">
      <v-list-subheader>{{ $t('folders.moveTo') }}</v-list-subheader>

      <v-list-item
        v-if="currentFolderId !== null"
        prepend-icon="mdi-folder-remove-outline"
        :title="$t('folders.removeFromFolder')"
        @click.stop="onSelect(null)"
      />
      <v-divider v-if="currentFolderId !== null && folders.length > 0" />

      <v-list-item
        v-for="folder in folders"
        :key="folder.id"
        :prepend-icon="folder.icon || 'mdi-folder'"
        :title="folder.name"
        :disabled="folder.id === currentFolderId"
        @click.stop="onSelect(folder.id)"
      />

      <v-list-item
        v-if="folders.length === 0 && currentFolderId === null"
        :title="$t('folders.noneYet')"
        disabled
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import type { EntityFolderType } from '~~/types/folder'
import { useFoldersStore } from '~/stores/folders'

const props = defineProps<{
  entityId: number
  campaignId: number
  entityType: EntityFolderType
  currentFolderId: number | null
}>()

const emit = defineEmits<{
  moved: [payload: { entityId: number, fromFolderId: number | null, toFolderId: number | null }]
}>()

const foldersStore = useFoldersStore()

// Lazy: load on first menu open. Cheap-enough to also load eagerly since the
// store dedupes — keep eager so the menu is instant.
const folders = computed(() => foldersStore.folders(props.campaignId, props.entityType))

onMounted(() => {
  if (import.meta.client) {
    void foldersStore.load(props.campaignId, props.entityType)
  }
})

async function onSelect(toFolderId: number | null) {
  if (toFolderId === props.currentFolderId) return
  const from = props.currentFolderId
  await foldersStore.moveEntity(
    props.campaignId,
    props.entityType,
    props.entityId,
    from,
    toFolderId,
  )
  emit('moved', { entityId: props.entityId, fromFolderId: from, toFolderId })
}
</script>
