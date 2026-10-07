<template>
  <v-container fluid>
    <UiPageHeader :title="$t('story.title')" :subtitle="$t('story.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="startAdd(null)">
          {{ $t('story.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <v-alert v-if="!activeCampaignIdNumber" type="info" variant="tonal">
      {{ $t('story.noCampaign') }}
    </v-alert>

    <v-row v-else>
      <!-- Tree -->
      <v-col cols="12" md="5" lg="4" xl="3">
        <v-card variant="outlined" class="story-tree-card">
          <v-card-text class="pa-2">
            <div class="d-flex align-center ga-1 mb-2">
              <v-text-field
                v-model="search"
                :placeholder="$t('common.search')"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
              />
              <v-menu :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    v-bind="menuProps"
                    icon="mdi-filter-variant"
                    variant="text"
                    :color="statusFilter.length ? 'primary' : undefined"
                  />
                </template>
                <v-list density="compact" :selected="statusFilter" select-strategy="leaf" @update:selected="v => statusFilter = v as StoryNodeStatus[]">
                  <v-list-subheader>{{ $t('story.status') }}</v-list-subheader>
                  <v-list-item v-for="s in STORY_NODE_STATUSES" :key="s" :value="s" :title="$t(`story.statuses.${s}`)">
                    <template #prepend="{ isSelected }">
                      <v-checkbox-btn :model-value="isSelected" density="compact" />
                    </template>
                  </v-list-item>
                </v-list>
              </v-menu>
              <v-btn
                :icon="allExpanded ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'"
                variant="text"
                :title="allExpanded ? $t('story.collapseAll') : $t('story.expandAll')"
                @click="toggleAll"
              />
            </div>

            <div v-if="storyStore.loading && storyStore.nodes.length === 0" class="text-center py-6">
              <v-progress-circular indeterminate size="24" />
            </div>

            <!-- Filtered: flat result list (drag & drop only in the full tree) -->
            <v-list v-else-if="isFiltering" density="compact" class="pa-0">
              <v-list-item
                v-for="n in filteredNodes"
                :key="n.id"
                :active="selectedId === n.id"
                :prepend-icon="STORY_NODE_KIND_ICONS[n.kind]"
                :title="n.name"
                :subtitle="breadcrumb(n.id)"
                rounded
                @click="select(n.id)"
              >
                <template #append>
                  <v-icon icon="mdi-circle" size="8" :color="STORY_NODE_STATUS_COLORS[n.status]" :title="$t(`story.statuses.${n.status}`)" />
                </template>
              </v-list-item>
              <div v-if="filteredNodes.length === 0" class="text-body-medium text-disabled pa-3">
                {{ $t('common.noResults') }}
              </div>
            </v-list>

            <template v-else>
              <StoryTreeBranch :nodes="storyStore.tree" />
              <div v-if="storyStore.nodes.length === 0 && adding === undefined" class="text-center pa-6">
                <v-icon icon="mdi-script-text-outline" size="48" class="text-disabled mb-2" />
                <div class="text-body-medium text-medium-emphasis mb-3">
                  {{ $t('story.empty') }}
                </div>
                <v-btn variant="tonal" prepend-icon="mdi-plus" @click="startAdd(null)">
                  {{ $t('story.create') }}
                </v-btn>
              </div>
              <div v-else-if="adding !== undefined" class="text-caption text-disabled px-2 pt-2">
                {{ $t('story.addKeys') }}
              </div>
              <v-btn
                v-else
                variant="outlined"
                size="small"
                block
                prepend-icon="mdi-plus"
                class="story-new-entry mt-2"
                @click="startAdd(null)"
              >
                {{ $t('story.create') }}
              </v-btn>
            </template>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Editor -->
      <v-col cols="12" md="7" lg="8" xl="9">
        <!-- Client only: the tree loads in the browser, server and client would disagree -->
        <ClientOnly>
          <v-card v-if="selectedId && storyStore.byId(selectedId)" variant="outlined">
            <StoryNodeEditor ref="editorRef" :node-id="selectedId" :campaign-id="activeCampaignIdNumber" @navigate="select" />
          </v-card>
          <v-card v-else variant="outlined" class="d-flex align-center justify-center text-center pa-12 text-medium-emphasis">
            <div>
              <v-icon icon="mdi-cursor-default-click-outline" size="40" class="mb-2" />
              <div>{{ $t('story.selectNode') }}</div>
            </div>
          </v-card>
        </ClientOnly>
      </v-col>
    </v-row>

    <!-- Delete -->
    <UiDeleteConfirmDialog
      v-model="deleteDialog"
      :title="$t('story.deleteTitle')"
      :message="deleteMessage"
      :loading="deleting"
      @confirm="doDelete"
      @cancel="deleteDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { StoryTreeContext } from '~/components/story/StoryTreeBranch.vue'
import {
  defaultKindForDepth,
  STORY_NODE_KIND_ICONS,
  STORY_NODE_STATUS_COLORS,
  STORY_NODE_STATUSES,
  type StoryNodeStatus,
} from '~~/types/story'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const campaignStore = useCampaignStore()
const storyStore = useStoryStore()
const snackbarStore = useSnackbarStore()

const activeCampaignIdNumber = computed(() => campaignStore.activeCampaignIdNumber)
const editorRef = ref<{ flush: () => Promise<void> } | null>(null)

// Selection lives in the URL (?node=id) so search results and links can open a node
const selectedId = computed(() => {
  const id = Number(route.query.node)
  return Number.isInteger(id) && id > 0 ? id : null
})

/** Select a node (saves the open one first); the selection lives in the URL as ?node=id. */
async function select(id: number) {
  if (id === selectedId.value) return
  await editorRef.value?.flush()
  router.replace({ query: { ...route.query, node: String(id) } })
}

// Expand state (remembered per browser)
const EXPANDED_KEY = 'story-expanded'
const expanded = ref<Set<number>>(new Set())
// After mount: the server can't know it, reading it earlier breaks hydration
onMounted(() => {
  try {
    const saved: number[] = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]')
    saved.forEach(id => expanded.value.add(id))
  }
  catch {
    // ignore unreadable storage
  }
})
watch(expanded, (v) => {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...v]))
  }
  catch {
    // ignore blocked storage
  }
}, { deep: true })

const parentIds = computed(() => storyStore.nodes.filter(n => storyStore.nodes.some(c => c.parent_id === n.id)).map(n => n.id))
const allExpanded = computed(() => parentIds.value.length > 0 && parentIds.value.every(id => expanded.value.has(id)))
/** Expand every entry with children, or collapse all if they already are. */
function toggleAll() {
  expanded.value = allExpanded.value ? new Set() : new Set(parentIds.value)
}

/** Expand the ancestors of a node so it is visible in the tree. */
function expandTo(id: number) {
  for (const a of storyStore.ancestors(id)) expanded.value.add(a.id)
}
watch([selectedId, () => storyStore.nodes.length], ([id]) => {
  if (id) expandTo(id)
}, { immediate: true })

// Search + status filter
const search = ref('')
const statusFilter = ref<StoryNodeStatus[]>([])
const isFiltering = computed(() => !!search.value?.trim() || statusFilter.value.length > 0)
const filteredNodes = computed(() => {
  const q = search.value?.trim().toLowerCase() ?? ''
  return storyStore.nodes.filter(n =>
    (!q || n.name.toLowerCase().includes(q))
    && (statusFilter.value.length === 0 || statusFilter.value.includes(n.status)),
  )
})
/** Ancestor names of a node, "Arc › Chapter", for the filtered result list. */
function breadcrumb(id: number): string {
  return storyStore.ancestors(id).map(a => a.name).join(' › ')
}

// Quick add (outliner): the kind follows the depth, changeable later
const adding = ref<number | null | undefined>(undefined)
const addText = ref('')
let lastCreatedId: number | null = null

/** Open the quick-add row under parentId (null = top level). */
function startAdd(parentId: number | null) {
  if (parentId) expanded.value.add(parentId)
  addText.value = ''
  lastCreatedId = null
  adding.value = parentId
}

/** Close the quick-add row and select the last entry created with it. */
function cancelAdd() {
  adding.value = undefined
  addText.value = ''
  if (lastCreatedId) select(lastCreatedId)
  lastCreatedId = null
}

/** Create an entry under the quick-add parent; reports and rethrows a failure. */
async function submitAdd(name: string) {
  const campaignId = activeCampaignIdNumber.value
  if (!campaignId || adding.value === undefined) return
  const parentId = adding.value
  const depth = parentId ? storyStore.ancestors(parentId).length + 1 : 0
  try {
    const node = await storyStore.createNode(campaignId, name, defaultKindForDepth(depth), parentId, () => activeCampaignIdNumber.value === campaignId)
    lastCreatedId = node.id
  }
  catch (error) {
    console.error('Failed to create story node:', error)
    snackbarStore.error(t('common.error'))
    // Let the quick-add row know, so it keeps the typed name
    throw error
  }
}

/** Tab: nest the quick-add row under the entry above it (the last sibling). */
function indent() {
  if (adding.value === undefined) return
  const siblings = storyStore.nodes
    .filter(n => n.parent_id === adding.value)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const target = siblings[siblings.length - 1]
  if (!target) return
  expanded.value.add(target.id)
  adding.value = target.id
}

/** Shift+Tab: move the quick-add row one level up. */
function outdent() {
  if (adding.value === undefined || adding.value === null) return
  adding.value = storyStore.byId(adding.value)?.parent_id ?? null
}

// Delete (with everything below)
const deleteDialog = ref(false)
const deleteId = ref<number | null>(null)
const deleting = ref(false)
const deleteMessage = computed(() => {
  const node = deleteId.value ? storyStore.byId(deleteId.value) : null
  if (!node) return ''
  const hasChildren = storyStore.nodes.some(n => n.parent_id === node.id)
  return hasChildren ? t('story.deleteWithChildren', { name: node.name }) : t('story.deleteConfirm', { name: node.name })
})

/** Ask before deleting a node (and everything below it). */
function askDelete(id: number) {
  deleteId.value = id
  deleteDialog.value = true
}

/** Delete the confirmed node; clears the selection if it was deleted too. */
async function doDelete() {
  if (!deleteId.value) return
  deleting.value = true
  try {
    const deleted = await storyStore.deleteNode(deleteId.value)
    if (selectedId.value && deleted.includes(selectedId.value)) {
      const { node: _node, ...rest } = route.query
      router.replace({ query: rest })
    }
    deleteDialog.value = false
  }
  catch (error) {
    console.error('Failed to delete story node:', error)
    snackbarStore.error(t('common.error'))
  }
  finally {
    deleting.value = false
  }
}

/** Persist a drag & drop move; on failure the store attempts a reload and an error is shown. */
async function move(id: number, parentId: number | null, index: number) {
  const campaignId = activeCampaignIdNumber.value
  if (!campaignId) return
  try {
    await storyStore.moveNode(campaignId, id, parentId, index, () => activeCampaignIdNumber.value === campaignId)
    if (parentId) expanded.value.add(parentId)
  }
  catch (error) {
    console.error('Failed to move story node:', error)
    snackbarStore.error(t('story.moveFailed'))
  }
}

provide<StoryTreeContext>('storyTree', {
  selectedId,
  select,
  /** Whether a node's children are shown. */
  isExpanded: id => expanded.value.has(id),
  /** Show or hide a node's children. */
  toggle: (id) => {
    if (expanded.value.has(id)) expanded.value.delete(id)
    else expanded.value.add(id)
  },
  remove: askDelete,
  move,
  /** Played/skipped scenes below a node, if it has any. */
  progress: id => storyStore.progress.get(id),
  adding,
  addText,
  startAdd,
  cancelAdd,
  submitAdd,
  indent,
  outdent,
  kindForDepth: defaultKindForDepth,
})

watch(activeCampaignIdNumber, (id, previousId) => {
  if (previousId !== undefined) {
    const { node: _node, ...rest } = route.query
    router.replace({ query: rest })
  }
  storyStore.nodes = []
  if (id) storyStore.fetchNodes(id)
  else {
    storyStore.treeRequest++
    storyStore.loading = false
  }
}, { immediate: true })
</script>

<style scoped>
.story-tree-card {
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.story-new-entry {
  border-style: dashed;
  letter-spacing: normal;
  text-transform: none;
  color: rgba(var(--v-theme-on-surface), 0.7);
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.story-new-entry:hover {
  color: rgb(var(--v-theme-primary));
  border-style: solid;
}
</style>
