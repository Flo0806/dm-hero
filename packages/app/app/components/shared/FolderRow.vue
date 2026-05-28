<template>
  <div>
    <!-- Header: title + create button -->
    <div class="d-flex align-center mb-3">
      <h3 class="text-headline-small flex-grow-1">
        {{ $t('folders.title') }}
        <span v-if="folders.length > 0" class="text-medium-emphasis text-body-medium ml-2">
          ({{ folders.length }})
        </span>
      </h3>
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-folder-plus-outline"
        @click="openCreate"
      >
        {{ $t('folders.create') }}
      </v-btn>
    </div>

    <!-- Folder cards -->
    <v-row v-if="folders.length > 0" class="mb-2">
      <v-col
        v-for="folder in folders"
        :key="folder.id"
        cols="12"
        md="6"
        lg="4"
      >
        <FoldersFolderCard
          :folder="folder"
          @open="$emit('open', folder)"
          @edit="openEdit"
          @delete="confirmDelete"
        />
      </v-col>
    </v-row>

    <!-- Divider before entities -->
    <v-divider class="mb-4 mt-2" />

    <!-- Internal dialogs -->
    <FoldersFolderEditDialog
      v-model:show="showEditDialog"
      :campaign-id="campaignId"
      :entity-type="entityType"
      :folder="editingFolder"
      @saved="onSaved"
    />

    <v-dialog v-model="showDeleteConfirm" max-width="440">
      <v-card v-if="deletingFolder">
        <v-card-title>{{ $t('folders.deleteTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('folders.deleteConfirm', { name: deletingFolder.name }) }}
          <div v-if="deletingFolder.entity_count > 0" class="text-medium-emphasis text-body-small mt-2">
            {{ $t('folders.deleteCascadeHint', deletingFolder.entity_count) }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteConfirm = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" variant="flat" :loading="deleting" @click="doDelete">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import type { EntityFolderType, EntityFolderWithCount, EntityFolder } from '~~/types/folder'
import { useFoldersStore } from '~/stores/folders'

const props = defineProps<{
  campaignId: number
  entityType: EntityFolderType
}>()

const emit = defineEmits<{
  open: [folder: EntityFolderWithCount]
  changed: []
}>()

const foldersStore = useFoldersStore()

const folders = computed(() => foldersStore.folders(props.campaignId, props.entityType))

onMounted(() => {
  if (import.meta.client) {
    void foldersStore.load(props.campaignId, props.entityType)
  }
})

// Reload when campaign or type changes (page-level switch)
watch(
  () => [props.campaignId, props.entityType] as const,
  ([cid, type]) => {
    if (import.meta.client) void foldersStore.load(cid, type)
  },
)

// --- Create / Edit ---
const showEditDialog = ref(false)
const editingFolder = ref<EntityFolderWithCount | null>(null)

function openCreate() {
  editingFolder.value = null
  showEditDialog.value = true
}

function openEdit(folder: EntityFolderWithCount) {
  editingFolder.value = folder
  showEditDialog.value = true
}

function onSaved(_folder: EntityFolder) {
  // Store invalidates the cache; trigger a fresh load.
  void foldersStore.load(props.campaignId, props.entityType, true)
  emit('changed')
}

// --- Delete ---
const showDeleteConfirm = ref(false)
const deletingFolder = ref<EntityFolderWithCount | null>(null)
const deleting = ref(false)

function confirmDelete(folder: EntityFolderWithCount) {
  deletingFolder.value = folder
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!deletingFolder.value) return
  deleting.value = true
  try {
    await foldersStore.remove(props.campaignId, props.entityType, deletingFolder.value.id)
    await foldersStore.load(props.campaignId, props.entityType, true)
    showDeleteConfirm.value = false
    deletingFolder.value = null
    emit('changed')
  }
  finally {
    deleting.value = false
  }
}
</script>
