<template>
  <v-container>
    <UiPageHeader :title="$t('groups.title')" :subtitle="$t('groups.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openCreateDialog">
          {{ $t('groups.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Search Bar -->
    <v-text-field
      v-model="searchQuery"
      :placeholder="$t('groups.searchPlaceholder')"
      prepend-inner-icon="mdi-magnify"
      :loading="searching"
      variant="outlined"
      clearable
      class="mb-4"
    />

    <!-- Loading State -->
    <v-row v-if="loading">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Group Cards -->
    <div v-else-if="filteredGroups && filteredGroups.length > 0" class="position-relative">
      <!-- Search Loading Overlay -->
      <v-overlay
        :model-value="searching"
        contained
        persistent
        class="align-center justify-center"
        scrim="surface"
        opacity="0.8"
      >
        <div class="text-center">
          <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
          <div class="text-h6">{{ $t('common.searching') }}</div>
        </div>
      </v-overlay>

      <!-- Group Cards -->
      <v-row>
        <v-col v-for="group in filteredGroups" :key="group.id" cols="12" md="6" lg="4">
          <GroupCard
            :group="group"
            :counts="groupCounts[group.id]"
            :is-highlighted="highlightedId === group.id"
            @view="viewGroup"
            @edit="editGroup"
            @delete="deleteGroup"
            @add-member="handleContextMenuAddMember"
          />
        </v-col>
      </v-row>
    </div>

    <!-- Empty State -->
    <ClientOnly v-else>
      <v-empty-state icon="mdi-folder-multiple-outline" :title="$t('groups.empty')" :text="$t('groups.emptyText')">
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
            {{ $t('groups.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-folder-multiple-outline" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('groups.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('groups.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
            {{ $t('groups.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- Create/Edit Dialog -->
    <ClientOnly>
      <GroupEditDialog
        :show="showEditDialog"
        :group-id="editingGroupId"
        @update:show="handleDialogClose"
        @saved="handleGroupSaved"
        @created="handleGroupCreated"
      />
    </ClientOnly>

    <!-- View Dialog -->
    <ClientOnly>
      <GroupViewDialog
        ref="viewDialogRef"
        v-model="showViewDialog"
        :group="viewingGroup"
        @edit="handleViewEdit"
        @add-entities="handleAddEntities"
        @delete-all="handleDeleteAll"
        @member-removed="handleMemberRemoved"
        @member-click="handleMemberClick"
      />
    </ClientOnly>

    <!-- Delete Confirmation Dialog -->
    <ClientOnly>
      <UiDeleteConfirmDialog
        v-model="showDeleteDialog"
        :title="$t('groups.deleteTitle')"
        :message="$t('groups.deleteConfirm', { name: deletingGroup?.name })"
        :loading="deleting"
        @confirm="confirmDelete"
        @cancel="showDeleteDialog = false"
      />
    </ClientOnly>

    <!-- Delete All Confirmation Dialog -->
    <ClientOnly>
      <UiDeleteConfirmDialog
        v-model="showDeleteAllDialog"
        :title="$t('groups.deleteAllTitle')"
        :message="$t('groups.deleteAllConfirm', { name: deleteAllGroup?.name, count: deleteAllGroupCount })"
        :loading="deletingAll"
        @confirm="confirmDeleteAll"
        @cancel="showDeleteAllDialog = false"
      />
    </ClientOnly>

    <!-- Add Entities Dialog -->
    <ClientOnly>
      <GroupEntitySelectDialog
        v-model="showEntitySelectDialog"
        :group-id="entitySelectGroupId"
        :existing-members="entitySelectExistingMembers"
        :default-entity-type="defaultEntityType"
        @added="handleEntitiesAdded"
      />
    </ClientOnly>

    <!-- Floating Action Button -->
    <v-btn color="primary" icon="mdi-plus" size="large" class="fab-create" @click="openCreateDialog" />
  </v-container>
</template>

<script setup lang="ts">
import type { EntityGroup, GroupCounts, GroupMember } from '~~/types/group'
import GroupCard from '~/components/groups/GroupCard.vue'
import GroupEditDialog from '~/components/groups/GroupEditDialog.vue'
import GroupViewDialog from '~/components/groups/GroupViewDialog.vue'
import GroupEntitySelectDialog from '~/components/groups/GroupEntitySelectDialog.vue'

const { t } = useI18n()
const router = useRouter()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Data
const groups = ref<EntityGroup[]>([])
const groupCounts = ref<Record<number, GroupCounts>>({})
const loading = ref(true)

// Search
const searchQuery = ref('')
const searchResults = ref<EntityGroup[]>([])
const searching = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Load groups
async function loadGroups() {
  if (!activeCampaignId.value) return

  loading.value = true
  const data = await $fetch<EntityGroup[]>('/api/groups', {
    query: { campaignId: activeCampaignId.value },
  })
  groups.value = data

  // Load counts
  if (data.length > 0) {
    await loadBatchCounts(data.map((g) => g.id))
  }

  loading.value = false
}

async function loadBatchCounts(ids: number[]) {
  if (ids.length === 0) return

  const counts = await $fetch<Record<number, GroupCounts>>('/api/groups/batch-counts', {
    query: { ids: ids.join(',') },
  })
  groupCounts.value = { ...groupCounts.value, ...counts }
}

// Search
async function executeSearch(query: string) {
  if (!activeCampaignId.value) return

  searching.value = true
  const results = await $fetch<EntityGroup[]>('/api/groups', {
    query: { campaignId: activeCampaignId.value, search: query.trim() },
  })
  searchResults.value = results

  if (results.length > 0) {
    await loadBatchCounts(results.map((g) => g.id))
  }

  searching.value = false
}

watch(searchQuery, async (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  if (!query || query.trim().length === 0) {
    searchResults.value = []
    searching.value = false
    return
  }

  searching.value = true
  searchTimeout = setTimeout(() => executeSearch(query), 300)
})

const filteredGroups = computed(() => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }
  return [...groups.value].sort((a, b) => a.name.localeCompare(b.name))
})

// Highlighted group
const highlightedId = ref<number | null>(null)

// Edit Dialog
const showEditDialog = ref(false)
const editingGroupId = ref<number | null>(null)

function openCreateDialog() {
  editingGroupId.value = null
  showEditDialog.value = true
}

function editGroup(group: EntityGroup) {
  editingGroupId.value = group.id
  showEditDialog.value = true
}

// View Dialog
const showViewDialog = ref(false)
const viewingGroup = ref<EntityGroup | null>(null)
const viewDialogRef = ref<{ refresh: () => Promise<void> } | null>(null)

function viewGroup(group: EntityGroup) {
  viewingGroup.value = group
  showViewDialog.value = true
}

function handleViewEdit(group: EntityGroup) {
  showViewDialog.value = false
  editGroup(group)
}

// Add Entities Dialog
const showEntitySelectDialog = ref(false)
const entitySelectGroupId = ref<number | null>(null)
const entitySelectExistingMembers = ref<GroupMember[]>([])
const defaultEntityType = ref('NPC')

async function handleAddEntities(group: EntityGroup) {
  entitySelectGroupId.value = group.id
  defaultEntityType.value = 'NPC'
  // Load existing members to show which entities are already in group
  const members = await $fetch<GroupMember[]>(`/api/groups/${group.id}/members`)
  entitySelectExistingMembers.value = members
  showEntitySelectDialog.value = true
}

// Context menu handler for adding members
async function handleContextMenuAddMember(group: EntityGroup, entityType: string) {
  entitySelectGroupId.value = group.id
  defaultEntityType.value = entityType
  // Load existing members to show which entities are already in group
  const members = await $fetch<GroupMember[]>(`/api/groups/${group.id}/members`)
  entitySelectExistingMembers.value = members
  showEntitySelectDialog.value = true
}

async function handleEntitiesAdded(count: number) {
  snackbarStore.success(t('groups.entitiesAdded', { count }))
  // Reload counts for the group
  if (entitySelectGroupId.value) {
    await loadBatchCounts([entitySelectGroupId.value])
  }
  // Refresh the view dialog if open
  await viewDialogRef.value?.refresh()
}

async function handleMemberRemoved(groupId: number) {
  await loadBatchCounts([groupId])
}

function handleMemberClick(entityId: number, entityType: string) {
  const routeMap: Record<string, string> = {
    NPC: '/npcs',
    Location: '/locations',
    Item: '/items',
    Faction: '/factions',
    Lore: '/lore',
    Player: '/players',
  }
  const route = routeMap[entityType]
  if (route) {
    showViewDialog.value = false
    router.push(`${route}?highlight=${entityId}`)
  }
}

function handleDialogClose(open: boolean) {
  showEditDialog.value = open
  if (!open) {
    editingGroupId.value = null
  }
}

async function handleGroupSaved(group: EntityGroup) {
  // Update in local list
  const index = groups.value.findIndex((g) => g.id === group.id)
  if (index !== -1) {
    groups.value[index] = group
  }

  // Reload counts
  await loadBatchCounts([group.id])

  // Re-execute search if active
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }
}

async function handleGroupCreated(group: EntityGroup) {
  groups.value.push(group)

  // Reload counts
  await loadBatchCounts([group.id])

  // Re-execute search if active
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }

  // Highlight and scroll to new group
  highlightedId.value = group.id
  await nextTick()
  setTimeout(() => {
    const element = document.getElementById(`group-${group.id}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setTimeout(() => {
      highlightedId.value = null
    }, 3000)
  }, 100)
}

// Delete Dialog
const showDeleteDialog = ref(false)
const deletingGroup = ref<EntityGroup | null>(null)
const deleting = ref(false)

function deleteGroup(group: EntityGroup) {
  deletingGroup.value = group
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingGroup.value) return

  deleting.value = true

  await $fetch(`/api/groups/${deletingGroup.value.id}`, { method: 'DELETE' })

  // Remove from local list
  groups.value = groups.value.filter((g) => g.id !== deletingGroup.value!.id)
  snackbarStore.success(t('groups.deleted'))

  showDeleteDialog.value = false
  deletingGroup.value = null
  deleting.value = false
}

// Delete All Dialog (group + all entities)
const showDeleteAllDialog = ref(false)
const deleteAllGroup = ref<EntityGroup | null>(null)
const deletingAll = ref(false)
const deleteAllGroupCount = computed(() => {
  if (!deleteAllGroup.value) return 0
  return groupCounts.value[deleteAllGroup.value.id]?.total || 0
})

function handleDeleteAll(group: EntityGroup) {
  deleteAllGroup.value = group
  showDeleteAllDialog.value = true
}

async function confirmDeleteAll() {
  if (!deleteAllGroup.value) return

  deletingAll.value = true

  await $fetch(`/api/groups/${deleteAllGroup.value.id}/delete-all`, {
    method: 'POST',
    body: { confirmed: true },
  })

  // Remove from local list
  groups.value = groups.value.filter((g) => g.id !== deleteAllGroup.value!.id)
  snackbarStore.success(t('groups.deletedAll'))

  showDeleteAllDialog.value = false
  showViewDialog.value = false
  deleteAllGroup.value = null
  deletingAll.value = false
}

// Initialize
onMounted(() => {
  loadGroups()
})
</script>

<style scoped>
.fab-create {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}
</style>
