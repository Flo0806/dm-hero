<template>
  <div>
    <div class="text-body-medium text-medium-emphasis mb-4">
      {{ $t('story.sessionScenes.hint') }}
    </div>

    <v-autocomplete
      :model-value="linked.map(n => n.id)"
      :items="options"
      item-title="name"
      item-value="id"
      :label="$t('story.sessionScenes.label')"
      :loading="loading"
      prepend-inner-icon="mdi-script-text-outline"
      variant="outlined"
      multiple
      chips
      closable-chips
      @update:model-value="save"
    >
      <template #item="{ props: itemProps, item }">
        <v-list-item v-bind="itemProps" :subtitle="item.path" :prepend-icon="STORY_NODE_KIND_ICONS[item.kind]" />
      </template>
    </v-autocomplete>

    <v-list v-if="linked.length" density="compact">
      <v-list-item
        v-for="n in linked"
        :key="n.id"
        :prepend-icon="STORY_NODE_KIND_ICONS[n.kind]"
        :title="n.name"
        :to="{ path: '/story', query: { node: n.id } }"
        rounded
      >
        <template #append>
          <v-chip :color="STORY_NODE_STATUS_COLORS[n.status]" size="x-small" variant="tonal">
            {{ $t(`story.statuses.${n.status}`) }}
          </v-chip>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import { defineEmits, defineProps } from 'vue'
import { STORY_NODE_KIND_ICONS, STORY_NODE_STATUS_COLORS, type StoryNodeListItem } from '~~/types/story'

// The session side of "played in": which prepared scenes happened in this session
const props = defineProps<{ sessionId: number, campaignId: number }>()
const emit = defineEmits<{ updated: [count: number] }>()

const { t } = useI18n()
const snackbarStore = useSnackbarStore()

const all = ref<StoryNodeListItem[]>([])
const linked = ref<StoryNodeListItem[]>([])
const loading = ref(false)

// Tree order with the parent path as subtitle
const options = computed(() => {
  const byId = new Map(all.value.map(n => [n.id, n]))
  /** Names of the node's ancestors, "Arc › Chapter" (stops on a parent cycle). */
  const path = (n: StoryNodeListItem) => {
    const names: string[] = []
    const seen = new Set<number>([n.id])
    let p = n.parent_id ? byId.get(n.parent_id) : undefined
    while (p && !seen.has(p.id)) {
      seen.add(p.id)
      names.unshift(p.name)
      p = p.parent_id ? byId.get(p.parent_id) : undefined
    }
    return names.join(' › ')
  }
  const ordered: Array<StoryNodeListItem & { path: string }> = []
  /** Append the children of parentId in tree order, depth first. */
  const walk = (parentId: number | null) => {
    for (const n of all.value.filter(x => x.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)) {
      ordered.push({ ...n, path: path(n) })
      walk(n.id)
    }
  }
  walk(null)
  return ordered
})

/** Load the campaign's story nodes and the ones played in this session. */
async function load() {
  const { sessionId, campaignId } = props
  loading.value = true
  try {
    const [nodes, played] = await Promise.all([
      $fetch<StoryNodeListItem[]>('/api/story', { query: { campaignId } }),
      $fetch<StoryNodeListItem[]>(`/api/story/by-session/${sessionId}`),
    ])
    if (sessionId !== props.sessionId || campaignId !== props.campaignId) return
    all.value = nodes
    linked.value = played
  }
  catch (error) {
    console.error('Failed to load story nodes:', error)
  }
  finally {
    if (sessionId === props.sessionId && campaignId === props.campaignId) loading.value = false
  }
}

// Each save replaces the whole list - run them one after another, so an older
// request can't finish last and overwrite a newer selection
let saveQueue: Promise<void> = Promise.resolve()
/** Queue a replacement of the session's played scenes; resolves when this save is done. */
function save(nodeIds: number[]) {
  const sessionId = props.sessionId
  saveQueue = saveQueue.then(async () => {
    try {
      const result = await $fetch<StoryNodeListItem[]>(`/api/story/by-session/${sessionId}`, {
        method: 'PUT',
        body: { nodeIds },
      })
      if (sessionId !== props.sessionId) return
      linked.value = result
      emit('updated', result.length)
    }
    catch (error) {
      console.error('Failed to save session scenes:', error)
      snackbarStore.error(t('common.error'))
      if (sessionId === props.sessionId) linked.value = [...linked.value]
    }
  })
  return saveQueue
}

watch(() => [props.sessionId, props.campaignId], load, { immediate: true })
</script>
