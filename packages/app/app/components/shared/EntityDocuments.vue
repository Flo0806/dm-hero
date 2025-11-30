<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="entity-documents">
    <!-- LIST -->
    <div v-if="!isEditing">
      <div class="d-flex justify-space-between align-center mb-4">
        <v-text-field
          v-model="searchQuery"
          :placeholder="$t('documents.searchPlaceholder')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="flex-grow-1 mr-2"
        />
        <div class="d-flex" style="gap: 8px">
          <v-btn color="primary" prepend-icon="mdi-plus" @click="startCreating">
            {{ $t('documents.create') }}
          </v-btn>
          <v-btn
            color="secondary"
            prepend-icon="mdi-file-pdf-box"
            :loading="uploadingPdf"
            @click="triggerPdfUpload"
          >
            {{ $t('documents.uploadPdf') }}
          </v-btn>
          <input
            ref="pdfFileInput"
            type="file"
            accept="application/pdf"
            style="display: none"
            @change="handlePdfUpload"
          />
        </div>
      </div>

      <v-list v-if="filteredDocuments.length > 0">
        <v-list-item v-for="doc in filteredDocuments" :key="doc.id" @click="openDocument(doc)">
          <template #prepend>
            <v-icon :icon="doc.file_type === 'pdf' ? 'mdi-file-pdf-box' : 'mdi-file-document'" class="mr-2" />
          </template>

          <v-list-item-title>{{ doc.title }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ formatDate(doc.date) }} • {{ $t('documents.lastUpdated') }}:
            {{ formatDate(doc.updated_at) }}
            <v-chip v-if="doc.file_type === 'pdf'" size="x-small" color="error" class="ml-2">PDF</v-chip>
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex gap-1">
              <!-- PDF Actions: Preview + Download -->
              <template v-if="doc.file_type === 'pdf'">
                <v-btn
                  icon="mdi-eye"
                  variant="text"
                  size="small"
                  @click.stop="previewPdf(doc)"
                >
                  <v-icon>mdi-eye</v-icon>
                  <v-tooltip activator="parent" location="bottom">
                    {{ $t('documents.previewPdf') }}
                  </v-tooltip>
                </v-btn>
                <v-btn
                  icon="mdi-download"
                  variant="text"
                  size="small"
                  @click.stop="downloadPdf(doc)"
                >
                  <v-icon>mdi-download</v-icon>
                  <v-tooltip activator="parent" location="bottom">
                    {{ $t('common.download') }}
                  </v-tooltip>
                </v-btn>
              </template>
              <!-- Markdown Actions: Edit -->
              <v-btn
                v-else
                icon="mdi-pencil"
                variant="text"
                size="small"
                @click.stop="editDocument(doc)"
              >
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ $t('common.edit') }}
                </v-tooltip>
              </v-btn>
              <!-- Delete (both types) -->
              <v-btn
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                @click.stop="confirmDeleteDocument(doc)"
              >
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ $t('common.delete') }}
                </v-tooltip>
              </v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>

      <v-empty-state
        v-else
        icon="mdi-file-document"
        :title="$t('documents.empty')"
        :text="$t('documents.emptyText')"
      >
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="startCreating">
            {{ $t('documents.create') }}
          </v-btn>
        </template>
      </v-empty-state>
    </div>

    <!-- EDITOR -->
    <div v-else>
      <div class="d-flex justify-space-between align-center mb-4">
        <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="cancelEditing">
          {{ $t('common.back') }}
        </v-btn>
      </div>

      <v-text-field
        v-model.trim="documentForm.title"
        :label="$t('documents.titleField')"
        :placeholder="$t('documents.titlePlaceholder')"
        :rules="[(v) => !!v || $t('documents.titleRequired')]"
        variant="outlined"
        class="mb-4"
      />

      <v-text-field
        v-model="documentForm.date"
        :label="$t('documents.dateField')"
        :rules="[(v) => !!v || $t('documents.dateRequired')]"
        type="date"
        variant="outlined"
        class="mb-4"
      />

      <div class="position-relative">
        <v-overlay
          :model-value="uploadingImage"
          contained
          persistent
          class="align-center justify-center"
          scrim="surface"
          opacity="0.9"
        >
          <div class="text-center">
            <v-progress-circular indeterminate size="64" color="primary" />
            <div class="text-h6 mt-4">{{ $t('common.uploading') }}</div>
          </div>
        </v-overlay>

        <ClientOnly>
          <MdEditor
            ref="editorRef"
            v-model="documentForm.content"
            :language="currentLocale"
            :theme="editorTheme"
            :placeholder="$t('documents.contentPlaceholder')"
            :on-upload-img="handleImageUpload"
            :toolbars="toolbars"
            :sanitize="sanitizeHtml"
            style="height: 420px"
            @click="handleEditorClick"
            @cancel.stop.prevent
          >
            <!-- Custom Entity Link Buttons -->
            <template #defToolbars>
              <NormalToolbar
                :title="$t('sessions.linkNpc')"
                @on-click="showLinkEntityDialog('npc')"
              >
                <template #trigger>
                  <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"
                    />
                  </svg>
                </template>
              </NormalToolbar>
              <NormalToolbar
                :title="$t('sessions.linkLocation')"
                @on-click="showLinkEntityDialog('location')"
              >
                <template #trigger>
                  <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z"
                    />
                  </svg>
                </template>
              </NormalToolbar>
              <NormalToolbar
                :title="$t('sessions.linkItem')"
                @on-click="showLinkEntityDialog('item')"
              >
                <template #trigger>
                  <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M6.92,5H5L14,14L15,13.06M19.96,19.12L19.12,19.96C18.73,20.35 18.1,20.35 17.71,19.96L14.59,16.84L11.91,19.5L10.5,18.09L13.16,15.43L11.06,13.33L8.85,15.54L7.44,14.13L9.65,11.92L6.5,8.77L7.91,7.36L11.06,10.5L13.27,8.29L9.12,4.12C8.73,3.73 8.73,3.1 9.12,2.71L9.96,1.87C10.35,1.5 10.98,1.5 11.37,1.87L19.96,10.46C20.35,10.85 20.35,11.5 19.96,11.87L19.12,12.71C18.73,13.1 18.1,13.1 17.71,12.71L15.92,10.92L13.71,13.13L15.81,15.23L18.5,12.54L19.91,13.95L17.22,16.64L19.96,19.38C20.35,19.77 20.35,20.4 19.96,20.79Z"
                    />
                  </svg>
                </template>
              </NormalToolbar>
              <NormalToolbar
                :title="$t('sessions.linkFaction')"
                @on-click="showLinkEntityDialog('faction')"
              >
                <template #trigger>
                  <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z"
                    />
                  </svg>
                </template>
              </NormalToolbar>
              <NormalToolbar
                :title="$t('sessions.linkLore')"
                @on-click="showLinkEntityDialog('lore')"
              >
                <template #trigger>
                  <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M21,4H7A2,2 0 0,0 5,6V17H21V16L23,14V6C23,4.89 22.1,4 21,4M21,14H7V6H21M3,19V8H1V19A2,2 0 0,0 3,21H19V19"
                    />
                  </svg>
                </template>
              </NormalToolbar>
              <NormalToolbar
                :title="$t('sessions.linkPlayer')"
                @on-click="showLinkEntityDialog('player')"
              >
                <template #trigger>
                  <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17V18.1H18.1V17C18.1,16.36 14.97,14.9 12,14.9M18,9V12H15V13H18V16H19V13H22V12H19V9H18Z"
                    />
                  </svg>
                </template>
              </NormalToolbar>
              <NormalToolbar :title="$t('documents.imageGallery')" @on-click="openImageGallery">
                <template #trigger>
                  <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22,16V4A2,2 0 0,0 20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16M11,12L13.03,14.71L16,11L20,16H8M2,6V20A2,2 0 0,0 4,22H18V20H4V6"
                    />
                  </svg>
                </template>
              </NormalToolbar>
            </template>
          </MdEditor>
        </ClientOnly>
      </div>

      <div class="d-flex justify-end gap-2 mt-4">
        <v-btn variant="text" @click="cancelEditing">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!canSave" @click="saveDocument">
          {{ $t('common.save') }}
        </v-btn>
      </div>
    </div>

    <!-- IMAGE GALLERY -->
    <v-dialog v-model="showImageGallery" max-width="1200" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-image-multiple" class="mr-2" />
          Bild-Galerie
        </v-card-title>
        <v-card-text style="max-height: 600px">
          <v-row v-if="galleryImages.length > 0">
            <v-col v-for="image in galleryImages" :key="image" cols="6" sm="4" md="3">
              <v-card hover class="image-card" @click="insertImageFromGallery(image)">
                <v-img :src="`/pictures/${image}`" aspect-ratio="1" cover class="cursor-pointer" />
              </v-card>
            </v-col>
          </v-row>
          <v-empty-state
            v-else
            icon="mdi-image-off"
            title="Keine Bilder"
            text="Es wurden noch keine Bilder hochgeladen"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showImageGallery = false">Schließen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- PDF PREVIEW DIALOG -->
    <v-dialog v-model="showPdfPreview" max-width="1200" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-file-pdf-box" class="mr-2" />
          {{ viewingPdf?.title }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="showPdfPreview = false" />
        </v-card-title>
        <v-divider />
        <v-card-text style="height: 80vh; overflow-y: auto">
          <ClientOnly>
            <VuePdfEmbed
              v-if="viewingPdf?.file_path"
              :source="`/documents/${viewingPdf.file_path}`"
              class="pdf-viewer"
            />
          </ClientOnly>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            prepend-icon="mdi-download"
            color="primary"
            variant="text"
            @click="downloadPdf(viewingPdf!)"
          >
            {{ $t('common.download') }}
          </v-btn>
          <v-btn variant="text" @click="showPdfPreview = false">
            {{ $t('common.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRM -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('documents.deleteTitle')"
      :message="$t('documents.deleteConfirm')"
      :loading="deleting"
      @confirm="deleteDocument"
      @cancel="showDeleteDialog = false"
    />

    <!-- Entity Link Dialog -->
    <v-dialog v-model="showEntityLinkDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{
            $t(`sessions.link${linkEntityType.charAt(0).toUpperCase() + linkEntityType.slice(1)}`)
          }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="entitySearch"
            :label="$t('common.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            autofocus
            clearable
            class="mb-4"
          />

          <v-list>
            <v-list-item
              v-for="entity in filteredEntities"
              :key="entity.id"
              @click="insertEntityLink(entity)"
            >
              <template #prepend>
                <v-icon :icon="getEntityIcon(linkEntityType)" color="primary" />
              </template>
              <v-list-item-title>
                {{ entity.displayName || entity.name }}
                <span v-if="entity.subtitle" class="text-caption text-medium-emphasis ml-2">
                  ({{ entity.subtitle }})
                </span>
              </v-list-item-title>
            </v-list-item>
          </v-list>

          <div v-if="filteredEntities.length === 0" class="text-center text-disabled py-4">
            {{ $t('common.noResults') }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEntityLinkDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Entity Preview Dialog -->
    <SharedEntityPreviewDialog
      v-model="showEntityPreviewDialog"
      :entity-type="previewEntityType"
      :entity-id="previewEntityId"
    />
  </div>
</template>

<script setup lang="ts">
import { MdEditor, NormalToolbar } from 'md-editor-v3'
import type { ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTheme } from 'vuetify'
import type { EntityPreviewType } from './EntityPreviewDialog.vue'

// Lazy import VuePdfEmbed to avoid SSR issues
const VuePdfEmbed = defineAsyncComponent(() => import('vue-pdf-embed'))

interface Document {
  id: number
  entity_id: number
  title: string
  content: string
  date: string
  sort_order: number
  created_at: string
  updated_at: string
  file_path?: string
  file_type?: 'markdown' | 'pdf'
}

interface Props {
  entityId: number
}

const props = defineProps<Props>()

// Emit events for parent to react to changes
const emit = defineEmits<{
  changed: []
}>()

const { locale } = useI18n()
const theme = useTheme()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)

/* ---------- State ---------- */
const documents = ref<Document[]>([])
const searchQuery = ref('')
const editingDocument = ref<Document | null>(null)
const creatingDocument = ref(false)
const showDeleteDialog = ref(false)
const deletingDocument = ref<Document | null>(null)
const saving = ref(false)
const deleting = ref(false)
const uploadingImage = ref(false)
const showImageGallery = ref(false)
const galleryImages = ref<string[]>([])
const uploadingPdf = ref(false)
const pdfFileInput = ref<HTMLInputElement | null>(null)
const viewingPdf = ref<Document | null>(null)
const showPdfPreview = ref(false)

// Entity linking state
const showEntityLinkDialog = ref(false)
const showEntityPreviewDialog = ref(false)
const linkEntityType = ref<EntityPreviewType>('npc')
const entitySearch = ref('')
const previewEntityType = ref<EntityPreviewType>('npc')
const previewEntityId = ref<number | null>(null)

type EditorInsertBlock = {
  targetValue: string
  select?: boolean
  deviationStart?: number
  deviationEnd?: number
}
interface MdEditorExpose {
  insert: (gen: () => EditorInsertBlock) => void
}
const editorRef = ref<MdEditorExpose | null>(null)

const documentForm = ref({
  title: '',
  content: '',
  date: new Date().toISOString().split('T')[0],
})

/* ---------- Computed ---------- */
const isEditing = computed(() => !!editingDocument.value || creatingDocument.value)
const currentLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))

// Wichtig: Theme-Sync mit Vuetify (dark/light)
const editorTheme = computed<'light' | 'dark'>(() =>
  theme.global.current.value.dark ? 'dark' : 'light',
)

// md-editor Toolbars: 0-6 = Placeholders for custom buttons via <template #defToolbars>
type ToolbarOrSlot = ToolbarNames | 0 | 1 | 2 | 3 | 4 | 5 | 6
const toolbars: ToolbarOrSlot[] = [
  'bold',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'code',
  'link',
  'image',
  0, // NPC
  1, // Location
  2, // Item
  3, // Faction
  4, // Lore
  5, // Player
  6, // Gallery
  'table',
  '-',
  'revoke',
  'next',
  '=',
  'preview',
]

const filteredDocuments = computed(() => {
  if (!searchQuery.value) return documents.value
  const q = searchQuery.value.toLowerCase()
  return documents.value.filter(
    (doc) => doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q),
  )
})

const canSave = computed(() => !!documentForm.value.title && !!documentForm.value.date)

/* ---------- Methods ---------- */
async function loadDocuments() {
  try {
    const data = await $fetch<Document[]>(`/api/entities/${props.entityId}/documents`)
    documents.value = data
  } catch (e) {
    console.error('Failed to load documents:', e)
    documents.value = []
  }
}

function startCreating() {
  creatingDocument.value = true
  editingDocument.value = null
  documentForm.value = { title: '', content: '', date: new Date().toISOString().split('T')[0] }
}

function editDocument(doc: Document) {
  editingDocument.value = doc
  creatingDocument.value = false
  documentForm.value = {
    title: doc.title,
    content: doc.content ?? '',
    date: (doc.date || '').split('T')[0] || new Date().toISOString().split('T')[0],
  }
}

function cancelEditing() {
  editingDocument.value = null
  creatingDocument.value = false
  documentForm.value = { title: '', content: '', date: new Date().toISOString().split('T')[0] }
}

async function saveDocument() {
  if (!canSave.value) return
  saving.value = true
  try {
    if (editingDocument.value) {
      await $fetch(`/api/entities/${props.entityId}/documents/${editingDocument.value.id}`, {
        method: 'PATCH',
        body: documentForm.value,
      })
    } else {
      await $fetch(`/api/entities/${props.entityId}/documents`, {
        method: 'POST',
        body: documentForm.value,
      })
    }
    await loadDocuments()
    cancelEditing()
    emit('changed') // Notify parent that document count changed
  } catch (e) {
    console.error('Failed to save document:', e)
  } finally {
    saving.value = false
  }
}

function confirmDeleteDocument(doc: Document) {
  deletingDocument.value = doc
  showDeleteDialog.value = true
}

async function deleteDocument() {
  if (!deletingDocument.value) return
  deleting.value = true
  try {
    await $fetch(`/api/entities/${props.entityId}/documents/${deletingDocument.value.id}`, {
      method: 'DELETE',
    })
    await loadDocuments()
    showDeleteDialog.value = false
    deletingDocument.value = null
    emit('changed') // Notify parent that document count changed
  } catch (e) {
    console.error('Failed to delete document:', e)
  } finally {
    deleting.value = false
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString(currentLocale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function handleImageUpload(files: File[], callback: (urls: string[]) => void) {
  uploadingImage.value = true
  const uploaded: string[] = []
  try {
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('image', file)
        const res = await $fetch<{ image_url: string }>('/api/documents/upload-image', {
          method: 'POST',
          body: formData,
        })
        uploaded.push(res.image_url)
      } catch (e) {
        console.error('Failed to upload image:', e)
      }
    }
    // md-editor erwartet endgültige URLs
    callback(uploaded.map((u) => (u.startsWith('/pictures/') ? u : `/pictures/${u}`)))
  } finally {
    uploadingImage.value = false
  }
}

async function openImageGallery() {
  showImageGallery.value = true
  try {
    const images = await $fetch<string[]>('/api/documents/images')
    galleryImages.value = images ?? []
  } catch (e) {
    console.error('Failed to load images:', e)
    galleryImages.value = []
  }
}

function insertImageFromGallery(image: string) {
  const src = image.startsWith('/pictures/') ? image : `/pictures/${image}`
  const markdown = `![](${src})`

  // Use md-editor's insert API to insert at cursor position
  if (editorRef.value) {
    editorRef.value.insert(() => ({
      targetValue: markdown,
      select: false,
      deviationStart: 0,
      deviationEnd: 0,
    }))
  } else {
    // Fallback: append at end
    documentForm.value.content += `\n${markdown}\n`
  }

  showImageGallery.value = false
}

/* ---------- Entity Linking Functions ---------- */
const filteredEntities = computed(() => {
  const query = entitySearch.value?.toLowerCase() || ''
  let entities: Array<{ id: number; name: string; displayName?: string; subtitle?: string }> = []

  switch (linkEntityType.value) {
  case 'npc':
    entities = entitiesStore.npcsForSelect || []
    break
  case 'location':
    entities = entitiesStore.locationsForSelect || []
    break
  case 'item':
    entities = entitiesStore.items || []
    break
  case 'faction':
    entities = entitiesStore.factions || []
    break
  case 'lore':
    entities = entitiesStore.loreForSelect || []
    break
  case 'player':
    // For players: displayName = human name (Spielername), subtitle = character name
    entities = (entitiesStore.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.metadata?.player_name || p.name,
      subtitle: p.metadata?.player_name ? p.name : undefined,
    }))
    break
  }

  if (!query) return entities

  return entities.filter((e) => {
    const nameMatch = e.name.toLowerCase().includes(query)
    const displayMatch = e.displayName?.toLowerCase().includes(query)
    return nameMatch || displayMatch
  })
})

function resolveEntityName(type: string, id: number): string {
  switch (type) {
  case 'npc':
    return entitiesStore.npcs?.find((e) => e.id === id)?.name || `NPC #${id}`
  case 'location':
    return entitiesStore.locations?.find((e) => e.id === id)?.name || `Location #${id}`
  case 'item':
    return entitiesStore.items?.find((e) => e.id === id)?.name || `Item #${id}`
  case 'faction':
    return entitiesStore.factions?.find((e) => e.id === id)?.name || `Faction #${id}`
  case 'lore':
    return entitiesStore.lore?.find((e) => e.id === id)?.name || `Lore #${id}`
  case 'player': {
    const player = entitiesStore.players?.find((e) => e.id === id)
    return player?.name || `Player #${id}`
  }
  default:
    return `Entity #${id}`
  }
}

function resolvePlayerHumanName(id: number): string | null {
  const player = entitiesStore.players?.find((e) => e.id === id)
  return player?.metadata?.player_name || null
}

function sanitizeHtml(html: string): string {
  const buildBadge = (type: string, id: string, entityId: number) => {
    const name = resolveEntityName(type, entityId)
    const icon = getEntityIcon(type)
    const color = getEntityColor(type)

    let displayHtml = name
    if (type === 'player') {
      const humanName = resolvePlayerHumanName(entityId)
      if (humanName) {
        displayHtml = `${humanName} <span style="font-size: 0.75rem; opacity: 0.8;">(${name})</span>`
      } else {
        displayHtml = `<em>${name}</em>`
      }
    }

    return `<span class="entity-badge" data-type="${type}" data-id="${id}" style="background-color: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"><i class="mdi ${icon}"></i>${displayHtml}</span>`
  }

  // Handle new format {{type:id}}
  let result = html.replace(/\{\{(\w+):(\d+)\}\}/g, (_match, type, id) => {
    const entityId = parseInt(id, 10)
    return buildBadge(type, id, entityId)
  })

  // Handle legacy format [Name](type:id)
  result = result.replace(/<a[^>]*href="(\w+):(\d+)"[^>]*>([^<]+)<\/a>/g, (_match, type, id, _name) => {
    const entityId = parseInt(id, 10)
    return buildBadge(type, id, entityId)
  })

  return result
}

function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    npc: 'mdi-account',
    location: 'mdi-map-marker',
    item: 'mdi-sword',
    faction: 'mdi-shield',
    lore: 'mdi-book-open-variant',
    player: 'mdi-account-star',
  }
  return icons[type] || 'mdi-link'
}

function getEntityColor(type: string): string {
  const colors: Record<string, string> = {
    npc: '#D4A574',
    location: '#8B7355',
    item: '#CC8844',
    faction: '#7B92AB',
    lore: '#9C6B98',
    player: '#4CAF50',
  }
  return colors[type] || '#888888'
}

function showLinkEntityDialog(type: EntityPreviewType) {
  linkEntityType.value = type
  entitySearch.value = ''
  showEntityLinkDialog.value = true
}

function insertEntityLink(entity: { id: number; name: string }) {
  const link = `{{${linkEntityType.value}:${entity.id}}}`

  if (editorRef.value) {
    editorRef.value.insert(() => ({
      targetValue: link,
      select: false,
      deviationStart: 0,
      deviationEnd: 0,
    }))
  } else {
    documentForm.value.content += link
  }

  showEntityLinkDialog.value = false
}

function handleEditorClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const badge = target.closest('.entity-badge')

  if (badge) {
    event.preventDefault()
    event.stopPropagation()

    const type = badge.getAttribute('data-type') as EntityPreviewType
    const id = badge.getAttribute('data-id')

    if (type && id) {
      previewEntityId.value = Number.parseInt(id)
      previewEntityType.value = type
      showEntityPreviewDialog.value = true
    }
  }
}

/* ---------- PDF Functions ---------- */
function triggerPdfUpload() {
  pdfFileInput.value?.click()
}

async function handlePdfUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  uploadingPdf.value = true

  try {
    // Create FormData
    const formData = new FormData()
    formData.append('entityId', String(props.entityId))
    formData.append('title', file.name.replace('.pdf', ''))
    formData.append('file', file)

    // Upload PDF
    await $fetch('/api/entity-documents/upload-pdf', {
      method: 'POST',
      body: formData,
    })

    // Reload documents
    await loadDocuments()

    // Reset input
    if (pdfFileInput.value) {
      pdfFileInput.value.value = ''
    }

    emit('changed') // Notify parent that document count changed
  } catch (error) {
    console.error('PDF upload failed:', error)
    alert('PDF Upload fehlgeschlagen. Bitte versuche es erneut.')
  } finally {
    uploadingPdf.value = false
  }
}

function openDocument(doc: Document) {
  if (doc.file_type === 'pdf') {
    // Open PDF preview dialog
    previewPdf(doc)
  } else {
    // Edit markdown document
    editDocument(doc)
  }
}

function previewPdf(doc: Document) {
  viewingPdf.value = doc
  showPdfPreview.value = true
}

function downloadPdf(doc: Document) {
  if (!doc.file_path) return

  try {
    // Firefox-compatible: Direct link with download attribute
    // No Blob, no fetch - just a simple link click
    const link = document.createElement('a')
    link.href = `/documents/${doc.file_path}?download=1`
    link.download = `${doc.title}.pdf`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Failed to download PDF:', error)
    alert('Download fehlgeschlagen. Bitte versuche es erneut.')
  }
}

/* ---------- Lifecycle ---------- */
onMounted(async () => {
  loadDocuments()
  // Load entities for linking - only load if not already loaded
  if (activeCampaignId.value) {
    await Promise.all([
      entitiesStore.fetchNPCs(activeCampaignId.value),
      entitiesStore.fetchLocations(activeCampaignId.value),
      entitiesStore.fetchItems(activeCampaignId.value),
      entitiesStore.fetchFactions(activeCampaignId.value),
      entitiesStore.fetchLore(activeCampaignId.value),
      entitiesStore.fetchPlayers(activeCampaignId.value),
    ])
  }
})
watch(() => props.entityId, loadDocuments)
</script>

<style scoped>
.entity-documents {
  min-height: 400px;
}
.image-card {
  cursor: pointer;
}
.pdf-viewer {
  width: 100%;
  min-height: 600px;
}
</style>

<style>
/* Global styles for entity badges in md-editor preview */
.entity-documents :deep(.entity-badge) {
  cursor: pointer;
  transition: opacity 0.2s;
}
.entity-documents :deep(.entity-badge:hover) {
  opacity: 0.8;
}
</style>
