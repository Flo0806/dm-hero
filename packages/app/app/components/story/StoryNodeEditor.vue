<template>
  <Transition name="story-page" mode="out-in">
    <div v-if="loading && !node" key="loading" class="text-center py-12">
      <v-progress-circular indeterminate />
    </div>

    <div v-else-if="node" :key="node.id" class="story-page pa-4 pa-md-6">
      <!-- Breadcrumb + previous / next -->
      <div class="d-flex align-center text-caption text-medium-emphasis mb-1">
        <div class="text-truncate flex-grow-1">
          <template v-for="(a, i) in ancestors" :key="a.id">
            <a class="story-crumb" @click="emit('navigate', a.id)">{{ a.name }}</a>
            <span v-if="i < ancestors.length - 1" class="mx-1">›</span>
          </template>
        </div>
        <v-btn
          icon="mdi-chevron-left"
          variant="tonal"
          size="small"
          density="comfortable"
          class="ml-1"
          :disabled="!previous"
          :title="previous ? `${$t('story.previous')}: ${previous.name}` : $t('story.previous')"
          @click="previous && emit('navigate', previous.id)"
        />
        <v-btn
          icon="mdi-chevron-right"
          variant="tonal"
          size="small"
          density="comfortable"
          class="ml-1"
          :disabled="!next"
          :title="next ? `${$t('story.next')}: ${next.name}` : $t('story.next')"
          @click="next && emit('navigate', next.id)"
        />
      </div>

      <!-- Title line: kind icon, title, status, save state -->
      <div class="d-flex align-center ga-1">
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              :icon="STORY_NODE_KIND_ICONS[form.kind]"
              variant="text"
              size="small"
              :title="$t(`story.kinds.${form.kind}`)"
            />
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="k in STORY_NODE_KINDS"
              :key="k"
              :prepend-icon="STORY_NODE_KIND_ICONS[k]"
              :title="$t(`story.kinds.${k}`)"
              :active="form.kind === k"
              @click="form.kind = k"
            />
          </v-list>
        </v-menu>

        <label class="story-title-wrap flex-grow-1 d-flex align-center">
          <input
            v-model="form.name"
            class="story-title flex-grow-1"
            :placeholder="$t('story.name')"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
          <v-icon icon="mdi-pencil" size="16" class="story-title-pencil" />
        </label>

        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-chip
              v-bind="menuProps"
              :color="STORY_NODE_STATUS_COLORS[form.status]"
              size="small"
              variant="tonal"
              append-icon="mdi-menu-down"
            >
              {{ $t(`story.statuses.${form.status}`) }}
            </v-chip>
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="s in STORY_NODE_STATUSES"
              :key="s"
              :title="$t(`story.statuses.${s}`)"
              :active="form.status === s"
              @click="form.status = s"
            >
              <template #prepend>
                <v-icon icon="mdi-circle" size="10" :color="STORY_NODE_STATUS_COLORS[s]" class="mr-3" />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>

        <div class="story-save-state ml-1" :title="saving ? $t('story.saving') : dirty ? $t('story.unsaved') : $t('story.saved')">
          <Transition name="story-pop" mode="out-in">
            <v-progress-circular v-if="saving" key="saving" indeterminate size="12" width="2" />
            <v-icon v-else-if="dirty" key="dirty" icon="mdi-circle-medium" size="small" color="warning" />
            <v-icon v-else key="saved" icon="mdi-check" size="x-small" color="success" />
          </Transition>
        </div>
      </div>

      <!-- Cast: who and what the texts mention -->
      <TransitionGroup v-if="cast.length" name="story-pop" tag="div" class="d-flex flex-wrap ga-1 mt-2">
        <v-chip
          v-for="m in cast"
          :key="m.id"
          :prepend-icon="MENTION_STYLES[m.type]?.icon ?? 'mdi-tag'"
          size="small"
          variant="tonal"
          @click="previewEntity(m.type, m.id)"
        >
          {{ m.name }}
        </v-chip>
      </TransitionGroup>

      <v-divider class="my-4" />

      <!-- Texts: only what's filled (or being edited) -->
      <TransitionGroup name="story-block" tag="div" class="story-blocks">
        <StoryTextBlock
          v-for="block in visibleBlocks"
          :key="block.field"
          v-model="form[block.field]"
          :editing="editing === block.field"
          :label="block.field === 'description' ? '' : $t(`story.fields.${block.field}`)"
          :icon="block.icon"
          :variant="block.variant"
          :placeholder="block.field === 'description' ? $t('story.bodyPlaceholder') : $t(`story.fieldHints.${block.field}`)"
          :height="block.field === 'description' ? '380px' : '220px'"
          :names="names"
          :sessions="sessions"
          @edit="editing = block.field"
          @done="doneEditing"
          @entity="previewEntity"
          @upload-image="handleImageUpload"
        />
      </TransitionGroup>

      <!-- Add an empty prep field -->
      <div v-if="hiddenBlocks.length" class="d-flex flex-wrap align-center ga-2 mb-2">
        <span class="text-caption text-medium-emphasis">{{ $t('story.addField') }}</span>
        <TransitionGroup name="story-pop">
          <v-btn
            v-for="block in hiddenBlocks"
            :key="block.field"
            size="small"
            variant="outlined"
            rounded="pill"
            :color="block.color"
            class="story-add-field"
            @click="editing = block.field"
          >
            <v-icon icon="mdi-plus" size="16" class="story-add-plus" />
            <v-icon :icon="block.icon" size="16" class="mx-1" />
            {{ $t(`story.fields.${block.field}`) }}
          </v-btn>
        </TransitionGroup>
      </div>

      <v-divider class="my-4" />

      <!-- Attachments: encounters, maps, music, images, documents -->
      <div class="d-flex flex-wrap align-center ga-2">
        <TransitionGroup name="story-pop" tag="div" class="story-contents">
          <v-chip
            v-for="e in node.encounters"
            :key="`e${e.id}`"
            prepend-icon="mdi-sword-cross"
            size="small"
            closable
            to="/encounters"
            @click:close="saveLinks({ encounterIds: node.encounters.filter(x => x.id !== e.id).map(x => x.id) })"
          >
            {{ e.name }}
          </v-chip>
          <v-chip
            v-for="m in node.maps"
            :key="`m${m.id}`"
            prepend-icon="mdi-map"
            size="small"
            closable
            to="/maps"
            @click:close="saveLinks({ mapIds: node.maps.filter(x => x.id !== m.id).map(x => x.id) })"
          >
            {{ m.name }}
          </v-chip>
          <v-chip
            v-for="(link, i) in form.musicLinks"
            :key="`u${i}`"
            :prepend-icon="musicLinkIcon(link.url).icon"
            :color="musicLinkIcon(link.url).color"
            :title="link.url"
            size="small"
            closable
            @click="openExternalUrl(link.url)"
            @click:close="form.musicLinks = form.musicLinks.filter((_, j) => j !== i)"
          >
            {{ link.label }}
          </v-chip>
          <v-avatar
            v-for="img in images.slice(0, 6)"
            :key="`i${img.id}`"
            rounded
            size="40"
            class="story-thumb"
            @click="previewImage = `/uploads/${img.image_url}`"
          >
            <v-img :src="`/uploads/${img.image_url}`" cover />
          </v-avatar>
          <v-chip v-if="images.length > 6" size="small" @click="dialog = 'image'">
            +{{ images.length - 6 }}
          </v-chip>
          <v-chip
            v-for="doc in documents"
            :key="`d${doc.id}`"
            prepend-icon="mdi-file-document-outline"
            size="small"
            @click="dialog = 'document'"
          >
            {{ doc.title }}
          </v-chip>

        </TransitionGroup>

        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" size="small" variant="tonal" rounded="pill" prepend-icon="mdi-paperclip" append-icon="mdi-menu-down" class="story-btn">
              {{ $t('story.attach') }}
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item prepend-icon="mdi-sword-cross" :title="$t('story.links.encounters')" @click="dialog = 'encounter'" />
            <v-list-item prepend-icon="mdi-map" :title="$t('story.links.maps')" @click="dialog = 'map'" />
            <v-list-item prepend-icon="mdi-music" :title="$t('story.tabs.music')" @click="dialog = 'music'" />
            <v-list-item prepend-icon="mdi-image-multiple" :title="$t('story.tabs.images')" @click="dialog = 'image'" />
            <v-list-item prepend-icon="mdi-file-document-multiple" :title="$t('story.tabs.documents')" @click="dialog = 'document'" />
          </v-list>
        </v-menu>
      </div>

      <!-- Played in -->
      <TransitionGroup name="story-pop" tag="div" class="d-flex flex-wrap align-center ga-2 mt-3 text-body-small">
        <span key="label" class="text-medium-emphasis">
          <v-icon icon="mdi-calendar-check" size="small" class="mr-1" />{{ $t('story.links.sessions') }}:
        </span>
        <v-chip
          v-for="s in node.sessions"
          :key="s.id"
          size="small"
          closable
          @click:close="saveLinks({ sessionIds: node.sessions.filter(x => x.id !== s.id).map(x => x.id) })"
        >
          {{ sessionLabel(s) }}
        </v-chip>
        <v-btn
          v-if="form.status === 'played' && node.sessions.length === 0 && latestSession"
          key="latest"
          size="small"
          rounded="pill"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-link"
          @click="saveLinks({ sessionIds: [latestSession.id] })"
        >
          {{ sessionLabel(latestSession) }}
        </v-btn>
        <v-btn
          key="link"
          size="small"
          variant="tonal"
          rounded="pill"
          prepend-icon="mdi-plus"
          class="story-btn"
          @click="dialog = 'session'"
        >
          {{ $t('story.linkSession') }}
        </v-btn>
      </TransitionGroup>

      <!-- Pickers for links -->
      <v-dialog :model-value="dialog === 'session' || dialog === 'encounter' || dialog === 'map'" max-width="520" @update:model-value="dialog = null">
        <v-card>
          <v-card-text>
            <v-autocomplete
              v-if="dialog === 'session'"
              :model-value="node.sessions.map(s => s.id)"
              :items="sessions"
              :item-title="sessionLabel"
              item-value="id"
              :label="$t('story.links.sessions')"
              variant="outlined"
              multiple
              chips
              closable-chips
              autofocus
              hide-details
              @update:model-value="ids => saveLinks({ sessionIds: ids })"
            />
            <v-autocomplete
              v-else-if="dialog === 'encounter'"
              :model-value="node.encounters.map(e => e.id)"
              :items="encounters"
              item-title="name"
              item-value="id"
              :label="$t('story.links.encounters')"
              variant="outlined"
              multiple
              chips
              closable-chips
              autofocus
              hide-details
              @update:model-value="ids => saveLinks({ encounterIds: ids })"
            />
            <v-autocomplete
              v-else
              :model-value="node.maps.map(m => m.id)"
              :items="maps"
              item-title="name"
              item-value="id"
              :label="$t('story.links.maps')"
              variant="outlined"
              multiple
              chips
              closable-chips
              autofocus
              hide-details
              @update:model-value="ids => saveLinks({ mapIds: ids })"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="dialog = null">
              {{ $t('story.done') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Music / images / documents reuse their managers -->
      <v-dialog :model-value="dialog === 'music' || dialog === 'image' || dialog === 'document'" max-width="900" scrollable @update:model-value="closeManager">
        <v-card>
          <v-card-text>
            <SessionsSessionMusicLinks v-if="dialog === 'music'" v-model="form.musicLinks" :hint="$t('story.musicHint')" />
            <SharedEntityImageGallery
              v-else-if="dialog === 'image'"
              :entity-id="node.id"
              entity-type="StoryNode"
              :entity-name="node.name"
              :can-generate-image="false"
              @images-updated="loadAttachments"
              @preview-image="(url: string) => previewImage = url"
            />
            <SharedEntityDocuments v-else-if="dialog === 'document'" :entity-id="node.id" @changed="loadAttachments" />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="closeManager">
              {{ $t('story.done') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <SharedImagePreviewDialog
        :model-value="!!previewImage"
        :image-url="previewImage ?? ''"
        :title="node.name"
        @update:model-value="v => { if (!v) previewImage = null }"
      />

      <SharedEntityPreviewDialog
        v-model="showPreview"
        :entity-type="previewType"
        :entity-id="previewId"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { EntityPreviewType } from '~/components/shared/EntityPreviewDialog.vue'
import { musicLinkIcon, type SessionMusicLink } from '~~/types/session-music'
import {
  MENTION_STYLES,
  STORY_NODE_KIND_ICONS,
  STORY_NODE_KINDS,
  STORY_NODE_STATUS_COLORS,
  STORY_NODE_STATUSES,
  STORY_NODE_TEXT_FIELDS,
  type StoryNode,
  type StoryNodeKind,
  type StoryNodeLinks,
  type StoryNodeStatus,
  type StoryNodeTextField,
} from '~~/types/story'

const props = defineProps<{ nodeId: number, campaignId: number }>()
const emit = defineEmits<{ navigate: [id: number] }>()

const { t } = useI18n()
const storyStore = useStoryStore()
const snackbarStore = useSnackbarStore()
const { openExternalUrl } = useElectron()

type BlockField = 'description' | StoryNodeTextField

// Reading order of the texts and how each one looks
const BLOCKS: Array<{ field: BlockField, icon: string, variant: 'plain' | 'boxed' | 'secret', color: string }> = [
  { field: 'hook', icon: 'mdi-hook', variant: 'plain', color: 'info' },
  { field: 'readAloud', icon: 'mdi-account-voice', variant: 'boxed', color: 'primary' },
  { field: 'description', icon: '', variant: 'plain', color: 'primary' },
  { field: 'secrets', icon: 'mdi-eye-off', variant: 'secret', color: 'error' },
  { field: 'outcomes', icon: 'mdi-call-split', variant: 'plain', color: 'success' },
]

/** Mention types that have a preview dialog (sessions don't) */
const PREVIEW_TYPES = new Set<string>(['npc', 'location', 'item', 'faction', 'lore', 'player'])

interface SessionOption { id: number, title: string, session_number: number | null, date: string | null }

const node = ref<StoryNode | null>(null)
const loading = ref(false)
const saving = ref(false)
const editing = ref<BlockField | null>(null)
const dialog = ref<'session' | 'encounter' | 'map' | 'music' | 'image' | 'document' | null>(null)
const previewImage = ref<string | null>(null)

type Form = { name: string, description: string, kind: StoryNodeKind, status: StoryNodeStatus, musicLinks: SessionMusicLink[] }
  & Record<StoryNodeTextField, string>

/** A blank editor form (defaults of a new scene). */
const emptyForm = (): Form => ({
  name: '',
  description: '',
  kind: 'scene',
  status: 'idea',
  musicLinks: [],
  hook: '',
  readAloud: '',
  secrets: '',
  outcomes: '',
})
const form = reactive<Form>(emptyForm())
// What the server has - to send only changed fields
const saved = ref<Form>(emptyForm())

const sessions = ref<SessionOption[]>([])
const encounters = ref<Array<{ id: number, name: string }>>([])
const maps = ref<Array<{ id: number, name: string }>>([])
const images = ref<Array<{ id: number, image_url: string }>>([])
const documents = ref<Array<{ id: number, title: string }>>([])

const ancestors = computed(() => storyStore.ancestors(props.nodeId))
const position = computed(() => storyStore.ordered.findIndex(n => n.id === props.nodeId))
const previous = computed(() => (position.value > 0 ? storyStore.ordered[position.value - 1] : undefined))
const next = computed(() => (position.value >= 0 ? storyStore.ordered[position.value + 1] : undefined))
const latestSession = computed(() => sessions.value[0] ?? null)

const cast = computed(() => (node.value?.mentions ?? []).filter(m => PREVIEW_TYPES.has(m.type)))

// Badge names: mentioned entities + sessions
const names = computed(() => {
  const map: Record<string, string> = {}
  for (const m of node.value?.mentions ?? []) map[`${m.type}:${m.id}`] = m.name
  for (const s of sessions.value) map[`session:${s.id}`] = sessionLabel(s)
  return map
})

const visibleBlocks = computed(() => BLOCKS.filter(b => b.field === 'description' || form[b.field].trim() || editing.value === b.field))
const hiddenBlocks = computed(() => BLOCKS.filter(b => !visibleBlocks.value.includes(b)))

/** Editor form values from a loaded node, with defaults for missing metadata. */
function toForm(n: StoryNode): Form {
  return {
    name: n.name,
    description: n.description ?? '',
    kind: n.metadata.kind ?? 'scene',
    status: n.metadata.status ?? 'idea',
    musicLinks: [...(n.metadata.musicLinks ?? [])],
    hook: n.metadata.hook ?? '',
    readAloud: n.metadata.readAloud ?? '',
    secrets: n.metadata.secrets ?? '',
    outcomes: n.metadata.outcomes ?? '',
  }
}

const changedFields = computed(() => {
  const patch: Partial<Form> = {}
  for (const key of Object.keys(form) as Array<keyof Form>) {
    if (JSON.stringify(form[key]) !== JSON.stringify(saved.value[key])) {
      (patch as Record<string, unknown>)[key] = form[key]
    }
  }
  return patch
})
const dirty = computed(() => Object.keys(changedFields.value).length > 0)

// Each load gets a number; only the latest one may touch the editor state
// (switching A -> B -> A quickly must not let a slow response win)
let loadVersion = 0
/** Load a node into the editor after saving pending changes of the current one; stale responses are ignored. */
async function load(id: number) {
  const version = ++loadVersion
  await flush()
  if (version !== loadVersion) return
  loading.value = true
  editing.value = null
  try {
    const n = await $fetch<StoryNode>(`/api/story/${id}`)
    if (version !== loadVersion) return
    node.value = n
    saved.value = toForm(n)
    Object.assign(form, toForm(n))
    // A fresh, empty entry: start writing right away
    if (!n.description && STORY_NODE_TEXT_FIELDS.every(f => !n.metadata[f])) editing.value = 'description'
    loadAttachments()
  }
  catch (error) {
    if (version !== loadVersion) return
    console.error('Failed to load story node:', error)
    node.value = null
  }
  finally {
    if (version === loadVersion) loading.value = false
  }
}

/** Load the node's images and documents for the attachments row (dropped if the node changed meanwhile). */
async function loadAttachments() {
  if (!node.value) return
  const id = node.value.id
  const [imgs, docs] = await Promise.all([
    $fetch<Array<{ id: number, image_url: string }>>(`/api/entities/${id}/images`).catch(() => []),
    $fetch<Array<{ id: number, title: string }>>(`/api/entities/${id}/documents`).catch(() => []),
  ])
  if (node.value?.id !== id) return
  images.value = imgs
  documents.value = docs
}

/** Load the campaign's sessions (newest first), encounters and maps for the link pickers. */
async function loadOptions() {
  const [s, e, m] = await Promise.all([
    $fetch<SessionOption[]>('/api/sessions', { query: { campaignId: props.campaignId } }).catch(() => []),
    $fetch<Array<{ id: number, name: string }>>('/api/encounters', { query: { campaignId: props.campaignId } }).catch(() => []),
    $fetch<Array<{ id: number, name: string }>>('/api/maps', { query: { campaignId: props.campaignId } }).catch(() => []),
  ])
  // Newest session first
  sessions.value = [...s].sort((a, b) => (b.session_number ?? 0) - (a.session_number ?? 0) || (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id)
  encounters.value = e
  maps.value = m
}

/** Display label of a session: "#3 Title", or just the title without a number. */
function sessionLabel(s: { title: string, session_number: number | null }) {
  return s.session_number ? `#${s.session_number} ${s.title}` : s.title
}

/** Leave edit mode of a text block and save right away. */
function doneEditing() {
  editing.value = null
  flush()
}

/** Close the music/image/document dialog and refresh the attachments row. */
function closeManager() {
  dialog.value = null
  loadAttachments()
}

// Debounced autosave
let timer: ReturnType<typeof setTimeout> | null = null
watch(form, () => {
  if (!node.value || !dirty.value) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => save(), 800)
}, { deep: true })

// Saves run one after another, so an older request can never overtake a newer one
let saveChain: Promise<void> = Promise.resolve()

/** Queue a save of the changed fields; resolves when every save queued so far is done. */
function save(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  saveChain = saveChain.then(saveChanges)
  return saveChain
}

/**
 * Send what differs from the last saved state, as it is when this save runs (later edits
 * stay dirty for the next save). Skipped when nothing changed or the name is empty.
 * Request failures show an error and leave edits dirty; they do not reject the save queue.
 */
async function saveChanges() {
  const current = node.value
  if (!current) return
  const patch = { ...changedFields.value }
  if (Object.keys(patch).length === 0 || (patch.name !== undefined && !patch.name.trim())) return
  const version = loadVersion
  const sent = JSON.parse(JSON.stringify(form)) as Form
  saving.value = true
  try {
    const updated = await storyStore.updateNode(current.id, patch)
    // Another node was opened meanwhile: this answer is not about the editor's node any more
    if (version !== loadVersion || node.value?.id !== current.id) return
    saved.value = sent
    node.value = { ...node.value, mentions: updated.mentions, updated_at: updated.updated_at }
  }
  catch (error) {
    console.error('Failed to save story node:', error)
    snackbarStore.error(t('common.error'))
  }
  finally {
    saving.value = false
  }
}

/** Save pending changes right away and wait for every save in progress (switching nodes, leaving the page). */
function flush(): Promise<void> {
  return save()
}

/** Replace the given link lists (sessions / encounters / maps) and show the result. */
async function saveLinks(links: StoryNodeLinks) {
  if (!node.value) return
  try {
    const updated = await storyStore.setLinks(node.value.id, links)
    node.value = { ...node.value, sessions: updated.sessions, encounters: updated.encounters, maps: updated.maps }
  }
  catch (error) {
    console.error('Failed to save links:', error)
    snackbarStore.error(t('common.error'))
  }
}

/**
 * Upload pasted/dropped images and call back with successful URLs in input order.
 * Failed uploads are skipped; the callback still runs, even if no uploads succeeded.
 */
async function handleImageUpload(files: File[], callback: (urls: string[]) => void) {
  const uploaded: string[] = []
  for (const file of files) {
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await $fetch<{ image_url: string }>('/api/documents/upload-image', { method: 'POST', body: formData })
      uploaded.push(res.image_url)
    }
    catch (e) {
      console.error('Failed to upload image:', e)
    }
  }
  callback(uploaded.map(u => (u.startsWith('/pictures/') ? u : `/pictures/${u}`)))
}

// Mentioned entity preview
const showPreview = ref(false)
const previewType = ref<EntityPreviewType>('npc')
const previewId = ref<number | null>(null)
/** Open the preview dialog of a mentioned entity (sessions and unknown types have none). */
function previewEntity(type: string, id: number) {
  if (!PREVIEW_TYPES.has(type)) return
  previewType.value = type as EntityPreviewType
  previewId.value = id
  showPreview.value = true
}

watch(() => props.nodeId, id => load(id), { immediate: true })
watch(() => props.campaignId, loadOptions, { immediate: true })

onBeforeUnmount(() => {
  flush()
})

defineExpose({ flush })
</script>

<style scoped>
.story-page {
  max-width: 920px;
}

.story-title-wrap {
  position: relative;
  min-width: 0;
  cursor: text;
}

.story-title-pencil {
  position: absolute;
  right: 8px;
  opacity: 0;
  color: rgba(var(--v-theme-on-surface), 0.5);
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.story-title-wrap:hover .story-title-pencil {
  opacity: 1;
}

.story-title-wrap:focus-within .story-title-pencil {
  opacity: 0;
}

.story-title {
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.3;
  background: transparent;
  border: none;
  outline: none;
  color: inherit;
  min-width: 0;
  padding: 2px 4px;
  border-radius: 4px;
}

.story-title:hover,
.story-title:focus {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.story-title:focus {
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary));
}

.story-title {
  padding-right: 32px;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

/* Buttons readable as buttons */
.story-contents {
  display: contents;
}

.story-btn,
.story-add-field {
  letter-spacing: normal;
  text-transform: none;
  font-weight: 500;
}

.story-add-field {
  border-style: dashed;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.story-add-field:hover {
  transform: translateY(-1px);
  border-style: solid;
}

.story-add-plus {
  transition: transform 0.2s ease;
}

.story-add-field:hover .story-add-plus {
  transform: rotate(90deg);
}

/* --- Animations --- */
.story-page-enter-active,
.story-page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.story-page-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.story-page-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.story-block-enter-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.story-block-leave-active {
  transition: opacity 0.12s ease;
}

.story-block-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.story-block-leave-to {
  opacity: 0;
}

.story-block-move {
  transition: transform 0.22s ease;
}

.story-pop-enter-active,
.story-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.story-pop-enter-from,
.story-pop-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

@media (prefers-reduced-motion: reduce) {
  .story-page-enter-active,
  .story-page-leave-active,
  .story-block-enter-active,
  .story-block-leave-active,
  .story-block-move,
  .story-pop-enter-active,
  .story-pop-leave-active,
  .story-add-field,
  .story-add-plus {
    transition: none;
  }
}

.story-crumb {
  cursor: pointer;
}

.story-crumb:hover {
  text-decoration: underline;
}

.story-save-state {
  width: 18px;
  display: flex;
  justify-content: center;
}

.story-thumb {
  cursor: zoom-in;
}
</style>
