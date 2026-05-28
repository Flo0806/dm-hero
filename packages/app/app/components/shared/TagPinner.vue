<template>
  <div class="tag-pinner d-inline-flex align-center flex-wrap ga-1">
    <SharedTagChip
      v-for="tag in tags"
      :key="tag.id"
      :tag="tag"
      :size="size"
      closable
      @remove="removeTag(tag)"
    />

    <v-btn
      :id="activatorId"
      icon
      variant="text"
      size="x-small"
      class="tag-pinner__add"
      :title="$t('tags.pinner.addTag')"
      :loading="busy"
    >
      <v-icon size="small">mdi-tag-plus</v-icon>
    </v-btn>

    <v-menu
      :activator="`#${activatorId}`"
      :close-on-content-click="false"
      location="bottom start"
      @update:model-value="onMenuToggle"
    >
      <v-card min-width="260" max-width="320">
        <v-text-field
          v-model="search"
          :placeholder="$t('tags.pinner.addTag')"
          density="compact"
          variant="plain"
          hide-details
          autofocus
          prefix="#"
          class="px-3 pt-2"
          @input="onSearchInput"
          @keydown.enter.prevent="onEnter"
        />
        <v-divider />
        <v-list density="compact" max-height="280" class="overflow-y-auto">
          <v-list-item
            v-for="t in filteredCandidates"
            :key="t.id"
            @click="addExisting(t)"
          >
            <template #prepend>
              <span class="tag-pinner__swatch" :style="{ background: t.color || '#999' }" />
            </template>
            <v-list-item-title>#{{ t.name }}</v-list-item-title>
            <template #append>
              <span class="text-body-small text-medium-emphasis">{{ t.usage_count }}</span>
            </template>
          </v-list-item>

          <v-list-item
            v-if="canCreate"
            class="text-primary"
            @click="createAndAdd"
          >
            <template #prepend>
              <v-icon size="small">mdi-plus-circle-outline</v-icon>
            </template>
            <v-list-item-title>{{ $t('tags.pinner.createNew', { name: normalisedSearch }) }}</v-list-item-title>
          </v-list-item>

          <v-list-item v-if="filteredCandidates.length === 0 && !canCreate" disabled>
            <v-list-item-title class="text-medium-emphasis">
              {{ $t('tags.pinner.noMatches') }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import {
  isValidTagName,
  normaliseTagName,
  DEFAULT_TAG_COLOR,
  type Tag,
} from '~~/types/tag'
import { useTagsStore } from '~/stores/tags'

const props = withDefaults(defineProps<{
  entityId: number
  size?: 'x-small' | 'small' | 'default'
}>(), {
  size: 'x-small',
})

const tagsStore = useTagsStore()

const search = ref('')
const busy = ref(false)
const activatorId = `tag-pinner-${Math.random().toString(36).slice(2, 10)}`

// Reactive list per entity — store schedules a debounced batch fetch.
const tags = computed<Tag[]>(() => tagsStore.tagsFor(props.entityId))

// Request whenever the bound entityId changes (incl. mount).
watch(
  () => props.entityId,
  (id) => {
    if (Number.isFinite(id)) tagsStore.requestTagsFor(id)
  },
  { immediate: true },
)

const normalisedSearch = computed(() => normaliseTagName(search.value))

const filteredCandidates = computed(() => {
  const term = normalisedSearch.value
  const taken = new Set(tags.value.map(t => t.id))
  return tagsStore.catalogue
    .filter(t => !taken.has(t.id))
    .filter(t => !term || t.name.includes(term))
    .slice(0, 50)
})

const canCreate = computed(() => {
  const term = normalisedSearch.value
  if (!term || !isValidTagName(term)) return false
  if (tags.value.some(t => t.name === term)) return false
  if (tagsStore.catalogue.some(t => t.name === term)) return false
  return true
})

function onMenuToggle(open: boolean) {
  if (open) tagsStore.loadCatalogue()
}

async function addExisting(tag: { id: number }) {
  busy.value = true
  try {
    await tagsStore.attachTag(props.entityId, { tagId: tag.id })
    search.value = ''
  }
  finally {
    busy.value = false
  }
}

async function createAndAdd() {
  const name = normalisedSearch.value
  if (!isValidTagName(name)) return
  busy.value = true
  try {
    await tagsStore.attachTag(props.entityId, { name, color: DEFAULT_TAG_COLOR })
    await tagsStore.loadCatalogue(true)
    search.value = ''
  }
  finally {
    busy.value = false
  }
}

async function removeTag(tag: Tag) {
  busy.value = true
  try {
    await tagsStore.detachTag(props.entityId, tag.id)
  }
  finally {
    busy.value = false
  }
}

function onSearchInput() {
  search.value = normaliseTagName(search.value)
}

function onEnter() {
  if (canCreate.value) {
    createAndAdd()
    return
  }
  const first = filteredCandidates.value[0]
  if (first) addExisting(first)
}
</script>

<script lang="ts">
export default { name: 'TagPinner' }
</script>

<style scoped>
.tag-pinner__add {
  opacity: 0.6;
  transition: opacity 0.15s;
}
.tag-pinner:hover .tag-pinner__add,
.tag-pinner__add:focus-visible {
  opacity: 1;
}
.tag-pinner__swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin-right: 4px;
}
</style>
