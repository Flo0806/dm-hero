<template>
  <v-dialog :model-value="modelValue" max-width="900" scrollable @update:model-value="$emit('update:modelValue', $event)">
    <v-card v-if="item">
      <v-card-title class="d-flex align-center pa-4">
        <v-avatar :size="64" class="mr-4">
          <v-img v-if="item.image_url" :src="`/uploads/${item.image_url}`" cover />
          <v-icon v-else icon="mdi-treasure-chest" size="32" />
        </v-avatar>
        <div class="flex-grow-1">
          <h2 class="text-h5">{{ item.name }}</h2>
          <div v-if="item.metadata?.type || item.metadata?.rarity" class="text-body-2">
            <v-chip
              v-if="item.metadata?.rarity"
              :color="getRarityColor(item.metadata.rarity)"
              size="x-small"
              class="mr-1"
            >
              {{ $t(`items.rarities.${item.metadata.rarity}`) }}
            </v-chip>
            <span v-if="item.metadata?.type" class="text-medium-emphasis">
              {{ $t(`items.types.${item.metadata.type}`) }}
            </span>
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
        <v-tab value="owners">
          <v-icon start>mdi-account-group</v-icon>
          {{ $t('items.owners') }}
          <v-chip size="x-small" class="ml-2">{{ counts?.owners || 0 }}</v-chip>
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('nav.locations') }}
          <v-chip size="x-small" class="ml-2">{{ counts?.locations || 0 }}</v-chip>
        </v-tab>
        <v-tab value="factions">
          <v-icon start>mdi-shield-account</v-icon>
          {{ $t('nav.factions') }}
          <v-chip size="x-small" class="ml-2">{{ counts?.factions || 0 }}</v-chip>
        </v-tab>
        <v-tab value="lore">
          <v-icon start>mdi-book-open-variant</v-icon>
          {{ $t('nav.lore') }}
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
              <!-- Type & Attunement -->
              <div v-if="item.metadata?.type || item.metadata?.attunement" class="mb-4">
                <v-chip v-if="item.metadata?.type" size="small" variant="tonal" class="mr-2">
                  {{ $t(`items.types.${item.metadata.type}`) }}
                </v-chip>
                <v-chip v-if="item.metadata?.attunement" size="small" color="purple">
                  {{ $t('items.requiresAttunement') }}
                </v-chip>
              </div>

              <!-- Description -->
              <div v-if="item.description" class="mb-4">
                <h3 class="text-h6 mb-2">
                  {{ $t('items.description') }}
                </h3>
                <p class="text-body-1">
                  {{ item.description }}
                </p>
              </div>

              <!-- Metadata Grid -->
              <v-row dense>
                <v-col v-if="item.metadata?.value" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="amber">mdi-currency-usd</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('items.value') }}</div>
                        <div class="font-weight-medium">{{ item.metadata.value }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="item.metadata?.weight" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="grey">mdi-weight</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('items.weight') }}</div>
                        <div class="font-weight-medium">{{ item.metadata.weight }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="item.metadata?.charges" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="blue">mdi-lightning-bolt</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('items.charges') }}</div>
                        <div class="font-weight-medium">{{ item.metadata.charges }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="item.metadata?.properties" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="primary">mdi-star</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('items.properties') }}</div>
                        <div class="font-weight-medium">{{ item.metadata.properties }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-window-item>

          <!-- Owners Tab -->
          <v-window-item value="owners">
            <EntityRelationsList
              :entities="owners || []"
              :loading="loadingOwners"
              entity-type="npc"
              :empty-message="$t('items.noOwners')"
              :show-relation-type="true"
              :clickable="false"
            />
          </v-window-item>

          <!-- Locations Tab -->
          <v-window-item value="locations">
            <EntityRelationsList
              :entities="locations || []"
              :loading="loadingLocations"
              entity-type="location"
              :empty-message="$t('items.noLocations')"
              :show-relation-type="true"
              :clickable="false"
            />
          </v-window-item>

          <!-- Factions Tab -->
          <v-window-item value="factions">
            <EntityRelationsList
              :entities="factions || []"
              :loading="loadingFactions"
              entity-type="faction"
              :empty-message="$t('items.noFactions')"
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
              :empty-message="$t('items.noLore')"
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
        <v-btn variant="text" prepend-icon="mdi-pencil" @click="$emit('edit', item)">
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

interface Item {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: {
    type?: string | null
    rarity?: string | null
    value?: number | null
    weight?: number | null
    charges?: string
    properties?: string
    attunement?: boolean
    damage?: string
    armor_class?: number
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

interface ItemCounts {
  owners: number
  locations: number
  factions: number
  lore: number
  documents: number
  images: number
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
  item: Item | null
  owners?: Entity[]
  locations?: Entity[]
  factions?: Entity[]
  lore?: Entity[]
  documents?: Document[]
  images?: Image[]
  counts?: ItemCounts | null
  loading?: boolean
  loadingOwners?: boolean
  loadingLocations?: boolean
  loadingFactions?: boolean
  loadingLore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  owners: () => [],
  locations: () => [],
  factions: () => [],
  lore: () => [],
  documents: () => [],
  images: () => [],
  counts: null,
  loading: false,
  loadingOwners: false,
  loadingLocations: false,
  loadingFactions: false,
  loadingLore: false,
})

defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [item: Item]
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

// Helper function for rarity colors
function getRarityColor(rarity: string) {
  const colors: Record<string, string> = {
    common: 'grey',
    uncommon: 'green',
    rare: 'blue',
    very_rare: 'purple',
    legendary: 'orange',
    artifact: 'red',
  }
  return colors[rarity] || 'grey'
}
</script>
