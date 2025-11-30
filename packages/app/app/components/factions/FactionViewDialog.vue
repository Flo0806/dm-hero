<template>
  <v-dialog v-model="internalShow" max-width="900" scrollable>
    <v-card v-if="faction">
      <!-- Header with Avatar & Name -->
      <v-card-title class="d-flex align-center pa-4">
        <v-avatar :size="64" class="mr-4">
          <v-img v-if="faction.image_url" :src="`/uploads/${faction.image_url}`" cover />
          <v-icon v-else icon="mdi-shield-account" size="32" />
        </v-avatar>
        <div class="flex-grow-1">
          <h2 class="text-h5">{{ faction.name }}</h2>
          <div v-if="faction.leader_name" class="text-body-2 text-medium-emphasis">
            {{ $t('factions.leader') }}: {{ faction.leader_name }}
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- Tabs -->
      <v-tabs v-model="activeTab" bg-color="surface">
        <v-tab value="overview">
          <v-icon start>mdi-information</v-icon>
          {{ $t('common.details') }}
        </v-tab>
        <v-tab value="members">
          <v-icon start>mdi-account-group</v-icon>
          {{ $t('factions.members') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.members }}</v-chip>
        </v-tab>
        <v-tab value="items">
          <v-icon start>mdi-treasure-chest</v-icon>
          {{ $t('items.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.items }}</v-chip>
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('locations.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.locations }}</v-chip>
        </v-tab>
        <v-tab value="lore">
          <v-icon start>mdi-book-open-variant</v-icon>
          {{ $t('lore.title') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.lore }}</v-chip>
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
        <v-window v-model="activeTab">
          <!-- Overview Tab -->
          <v-window-item value="overview">
            <div class="pa-4">
              <!-- Type & Alignment -->
              <div v-if="faction.metadata?.type || faction.metadata?.alignment" class="mb-4">
                <v-chip
                  v-if="faction.metadata?.type"
                  :prepend-icon="getTypeIcon(faction.metadata.type)"
                  size="small"
                  color="primary"
                  variant="tonal"
                  class="mr-2"
                >
                  {{ $t(`factions.types.${faction.metadata.type}`) }}
                </v-chip>
                <v-chip
                  v-if="faction.metadata?.alignment"
                  :prepend-icon="getAlignmentIcon(faction.metadata.alignment)"
                  :color="getAlignmentColor(faction.metadata.alignment)"
                  size="small"
                  variant="flat"
                >
                  {{ $t(`factions.alignments.${faction.metadata.alignment}`) }}
                </v-chip>
              </div>

              <!-- Description -->
              <div v-if="faction.description" class="mb-6">
                <h3 class="text-subtitle-1 font-weight-bold mb-2">
                  {{ $t('factions.description') }}
                </h3>
                <p class="text-body-2">{{ faction.description }}</p>
              </div>

              <!-- Metadata Grid -->
              <v-row dense>
                <v-col v-if="faction.metadata?.headquarters" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="primary">mdi-home-city</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">
                          {{ $t('factions.headquarters') }}
                        </div>
                        <div class="font-weight-medium">{{ faction.metadata.headquarters }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="faction.metadata?.goals" cols="12">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-start">
                      <v-icon class="mr-3 mt-1" color="secondary">mdi-target</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">
                          {{ $t('factions.goals') }}
                        </div>
                        <div class="font-weight-medium">{{ faction.metadata.goals }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="faction.metadata?.notes" cols="12">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-start">
                      <v-icon class="mr-3 mt-1">mdi-note-text</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">
                          {{ $t('factions.notes') }}
                        </div>
                        <div class="font-weight-medium">{{ faction.metadata.notes }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-window-item>

          <!-- Members Tab -->
          <v-window-item value="members">
            <EntityRelationsList
              :entities="members"
              :loading="loading"
              entity-type="npc"
              :empty-message="$t('factions.noMembers')"
              :show-relation-type="false"
              :clickable="false"
            />
          </v-window-item>

          <!-- Items Tab -->
          <v-window-item value="items">
            <EntityRelationsList
              :entities="items"
              :loading="loading"
              entity-type="item"
              :empty-message="$t('factions.noItems')"
              :show-relation-type="false"
              :clickable="false"
            />
          </v-window-item>

          <!-- Locations Tab -->
          <v-window-item value="locations">
            <EntityRelationsList
              :entities="locations"
              :loading="loading"
              entity-type="location"
              :empty-message="$t('factions.noLocations')"
              :show-relation-type="false"
              :clickable="false"
            />
          </v-window-item>

          <!-- Lore Tab -->
          <v-window-item value="lore">
            <EntityRelationsList
              :entities="loreEntries"
              :loading="loading"
              entity-type="lore"
              :empty-message="$t('factions.noLore')"
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
              @preview="(image: Image) => emit('preview-image', `/uploads/${image.image_url}`, faction?.name || '')"
            />
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <!-- Footer Actions -->
      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-pencil" @click="$emit('edit', faction)">
          {{ $t('common.edit') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">
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

interface Faction {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  leader_name?: string | null
  metadata: {
    type?: string
    alignment?: string
    headquarters?: string
    goals?: string
    notes?: string
  } | null
  created_at: string
  updated_at: string
  _counts?: {
    members: number
    items: number
    locations: number
    lore: number
    players: number
    documents: number
    images: number
  }
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

interface Props {
  modelValue: boolean
  faction: Faction | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [faction: Faction]
  'preview-image': [imageUrl: string, title: string]
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const activeTab = ref('overview')
const loading = ref(false)
const counts = ref<Faction['_counts'] | null>(null)

// Data refs
const members = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const items = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const locations = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const loreEntries = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const documents = ref<Document[]>([])
const images = ref<Image[]>([])

// Load data when faction changes
watch(
  () => props.faction?.id,
  async (newFactionId) => {
    if (newFactionId) {
      loading.value = true
      try {
        const [countsData, membersData, itemsData, locationsData, loreData, documentsData, imagesData] =
          await Promise.all([
            $fetch<Faction['_counts']>(`/api/factions/${newFactionId}/counts`),
            $fetch<typeof members.value>(`/api/entities/${newFactionId}/related/npcs`).catch(() => []),
            $fetch<typeof items.value>(`/api/entities/${newFactionId}/related/items`).catch(() => []),
            $fetch<typeof locations.value>(`/api/entities/${newFactionId}/related/locations`).catch(
              () => [],
            ),
            $fetch<typeof loreEntries.value>(`/api/entities/${newFactionId}/related/lore`).catch(
              () => [],
            ),
            $fetch<Document[]>(`/api/entities/${newFactionId}/documents`).catch(() => []),
            $fetch<Image[]>(`/api/entity-images/${newFactionId}`).catch(() => []),
          ])

        counts.value = countsData
        members.value = membersData
        items.value = itemsData
        locations.value = locationsData
        loreEntries.value = loreData
        documents.value = documentsData
        images.value = imagesData
      } catch (error) {
        console.error('Failed to load faction data:', error)
      } finally {
        loading.value = false
      }
    }
  },
  { immediate: true },
)

function close() {
  emit('update:modelValue', false)
  // Reset tab when closing
  activeTab.value = 'overview'
}

// Helper functions for icons and colors
function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    guild: 'mdi-hammer-wrench',
    government: 'mdi-bank',
    military: 'mdi-sword-cross',
    criminal: 'mdi-skull',
    religious: 'mdi-church',
    merchant: 'mdi-cart',
    arcane: 'mdi-wizard-hat',
    secret: 'mdi-eye-off',
    mercenary: 'mdi-sword',
    noble: 'mdi-crown',
  }
  return icons[type] || 'mdi-shield-account'
}

function getAlignmentIcon(alignment: string): string {
  const icons: Record<string, string> = {
    lawful_good: 'mdi-shield-check',
    neutral_good: 'mdi-heart',
    chaotic_good: 'mdi-hand-heart',
    lawful_neutral: 'mdi-scale-balance',
    true_neutral: 'mdi-minus-circle',
    chaotic_neutral: 'mdi-dice-multiple',
    lawful_evil: 'mdi-gavel',
    neutral_evil: 'mdi-skull',
    chaotic_evil: 'mdi-fire',
  }
  return icons[alignment] || 'mdi-help'
}

function getAlignmentColor(alignment: string): string {
  const colors: Record<string, string> = {
    lawful_good: 'blue',
    neutral_good: 'green',
    chaotic_good: 'cyan',
    lawful_neutral: 'grey',
    true_neutral: 'grey-darken-2',
    chaotic_neutral: 'orange',
    lawful_evil: 'red-darken-2',
    neutral_evil: 'red',
    chaotic_evil: 'red-darken-4',
  }
  return colors[alignment] || 'grey'
}
</script>
