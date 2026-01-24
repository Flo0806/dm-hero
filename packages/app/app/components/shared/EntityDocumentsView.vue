<template>
  <div class="pa-4">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="documents.length === 0" class="text-center py-8 text-medium-emphasis">
      {{ emptyMessage }}
    </div>

    <!-- Documents List (READ-ONLY) -->
    <v-expansion-panels v-else variant="accordion">
      <v-expansion-panel v-for="doc in documents" :key="doc.id">
        <v-expansion-panel-title>
          <v-icon start>{{ doc.file_type === 'pdf' ? 'mdi-file-pdf-box' : 'mdi-file-document' }}</v-icon>
          {{ doc.title }}
          <v-chip v-if="doc.file_type === 'pdf'" size="x-small" color="error" class="ml-2">PDF</v-chip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <!-- PDF Document -->
          <div v-if="doc.file_type === 'pdf'" class="d-flex flex-column align-center py-4">
            <v-icon size="64" color="error" class="mb-4">mdi-file-pdf-box</v-icon>
            <div class="d-flex ga-2">
              <v-btn
                prepend-icon="mdi-eye"
                color="primary"
                variant="outlined"
                @click="previewPdf(doc)"
              >
                {{ $t('documents.previewPdf') }}
              </v-btn>
              <v-btn
                prepend-icon="mdi-download"
                color="secondary"
                variant="outlined"
                @click="downloadPdf(doc)"
              >
                {{ $t('common.download') }}
              </v-btn>
            </div>
          </div>
          <!-- Markdown Document -->
          <ClientOnly v-else>
            <MdPreview
              :model-value="doc.content || ''"
              :language="currentLocale"
              :theme="editorTheme"
              :sanitize="sanitizeHtml"
              @click="handleClick"
            />
          </ClientOnly>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- PDF Preview Dialog -->
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

    <!-- Entity Preview Dialog -->
    <EntityPreviewDialog
      v-if="previewEntityType !== 'session'"
      v-model="showEntityPreviewDialog"
      :entity-id="previewEntityId"
      :entity-type="previewEntityTypeForDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { useTheme } from 'vuetify'
import EntityPreviewDialog from './EntityPreviewDialog.vue'

// Lazy import VuePdfEmbed to avoid SSR issues
const VuePdfEmbed = defineAsyncComponent(() => import('vue-pdf-embed'))

type EntityType = 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player' | 'session'

interface Document {
  id: number
  title: string
  content: string
  file_type?: 'markdown' | 'pdf'
  file_path?: string
}

interface Props {
  documents: Document[]
  loading?: boolean
  emptyMessage: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const { locale } = useI18n()
const theme = useTheme()
const entitiesStore = useEntitiesStore()

// Theme & Locale
const currentLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))
const editorTheme = computed<'light' | 'dark'>(() =>
  theme.global.current.value.dark ? 'dark' : 'light',
)

// Entity Preview
const showEntityPreviewDialog = ref(false)
const previewEntityId = ref<number | null>(null)
const previewEntityType = ref<EntityType>('npc')

// Cast for EntityPreviewDialog (excludes 'session')
type PreviewableEntityType = 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player'
const previewEntityTypeForDialog = computed<PreviewableEntityType>(
  () => (previewEntityType.value === 'session' ? 'npc' : previewEntityType.value) as PreviewableEntityType,
)

// PDF Preview state
const showPdfPreview = ref(false)
const viewingPdf = ref<Document | null>(null)

function previewPdf(doc: Document) {
  viewingPdf.value = doc
  showPdfPreview.value = true
}

function downloadPdf(doc: Document) {
  if (!doc.file_path) return

  try {
    const link = document.createElement('a')
    link.href = `/documents/${doc.file_path}?download=1`
    link.download = `${doc.title}.pdf`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Failed to download PDF:', error)
  }
}

// Helper functions
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
  case 'session':
    return `Session #${id}`
  default:
    return `Entity #${id}`
  }
}

function resolvePlayerHumanName(id: number): string | null {
  const player = entitiesStore.players?.find((e) => e.id === id)
  return player?.metadata?.player_name || null
}

function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    npc: 'mdi-account',
    location: 'mdi-map-marker',
    item: 'mdi-sword',
    faction: 'mdi-shield',
    lore: 'mdi-book-open-variant',
    player: 'mdi-account-star',
    session: 'mdi-calendar',
  }
  return icons[type] || 'mdi-link'
}

function sanitizeHtml(html: string): string {
  const buildBadge = (type: string, id: string, entityId: number) => {
    const name = resolveEntityName(type, entityId)
    const icon = getEntityIcon(type)
    const colorMap: Record<string, string> = {
      npc: '#D4A574',
      location: '#8B7355',
      item: '#CC8844',
      faction: '#7B92AB',
      lore: '#9C6B98',
      player: '#4CAF50',
      session: '#1976D2',
    }
    const color = colorMap[type] || '#888888'

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
  result = result.replace(/<a[^>]*href="(\w+):(\d+)"[^>]*>([^<]+)<\/a>/g, (_match, type, id) => {
    const entityId = parseInt(id, 10)
    return buildBadge(type, id, entityId)
  })

  return result
}

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const badge = target.closest('.entity-badge')

  if (badge) {
    event.preventDefault()
    event.stopPropagation()

    const type = badge.getAttribute('data-type') as EntityType
    const id = badge.getAttribute('data-id')

    if (type && id) {
      previewEntityId.value = Number.parseInt(id)
      previewEntityType.value = type
      showEntityPreviewDialog.value = true
    }
  }
}
</script>

<style scoped>
.pdf-viewer {
  width: 100%;
  min-height: 600px;
}
</style>
