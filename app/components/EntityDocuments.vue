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
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="startCreating"
        >
          {{ $t('documents.create') }}
        </v-btn>
      </div>

      <v-list v-if="filteredDocuments.length > 0">
        <v-list-item
          v-for="doc in filteredDocuments"
          :key="doc.id"
          @click="editDocument(doc)"
        >
          <template #prepend>
            <v-icon icon="mdi-file-document" class="mr-2" />
          </template>

          <v-list-item-title>{{ doc.title }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ formatDate(doc.date) }} • {{ $t('documents.lastUpdated') }}: {{ formatDate(doc.updated_at) }}
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex gap-1">
              <v-btn
                icon="mdi-pencil"
                variant="text"
                size="small"
                @click.stop="editDocument(doc)"
              />
              <v-btn
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                @click.stop="confirmDeleteDocument(doc)"
              />
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
        :rules="[v => !!v || $t('documents.titleRequired')]"
        variant="outlined"
        class="mb-4"
      />

      <v-text-field
        v-model="documentForm.date"
        :label="$t('documents.dateField')"
        :rules="[v => !!v || $t('documents.dateRequired')]"
        type="date"
        variant="outlined"
        class="mb-4"
      />

      <ClientOnly>
        <MdEditor
          ref="editorRef"
          v-model="documentForm.content"
          :language="currentLocale"
          :theme="editorTheme"
          :placeholder="$t('documents.contentPlaceholder')"
          :on-upload-img="handleImageUpload"
          :toolbars="toolbars"
          style="height: 420px;"
        >
          <!-- Custom Toolbar Button (Galerie) -->
          <template #defToolbars>
            <NormalToolbar
              :title="$t('documents.imageGallery')"
              @on-click="openImageGallery"
            >
              <template #trigger>
                <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22,16V4A2,2 0 0,0 20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16M11,12L13.03,14.71L16,11L20,16H8M2,6V20A2,2 0 0,0 4,22H18V20H4V6" />
                </svg>
              </template>
            </NormalToolbar>
          </template>
        </MdEditor>
      </ClientOnly>

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
          <v-empty-state v-else icon="mdi-image-off" title="Keine Bilder" text="Es wurden noch keine Bilder hochgeladen" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showImageGallery = false">Schließen</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRM -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('documents.deleteTitle')"
      :message="$t('documents.deleteConfirm')"
      :loading="deleting"
      @confirm="deleteDocument"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { MdEditor, NormalToolbar } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTheme } from 'vuetify'

interface Document {
  id: number
  entity_id: number
  title: string
  content: string
  date: string
  sort_order: number
  created_at: string
  updated_at: string
}

interface Props {
  entityId: number
}

const props = defineProps<Props>()
const { locale } = useI18n()
const theme = useTheme()

/* ---------- State ---------- */
const documents = ref<Document[]>([])
const searchQuery = ref('')
const editingDocument = ref<Document | null>(null)
const creatingDocument = ref(false)
const showDeleteDialog = ref(false)
const deletingDocument = ref<Document | null>(null)
const saving = ref(false)
const deleting = ref(false)
const showImageGallery = ref(false)
const galleryImages = ref<string[]>([])
const editorRef = ref<InstanceType<typeof MdEditor> | null>(null)

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
  theme.global.current.value.dark ? 'dark' : 'light'
)

// md-editor Toolbars: 0 = Platzhalter für Custom-Button via <template #defToolbars>
const toolbars = [
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
  0,
  'table',
  '-',
  'revoke',
  'next',
  '=',
  'pageFullscreen',
  'preview',
  'catalog',
] as const

const filteredDocuments = computed(() => {
  if (!searchQuery.value) return documents.value
  const q = searchQuery.value.toLowerCase()
  return documents.value.filter(doc =>
    doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q)
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
  } catch (e) {
    console.error('Failed to delete document:', e)
  } finally {
    deleting.value = false
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString(currentLocale.value, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function handleImageUpload(files: File[], callback: (urls: string[]) => void) {
  const uploaded: string[] = []
  for (const file of files) {
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await $fetch<{ image_url: string }>(`/api/documents/upload-image`, { method: 'POST', body: formData })
      uploaded.push(res.image_url)
    } catch (e) {
      console.error('Failed to upload image:', e)
    }
  }
  // md-editor erwartet endgültige URLs
  callback(uploaded.map(u => (u.startsWith('/pictures/') ? u : `/pictures/${u}`)))
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

/* ---------- Lifecycle ---------- */
onMounted(loadDocuments)
watch(() => props.entityId, loadDocuments)
</script>

<style scoped>
.entity-documents {
  min-height: 400px;
}
.image-card {
  cursor: pointer;
}
</style>
