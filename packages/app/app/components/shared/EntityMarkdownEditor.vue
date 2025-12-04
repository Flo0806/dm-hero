<template>
  <div ref="editorWrapperRef" class="entity-markdown-editor" @keydown="handleKeydown">
    <ClientOnly>
      <MdEditor
        ref="editorRef"
        v-model="internalValue"
        :language="currentLocale"
        :theme="editorTheme"
        :placeholder="placeholder"
        :on-upload-img="handleImageUpload"
        :toolbars="toolbars"
        :sanitize="sanitizeHtml"
        :style="{ height: height }"
        @click="handleEditorClick"
        @cancel.stop.prevent
      >
        <!-- Custom Entity Link Buttons -->
        <template #defToolbars>
          <NormalToolbar :title="$t('sessions.linkNpc')" @on-click="showLinkEntityDialog('npc')">
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
          <NormalToolbar :title="$t('sessions.linkItem')" @on-click="showLinkEntityDialog('item')">
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
          <NormalToolbar :title="$t('sessions.linkLore')" @on-click="showLinkEntityDialog('lore')">
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
          <NormalToolbar
            :title="$t('sessions.linkSession')"
            @on-click="showLinkEntityDialog('session')"
          >
            <template #trigger>
              <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z"
                />
              </svg>
            </template>
          </NormalToolbar>
          <NormalToolbar
            v-if="showImageGalleryButton"
            :title="$t('documents.imageGallery')"
            @on-click="openImageGallery"
          >
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
      <div class="editor-hint text-caption text-medium-emphasis mt-1 d-flex align-center">
        <v-hotkey keys="ctrl+space" :platform="platform" class="mr-2" />
        <span>{{ $t('editor.quickSearchHintText') }}</span>
      </div>
    </ClientOnly>

    <!-- Quick Entity Search Popup (Hotkey triggered) -->
    <v-menu
      v-model="showQuickSearch"
      :target="quickSearchTarget || undefined"
      location="top start"
      :close-on-content-click="false"
      max-width="400"
      location-strategy="connected"
      @update:model-value="onQuickSearchClose"
    >
      <v-card min-width="350" height="380" elevation="12" class="quick-search-card d-flex flex-column">
        <v-card-title class="text-body-1 py-2 flex-grow-0 flex-shrink-0">
          <v-icon start size="small">mdi-lightning-bolt</v-icon>
          {{ $t('editor.quickInsert') }}
        </v-card-title>
        <v-divider class="flex-grow-0 flex-shrink-0" />
        <v-text-field
          ref="quickSearchInput"
          v-model="quickSearchQuery"
          :placeholder="$t('editor.quickSearchPlaceholder')"
          variant="solo-filled"
          flat
          density="compact"
          hide-details
          autofocus
          prepend-inner-icon="mdi-magnify"
          class="mx-2 my-2 flex-grow-0 flex-shrink-0"
          @keydown.esc="closeQuickSearch"
          @keydown.enter.prevent="handleQuickSearchEnter"
          @keydown.down.prevent="navigateQuickSearch(1)"
          @keydown.up.prevent="navigateQuickSearch(-1)"
          @keydown.tab.prevent="navigateQuickSearch(1)"
        />
        <v-list v-if="!quickSearchQuery" density="compact" class="py-0 flex-grow-1" style="overflow-y: auto">
          <v-list-item
            v-for="(type, index) in entityTypes"
            :key="type.value"
            :prepend-icon="type.icon"
            :class="{ 'v-list-item--active': index === selectedResultIndex }"
            @click="selectEntityType(type.value)"
          >
            <v-list-item-title>{{ type.label }}</v-list-item-title>
            <template #append>
              <v-chip size="x-small" variant="text" class="text-disabled">
                {{ type.shortcut }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
        <v-list v-else density="compact" class="py-0 flex-grow-1" style="overflow-y: auto">
          <v-list-item
            v-for="(entity, index) in quickSearchResults"
            :key="`${entity.type}-${entity.id}`"
            :class="{ 'v-list-item--active': index === selectedResultIndex }"
            @click="insertQuickEntity(entity)"
          >
            <template #prepend>
              <v-icon :icon="getEntityIcon(entity.type)" size="small" />
            </template>
            <v-list-item-title>{{ entity.displayName || entity.name }}</v-list-item-title>
            <v-list-item-subtitle v-if="entity.subtitle">
              {{ entity.subtitle }}
            </v-list-item-subtitle>
            <template #append>
              <v-chip size="x-small" :color="getEntityColor(entity.type)" variant="flat">
                {{ entity.typeLabel }}
              </v-chip>
            </template>
          </v-list-item>
          <v-list-item v-if="quickSearchResults.length === 0">
            <v-list-item-title class="text-disabled">
              {{ $t('common.noResults') }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>

    <!-- Entity Link Dialog (Toolbar button triggered) -->
    <v-dialog v-model="showEntityLinkDialog" max-width="500">
      <v-card>
        <v-card-title>
          {{ $t(`sessions.link${linkEntityType.charAt(0).toUpperCase() + linkEntityType.slice(1)}`) }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="entitySearch"
            :placeholder="$t('common.search')"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-magnify"
            autofocus
            hide-details
            class="mb-3"
          />
          <v-list density="compact" max-height="300" style="overflow-y: auto">
            <v-list-item
              v-for="entity in filteredEntities"
              :key="entity.id"
              @click="insertEntityLink(entity)"
            >
              <v-list-item-title>{{ entity.displayName || entity.name }}</v-list-item-title>
              <v-list-item-subtitle v-if="entity.subtitle">
                {{ entity.subtitle }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="filteredEntities.length === 0">
              <v-list-item-title class="text-disabled">
                {{ $t('common.noResults') }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEntityLinkDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Entity Preview Dialog (not for sessions) -->
    <EntityPreviewDialog
      v-if="previewEntityType !== 'session'"
      v-model="showEntityPreviewDialog"
      :entity-id="previewEntityId"
      :entity-type="previewEntityTypeForDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { MdEditor, NormalToolbar } from 'md-editor-v3'
import type { ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTheme } from 'vuetify'
import EntityPreviewDialog from './EntityPreviewDialog.vue'

type EntityType = 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player' | 'session'

interface SessionItem {
  id: number
  title?: string | null
  session_number?: number | null
  date?: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    height?: string
    entityId?: number
    showImageGalleryButton?: boolean
    sessions?: SessionItem[]
  }>(),
  {
    placeholder: '',
    height: '400px',
    entityId: undefined,
    showImageGalleryButton: false,
    sessions: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'open-image-gallery': []
  'upload-image': [files: File[], callback: (urls: string[]) => void]
}>()

const { t } = useI18n()
const { locale } = useI18n()
const theme = useTheme()
const entitiesStore = useEntitiesStore()

// ============================================================================
// State
// ============================================================================
const internalValue = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

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

// Theme & Locale
const currentLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))
const editorTheme = computed<'light' | 'dark'>(() =>
  theme.global.current.value.dark ? 'dark' : 'light',
)

// Platform detection for hotkey display (Mac uses Cmd, others use Ctrl)
// Works in browser and Electron - v-hotkey uses 'mac' | 'pc'
const platform = computed<'mac' | 'pc'>(() => {
  if (import.meta.server) return 'pc'
  // Check userAgentData first (modern API)
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  if (uaData?.platform) {
    return uaData.platform.toLowerCase().includes('mac') ? 'mac' : 'pc'
  }
  // Fallback to userAgent (works in Electron too)
  return navigator.userAgent.toLowerCase().includes('mac') ? 'mac' : 'pc'
})

// Toolbar config
type ToolbarOrSlot = ToolbarNames | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
const toolbars = computed<ToolbarOrSlot[]>(() => {
  const base: ToolbarOrSlot[] = [
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
    6, // Session
  ]
  if (props.showImageGalleryButton) {
    base.push(7) // Gallery
  }
  base.push('table', '-', 'revoke', 'next', '=', 'preview')
  return base
})

// Entity Link Dialog (toolbar button)
const showEntityLinkDialog = ref(false)
const linkEntityType = ref<EntityType>('npc')
const entitySearch = ref('')

// Quick Search (hotkey)
const showQuickSearch = ref(false)
const quickSearchQuery = ref('')
const quickSearchTarget = ref<HTMLElement | null>(null)
const quickSearchInput = ref<InstanceType<typeof import('vuetify/components')['VTextField']> | null>(null)
const selectedResultIndex = ref(0)
const lastActiveElement = ref<HTMLElement | null>(null)

// Entity Preview
const showEntityPreviewDialog = ref(false)
const previewEntityId = ref<number | null>(null)
const previewEntityType = ref<EntityType>('npc')

// Cast for EntityPreviewDialog (excludes 'session')
type PreviewableEntityType = 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player'
const previewEntityTypeForDialog = computed<PreviewableEntityType>(
  () => (previewEntityType.value === 'session' ? 'npc' : previewEntityType.value) as PreviewableEntityType,
)

// Entity types for quick search menu
const entityTypes = computed(() => [
  { value: 'npc' as EntityType, label: t('nav.npcs'), icon: 'mdi-account', shortcut: 'npc' },
  {
    value: 'location' as EntityType,
    label: t('nav.locations'),
    icon: 'mdi-map-marker',
    shortcut: 'loc',
  },
  { value: 'item' as EntityType, label: t('nav.items'), icon: 'mdi-sword', shortcut: 'item' },
  {
    value: 'faction' as EntityType,
    label: t('nav.factions'),
    icon: 'mdi-shield',
    shortcut: 'fac',
  },
  {
    value: 'lore' as EntityType,
    label: t('nav.lore'),
    icon: 'mdi-book-open-variant',
    shortcut: 'lore',
  },
  {
    value: 'player' as EntityType,
    label: t('nav.players'),
    icon: 'mdi-account-star',
    shortcut: 'player',
  },
  {
    value: 'session' as EntityType,
    label: t('nav.sessions'),
    icon: 'mdi-calendar',
    shortcut: 'ses',
  },
])

// ============================================================================
// Computed: Filtered entities for dialogs
// ============================================================================
const filteredEntities = computed(() => {
  const query = entitySearch.value?.toLowerCase() || ''
  const entities = getEntitiesForType(linkEntityType.value)

  if (!query) return entities
  return entities.filter((e) => {
    const nameMatch = e.name.toLowerCase().includes(query)
    const displayMatch = e.displayName?.toLowerCase().includes(query)
    return nameMatch || displayMatch
  })
})

const quickSearchResults = computed(() => {
  const query = quickSearchQuery.value?.toLowerCase() || ''
  if (!query) return []

  // Check if query starts with entity type shortcut
  const typeMatch = query.match(/^(npc|loc|item|fac|lore|player|ses)\s*(.*)$/i)
  let searchType: EntityType | null = null
  let searchTerm = query

  if (typeMatch) {
    const shortcut = typeMatch[1]?.toLowerCase() || ''
    searchTerm = typeMatch[2] || ''
    const typeMap: Record<string, EntityType> = {
      npc: 'npc',
      loc: 'location',
      item: 'item',
      fac: 'faction',
      lore: 'lore',
      player: 'player',
      ses: 'session',
    }
    searchType = typeMap[shortcut] || null
  }

  const results: Array<{
    id: number
    name: string
    displayName?: string
    subtitle?: string
    type: EntityType
    typeLabel: string
  }> = []

  const typesToSearch: EntityType[] = searchType
    ? [searchType]
    : ['npc', 'location', 'item', 'faction', 'lore', 'player', 'session']

  for (const type of typesToSearch) {
    const entities = getEntitiesForType(type)
    const typeLabel = entityTypes.value.find((t) => t.value === type)?.label || type

    for (const entity of entities) {
      if (!searchTerm) {
        results.push({ ...entity, type, typeLabel })
      } else {
        const nameMatch = entity.name.toLowerCase().includes(searchTerm)
        const displayMatch = entity.displayName?.toLowerCase().includes(searchTerm)
        if (nameMatch || displayMatch) {
          results.push({ ...entity, type, typeLabel })
        }
      }
      if (results.length >= 20) break
    }
    if (results.length >= 20) break
  }

  return results
})

// ============================================================================
// Methods
// ============================================================================
function getEntitiesForType(
  type: EntityType,
): Array<{ id: number; name: string; displayName?: string; subtitle?: string }> {
  switch (type) {
  case 'npc':
    return entitiesStore.npcsForSelect || []
  case 'location':
    return entitiesStore.locationsForSelect || []
  case 'item':
    return entitiesStore.items || []
  case 'faction':
    return entitiesStore.factions || []
  case 'lore':
    return entitiesStore.loreForSelect || []
  case 'player':
    return (entitiesStore.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.metadata?.player_name || p.name,
      subtitle: p.metadata?.player_name ? p.name : undefined,
    }))
  case 'session':
    return (props.sessions || []).map((s: SessionItem) => ({
      id: s.id,
      name: s.title || `Session #${s.session_number}`,
      displayName: s.title || `Session #${s.session_number}`,
      subtitle: s.date ? new Date(s.date).toLocaleDateString() : undefined,
    }))
  default:
    return []
  }
}

function getEntityIcon(type: EntityType | string): string {
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

function getEntityColor(type: EntityType | string): string {
  const colors: Record<string, string> = {
    npc: 'warning',
    location: 'brown',
    item: 'orange',
    faction: 'info',
    lore: 'purple',
    player: 'success',
    session: 'primary',
  }
  return colors[type] || 'grey'
}

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
  case 'session': {
    const session = props.sessions?.find((s: SessionItem) => s.id === id)
    return session?.title || `Session #${id}`
  }
  default:
    return `Entity #${id}`
  }
}

function resolvePlayerHumanName(id: number): string | null {
  const player = entitiesStore.players?.find((e) => e.id === id)
  return player?.metadata?.player_name || null
}

// ============================================================================
// Toolbar Dialog Methods
// ============================================================================
function showLinkEntityDialog(type: EntityType) {
  linkEntityType.value = type
  entitySearch.value = ''
  showEntityLinkDialog.value = true
}

function insertEntityLink(entity: { id: number; name: string }) {
  const link = `{{${linkEntityType.value}:${entity.id}}}`
  insertAtCursor(link)
  showEntityLinkDialog.value = false
}

function openImageGallery() {
  emit('open-image-gallery')
}

// ============================================================================
// Quick Search Methods (Hotkey)
// ============================================================================
const editorWrapperRef = ref<HTMLElement | null>(null)

function handleKeydown(event: KeyboardEvent) {
  // Trigger quick search with Ctrl+Space (or Cmd+Space on Mac)
  if (event.key === ' ' && (event.ctrlKey || event.metaKey) && !showQuickSearch.value) {
    event.preventDefault()
    event.stopPropagation()
    // Save the current active element (textarea) to restore focus later
    lastActiveElement.value = document.activeElement as HTMLElement
    // Use the editor wrapper as target for the popup
    quickSearchTarget.value = editorWrapperRef.value
    quickSearchQuery.value = ''
    selectedResultIndex.value = 0
    showQuickSearch.value = true
    // Focus the input after the menu opens - use setTimeout to ensure DOM is ready
    setTimeout(() => {
      quickSearchInput.value?.focus()
    }, 50)
  }
}

function closeQuickSearch() {
  showQuickSearch.value = false
  quickSearchQuery.value = ''
  selectedResultIndex.value = 0
  // Restore focus to the editor
  nextTick(() => {
    lastActiveElement.value?.focus()
  })
}

function onQuickSearchClose(isOpen: boolean) {
  if (!isOpen) {
    // Menu was closed (click outside, etc.)
    quickSearchQuery.value = ''
    selectedResultIndex.value = 0
    // Restore focus to the editor
    nextTick(() => {
      lastActiveElement.value?.focus()
    })
  }
}

function selectEntityType(type: EntityType) {
  // Use the actual shortcut from entityTypes
  const typeInfo = entityTypes.value.find((t) => t.value === type)
  quickSearchQuery.value = (typeInfo?.shortcut || type) + ' '
  selectedResultIndex.value = 0
}

function navigateQuickSearch(direction: number) {
  // Determine max index based on current view (entity types or search results)
  const max = quickSearchQuery.value
    ? quickSearchResults.value.length - 1
    : entityTypes.value.length - 1

  if (max < 0) return

  const newIndex = selectedResultIndex.value + direction

  // Wrap around: going up from 0 goes to max, going down from max goes to 0
  if (newIndex < 0) {
    selectedResultIndex.value = max
  } else if (newIndex > max) {
    selectedResultIndex.value = 0
  } else {
    selectedResultIndex.value = newIndex
  }
}

function handleQuickSearchEnter() {
  if (!quickSearchQuery.value) {
    // No query = selecting entity type from the list
    const selectedType = entityTypes.value[selectedResultIndex.value]
    if (selectedType) {
      selectEntityType(selectedType.value)
    }
  } else {
    // Query exists = selecting from search results
    if (quickSearchResults.value.length > 0) {
      const selected = quickSearchResults.value[selectedResultIndex.value]
      if (selected) {
        insertQuickEntity(selected)
      }
    }
  }
}

function insertQuickEntity(entity: { id: number; type: EntityType }) {
  const link = `{{${entity.type}:${entity.id}}}`
  insertAtCursor(link)
  closeQuickSearch()
}

// ============================================================================
// Editor Helpers
// ============================================================================
function insertAtCursor(text: string) {
  if (editorRef.value) {
    editorRef.value.insert(() => ({
      targetValue: text,
      select: false,
      deviationStart: 0,
      deviationEnd: 0,
    }))
  } else {
    // Fallback: append at end
    internalValue.value += text
  }
}

async function handleImageUpload(
  files: File[],
  callback: (urls: string[]) => void,
): Promise<void> {
  emit('upload-image', files, callback)
}

function handleEditorClick(event: MouseEvent) {
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

// ============================================================================
// Public Methods (exposed to parent)
// ============================================================================
function insert(text: string) {
  insertAtCursor(text)
}

defineExpose({
  insert,
  editorRef,
})
</script>

<style scoped>
.entity-markdown-editor {
  position: relative;
}

.quick-search-card {
  border: 1px solid rgba(var(--v-theme-primary), 0.3);
}
</style>
