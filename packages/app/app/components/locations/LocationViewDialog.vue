<template>
  <v-dialog :model-value="modelValue" max-width="900" scrollable @update:model-value="$emit('update:modelValue', $event)">
    <v-card v-if="location">
      <v-card-title class="d-flex align-center pa-4">
        <v-avatar :size="64" class="mr-4">
          <v-img v-if="location.image_url" :src="`/uploads/${location.image_url}`" cover />
          <v-icon v-else icon="mdi-map-marker" size="32" />
        </v-avatar>
        <div class="flex-grow-1">
          <h2 class="text-h5">{{ location.name }}</h2>
          <div v-if="location.metadata?.type" class="text-body-2 text-medium-emphasis">
            {{ location.metadata.type }}
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
          <v-chip size="x-small" class="ml-2">{{ counts?.npcs || 0 }}</v-chip>
        </v-tab>
        <v-tab value="items">
          <v-icon start>mdi-treasure-chest</v-icon>
          {{ $t('items.title') }}
          <v-chip size="x-small" class="ml-2">{{ items.length }}</v-chip>
        </v-tab>
        <v-tab value="lore">
          <v-icon start>mdi-book-open-variant</v-icon>
          {{ $t('lore.title') }}
          <v-chip size="x-small" class="ml-2">{{ counts?.lore || 0 }}</v-chip>
        </v-tab>
        <v-tab value="documents">
          <v-icon start>mdi-file-document</v-icon>
          {{ $t('documents.title') }}
          <v-chip size="x-small" class="ml-2">{{ counts?.documents || 0 }}</v-chip>
        </v-tab>
        <v-tab value="gallery">
          <v-icon start>mdi-image</v-icon>
          {{ $t('common.images') }}
          <v-chip size="x-small" class="ml-2">{{ counts?.images || 0 }}</v-chip>
        </v-tab>
      </v-tabs>

      <v-divider />

      <!-- Tab Content -->
      <v-card-text style="max-height: 600px; overflow-y: auto">
        <v-window v-model="currentTab">
          <!-- Overview Tab -->
          <v-window-item value="overview">
            <div class="pa-4">
              <!-- Breadcrumb Path -->
              <LocationBreadcrumb
                v-if="location.parent_entity_id"
                :location-id="location.id"
                class="mb-4"
              />

              <div v-if="location.description" class="mb-4">
                <h3 class="text-h6 mb-2">
                  {{ $t('locations.description') }}
                </h3>
                <p class="text-body-1">
                  {{ location.description }}
                </p>
              </div>

              <!-- Metadata Grid -->
              <v-row dense>
                <v-col v-if="location.metadata?.type" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="primary">mdi-shape</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('locations.type') }}</div>
                        <div class="font-weight-medium">{{ location.metadata.type }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="location.metadata?.region" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="secondary">mdi-map</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('locations.region') }}</div>
                        <div class="font-weight-medium">{{ location.metadata.region }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="location.metadata?.notes" cols="12">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-start">
                      <v-icon class="mr-3 mt-1">mdi-note-text</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('locations.notes') }}</div>
                        <div class="font-weight-medium">{{ location.metadata.notes }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-window-item>

          <!-- NPCs Tab -->
          <v-window-item value="npcs">
            <EntityRelationsList
              :entities="npcs || []"
              :loading="loadingNpcs"
              entity-type="npc"
              :empty-message="$t('locations.noConnectedNpcs')"
              :show-relation-type="true"
              :clickable="false"
            />
          </v-window-item>

          <!-- Items Tab -->
          <v-window-item value="items">
            <EntityRelationsList
              :entities="items || []"
              :loading="loadingItems"
              entity-type="item"
              :empty-message="$t('locations.noItems')"
              :show-relation-type="true"
              :clickable="false"
            />
          </v-window-item>

          <!-- Lore Tab -->
          <v-window-item value="lore">
            <EntityRelationsList
              :entities="lore || []"
              :loading="loadingLore"
              entity-type="lore"
              :empty-message="$t('locations.noLinkedLore')"
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
              @preview="(image: Image) => $emit('preview-image', image)"
            />
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-pencil" @click="$emit('edit', location)">
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
import EntityRelationsList from '~/components/shared/EntityRelationsList.vue'
import EntityDocumentsView from '~/components/shared/EntityDocumentsView.vue'
import EntityImageGalleryView from '~/components/shared/EntityImageGalleryView.vue'

interface Location {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  parent_entity_id?: number | null
  metadata: {
    type?: string
    region?: string
    notes?: string
  } | null
  created_at: string
  updated_at: string
}

interface Entity {
  id: number
  name: string
  description?: string | null
  relation_type?: string
  image_url?: string | null
  metadata?: Record<string, unknown> | null
}

interface LocationCounts {
  npcs: number
  lore: number
  images: number
  documents: number
}

interface Document {
  id: number
  title: string
  content: string
}

interface Image {
  id: number
  image_url: string
  is_primary: boolean
}

interface Props {
  modelValue: boolean
  location: Location | null
  npcs?: Entity[]
  items?: Entity[]
  lore?: Entity[]
  documents?: Document[]
  images?: Image[]
  counts?: LocationCounts | null
  loading?: boolean
  loadingNpcs?: boolean
  loadingItems?: boolean
  loadingLore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  npcs: () => [],
  items: () => [],
  lore: () => [],
  documents: () => [],
  images: () => [],
  counts: null,
  loading: false,
  loadingNpcs: false,
  loadingItems: false,
  loadingLore: false,
})

defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [location: Location]
  'preview-image': [image: Image]
}>()

const { t: _t } = useI18n() // Needed for $t in template

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
</script>
