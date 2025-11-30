<template>
  <v-dialog :model-value="modelValue" max-width="900" scrollable @update:model-value="$emit('update:modelValue', $event)">
    <v-card v-if="lore">
      <!-- Header with Avatar & Name -->
      <v-card-title class="d-flex align-center pa-4">
        <v-avatar :size="64" class="mr-4">
          <v-img v-if="lore.image_url" :src="`/uploads/${lore.image_url}`" cover />
          <v-icon v-else icon="mdi-book-open-variant" size="32" />
        </v-avatar>
        <div class="flex-grow-1">
          <div class="text-h5">{{ lore.name }}</div>
          <div v-if="lore.metadata?.type" class="mt-1">
            <v-chip :color="getTypeColor(lore.metadata.type)" size="small">
              {{ $t(`lore.types.${lore.metadata.type}`) }}
            </v-chip>
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- Tabs -->
      <v-tabs v-model="currentTab" bg-color="surface">
        <v-tab value="overview">
          <v-icon start>mdi-information</v-icon>
          {{ $t('common.details') }}
        </v-tab>
        <v-tab value="npcs">
          <v-icon start>mdi-account-group</v-icon>
          {{ $t('npcs.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.npcs }}</v-chip>
        </v-tab>
        <v-tab value="items">
          <v-icon start>mdi-treasure-chest</v-icon>
          {{ $t('items.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.items }}</v-chip>
        </v-tab>
        <v-tab value="factions">
          <v-icon start>mdi-shield-account</v-icon>
          {{ $t('factions.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.factions }}</v-chip>
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('locations.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.locations }}</v-chip>
        </v-tab>
        <v-tab value="documents">
          <v-icon start>mdi-file-document</v-icon>
          {{ $t('documents.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.documents }}</v-chip>
        </v-tab>
        <v-tab value="gallery">
          <v-icon start>mdi-image</v-icon>
          {{ $t('common.images') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.images }}</v-chip>
        </v-tab>
      </v-tabs>

      <v-divider />

      <!-- Tab Content -->
      <v-card-text style="max-height: 600px; overflow-y: auto">
        <v-window v-model="currentTab">
          <!-- Overview Tab -->
          <v-window-item value="overview">
            <div class="pa-4">
              <!-- Date Card -->
              <v-card v-if="lore.metadata?.date" variant="tonal" class="mb-4">
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-1">
                    {{ $t('lore.date') }}
                  </div>
                  <div class="d-flex align-center">
                    <v-icon icon="mdi-calendar" size="small" class="mr-2" />
                    {{ lore.metadata.date }}
                  </div>
                </v-card-text>
              </v-card>

              <!-- Description -->
              <v-card v-if="lore.description" variant="tonal">
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-2">
                    {{ $t('lore.description') }}
                  </div>
                  <div class="text-body-1">
                    {{ lore.description }}
                  </div>
                </v-card-text>
              </v-card>

              <!-- Empty state if no data -->
              <div
                v-if="!lore.description && !lore.metadata?.date"
                class="text-center py-8 text-medium-emphasis"
              >
                {{ $t('common.noDetails') }}
              </div>
            </div>
          </v-window-item>

          <!-- NPCs Tab -->
          <v-window-item value="npcs">
            <EntityRelationsList
              :entities="npcs || []"
              :loading="loadingNpcs"
              entity-type="npc"
              :empty-message="$t('lore.noLinkedNpcs')"
              :show-relation-type="false"
              :clickable="false"
            />
          </v-window-item>

          <!-- Items Tab -->
          <v-window-item value="items">
            <EntityRelationsList
              :entities="items || []"
              :loading="loadingItems"
              entity-type="item"
              :empty-message="$t('lore.noLinkedItems')"
              :show-relation-type="false"
              :clickable="false"
            />
          </v-window-item>

          <!-- Factions Tab -->
          <v-window-item value="factions">
            <EntityRelationsList
              :entities="factions || []"
              :loading="loadingFactions"
              entity-type="faction"
              :empty-message="$t('lore.noLinkedFactions')"
              :show-relation-type="false"
              :clickable="false"
            />
          </v-window-item>

          <!-- Locations Tab -->
          <v-window-item value="locations">
            <EntityRelationsList
              :entities="locations || []"
              :loading="loadingLocations"
              entity-type="location"
              :empty-message="$t('lore.noLinkedLocations')"
              :show-relation-type="false"
              :clickable="false"
            />
          </v-window-item>

          <!-- Documents Tab -->
          <v-window-item value="documents">
            <EntityDocumentsView
              :documents="documents"
              :loading="loading"
              :empty-message="$t('documents.empty')"
            />
          </v-window-item>

          <!-- Gallery Tab -->
          <v-window-item value="gallery">
            <EntityImageGalleryView
              :images="images"
              :loading="loading"
              :empty-message="$t('common.noImages')"
              @preview="(image: Image) => $emit('preview-image', `/uploads/${image.image_url}`, lore?.name ?? '')"
            />
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-pencil" @click="$emit('edit', lore)">
          {{ $t('common.edit') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { Lore } from '../../../types/lore'
import EntityRelationsList from '~/components/shared/EntityRelationsList.vue'
import EntityDocumentsView from '~/components/shared/EntityDocumentsView.vue'
import EntityImageGalleryView from '~/components/shared/EntityImageGalleryView.vue'

interface Entity {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
}

interface Image {
  id: number
  image_url: string
  is_primary: boolean
}

interface Document {
  id: number
  title: string
  content: string
}

interface LoreCounts {
  npcs: number
  items: number
  factions: number
  locations: number
  documents: number
  images: number
}

interface Props {
  modelValue: boolean
  lore: Lore | null
  npcs?: Entity[]
  items?: Entity[]
  factions?: Entity[]
  locations?: Entity[]
  documents?: Document[]
  images?: Image[]
  counts?: LoreCounts | null
  loading?: boolean
  loadingNpcs?: boolean
  loadingItems?: boolean
  loadingFactions?: boolean
  loadingLocations?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  npcs: () => [],
  items: () => [],
  factions: () => [],
  locations: () => [],
  documents: () => [],
  images: () => [],
  counts: null,
  loading: false,
  loadingNpcs: false,
  loadingItems: false,
  loadingFactions: false,
  loadingLocations: false,
})

defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [lore: Lore]
  'preview-image': [imageUrl: string, title: string]
}>()

const { t: _t } = useI18n()

// Local tab state
const currentTab = ref('overview')

// Reset tab when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      currentTab.value = 'overview'
    }
  },
)

// Helper function for type colors
function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    myth: 'purple',
    legend: 'orange',
    history: 'blue',
    rumor: 'grey',
    prophecy: 'amber',
    secret: 'red',
  }
  return colors[type] || 'grey'
}
</script>
