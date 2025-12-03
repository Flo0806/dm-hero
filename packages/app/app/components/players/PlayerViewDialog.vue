<template>
  <v-dialog v-model="internalShow" max-width="900" scrollable>
    <v-card v-if="player">
      <!-- Header with Avatar & Name -->
      <v-card-title class="d-flex align-center pa-4">
        <v-avatar :size="64" class="mr-4">
          <v-img v-if="player.image_url" :src="`/uploads/${player.image_url}`" cover />
          <v-icon v-else icon="mdi-account-star" size="32" />
        </v-avatar>
        <div class="flex-grow-1">
          <!-- Player Name (human) is primary -->
          <h2 class="text-h5">{{ player.metadata?.player_name || player.name }}</h2>
          <!-- Character name as subtitle if player_name exists -->
          <div v-if="player.metadata?.player_name" class="text-body-2 text-medium-emphasis">
            <v-icon size="x-small" class="mr-1">mdi-sword-cross</v-icon>
            {{ player.name }}
          </div>
        </div>
        <!-- Inspiration Badge -->
        <v-chip
          v-if="(player.metadata?.inspiration || 0) > 0"
          color="warning"
          variant="flat"
          size="large"
          class="mr-4"
        >
          <v-icon start>mdi-star</v-icon>
          {{ player.metadata?.inspiration || 0 }} {{ $t('players.inspiration') }}
        </v-chip>
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
        <v-tab value="characters">
          <v-icon start>mdi-account-group</v-icon>
          {{ $t('players.characters') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.characters }}</v-chip>
        </v-tab>
        <v-tab value="items">
          <v-icon start>mdi-sword</v-icon>
          {{ $t('nav.items') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.items }}</v-chip>
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('nav.locations') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.locations }}</v-chip>
        </v-tab>
        <v-tab value="factions">
          <v-icon start>mdi-shield</v-icon>
          {{ $t('nav.factions') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.factions }}</v-chip>
        </v-tab>
        <v-tab value="lore">
          <v-icon start>mdi-book-open-variant</v-icon>
          {{ $t('nav.lore') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.lore }}</v-chip>
        </v-tab>
        <v-tab value="documents">
          <v-icon start>mdi-file-document</v-icon>
          {{ $t('common.notes') }}
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
              <!-- Description -->
              <div v-if="player.description" class="mb-6">
                <h3 class="text-subtitle-1 font-weight-bold mb-2">{{ $t('players.description') }}</h3>
                <p class="text-body-2">{{ player.description }}</p>
              </div>

              <!-- Contact Info -->
              <v-row dense>
                <v-col v-if="player.metadata?.email" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="primary">mdi-email</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('players.email') }}</div>
                        <a :href="`mailto:${player.metadata.email}`" class="font-weight-medium text-decoration-none">
                          {{ player.metadata.email }}
                        </a>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="player.metadata?.discord" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="primary">mdi-discord</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('players.discord') }}</div>
                        <div class="font-weight-medium">{{ player.metadata.discord }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="player.metadata?.phone" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="primary">mdi-phone</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('players.phone') }}</div>
                        <a :href="`tel:${player.metadata.phone}`" class="font-weight-medium text-decoration-none">
                          {{ player.metadata.phone }}
                        </a>
                      </div>
                    </div>
                  </v-card>
                </v-col>
              </v-row>

              <!-- Notes -->
              <div v-if="player.metadata?.notes" class="mt-6">
                <h3 class="text-subtitle-1 font-weight-bold mb-2">{{ $t('players.notes') }}</h3>
                <v-card variant="outlined" class="pa-3">
                  <p class="text-body-2" style="white-space: pre-wrap">{{ player.metadata.notes }}</p>
                </v-card>
              </div>
            </div>
          </v-window-item>

          <!-- Characters (NPCs) Tab -->
          <v-window-item value="characters">
            <EntityRelationsList
              :entities="characters"
              :loading="loading"
              entity-type="npc"
              :empty-message="$t('players.noCharacters')"
              @click="$emit('view-npc', $event)"
            />
          </v-window-item>

          <!-- Items Tab -->
          <v-window-item value="items">
            <EntityRelationsList
              :entities="items"
              :loading="loading"
              entity-type="item"
              :empty-message="$t('players.noItems')"
              @click="$emit('view-item', $event)"
            />
          </v-window-item>

          <!-- Locations Tab -->
          <v-window-item value="locations">
            <EntityRelationsList
              :entities="locations"
              :loading="loading"
              entity-type="location"
              :empty-message="$t('players.noLocations')"
              @click="$emit('view-location', $event)"
            />
          </v-window-item>

          <!-- Factions Tab -->
          <v-window-item value="factions">
            <EntityRelationsList
              :entities="factions"
              :loading="loading"
              entity-type="faction"
              :empty-message="$t('players.noFactions')"
              @click="$emit('view-faction', $event)"
            />
          </v-window-item>

          <!-- Lore Tab -->
          <v-window-item value="lore">
            <EntityRelationsList
              :entities="loreEntries"
              :loading="loading"
              entity-type="lore"
              :empty-message="$t('players.noLore')"
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
              @preview="openImagePreview"
            />
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-pencil" @click="$emit('edit', player)">
          {{ $t('common.edit') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>

    <!-- Image Preview Dialog -->
    <v-dialog v-model="showImagePreview" max-width="800">
      <v-card v-if="previewImage">
        <v-img :src="`/uploads/${previewImage.image_url}`" />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showImagePreview = false">{{ $t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import type { Player } from '~~/types/player'
import EntityRelationsList from '~/components/shared/EntityRelationsList.vue'
import EntityDocumentsView from '~/components/shared/EntityDocumentsView.vue'
import EntityImageGalleryView from '~/components/shared/EntityImageGalleryView.vue'

interface Props {
  show: boolean
  player: Player | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  edit: [player: Player]
  'view-npc': [npcId: number]
  'view-item': [itemId: number]
  'view-location': [locationId: number]
  'view-faction': [factionId: number]
}>()

const internalShow = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const activeTab = ref('overview')
const loading = ref(false)

// Counts from player
const counts = computed(() => props.player?._counts)

// Data refs
const characters = ref<
  Array<{
    id: number
    relation_id: number
    name: string
    description?: string
    image_url?: string
  }>
>([])
const items = ref<
  Array<{
    id: number
    relation_id: number
    name: string
    description?: string
    image_url?: string
    rarity?: string
  }>
>([])
const locations = ref<
  Array<{
    id: number
    relation_id: number
    name: string
    description?: string
    image_url?: string
  }>
>([])
const factions = ref<
  Array<{
    id: number
    relation_id: number
    name: string
    description?: string
    image_url?: string
  }>
>([])
const loreEntries = ref<
  Array<{
    id: number
    name: string
    description?: string | null
    image_url?: string | null
  }>
>([])
const documents = ref<Array<{ id: number; title: string; content: string }>>([])
const images = ref<Array<{ id: number; image_url: string; is_primary: boolean }>>([])

// Image preview
const showImagePreview = ref(false)
const previewImage = ref<{ id: number; image_url: string; is_primary: boolean } | null>(null)

function openImagePreview(image: { id: number; image_url: string; is_primary: boolean }) {
  previewImage.value = image
  showImagePreview.value = true
}

// Load data when player changes
watch(
  () => props.player,
  async (newPlayer) => {
    if (!newPlayer) return

    loading.value = true
    try {
      // Load all data in parallel
      const [charactersData, itemsData, locationsData, factionsData, loreData, documentsData, imagesData] =
        await Promise.all([
          // Characters (NPCs linked to this player)
          $fetch<
            Array<{
              id: number
              name: string
              description?: string
              image_url?: string
            }>
          >(`/api/entities/${newPlayer.id}/related/npcs`)
            .then((data) =>
              data.map((npc) => ({
                ...npc,
                relation_id: npc.id,
              })),
            )
            .catch((error) => {
              console.error('Failed to load characters:', error)
              return []
            }),
          // Items
          $fetch<
            Array<{
              id: number
              name: string
              description?: string
              image_url?: string
              rarity?: string
            }>
          >(`/api/entities/${newPlayer.id}/related/items`)
            .then((data) =>
              data.map((item) => ({
                ...item,
                relation_id: item.id,
              })),
            )
            .catch((error) => {
              console.error('Failed to load items:', error)
              return []
            }),
          // Locations
          $fetch<
            Array<{
              id: number
              name: string
              description?: string
              image_url?: string
            }>
          >(`/api/entities/${newPlayer.id}/related/locations`)
            .then((data) =>
              data.map((loc) => ({
                ...loc,
                relation_id: loc.id,
              })),
            )
            .catch((error) => {
              console.error('Failed to load locations:', error)
              return []
            }),
          // Factions
          $fetch<
            Array<{
              id: number
              name: string
              description?: string
              image_url?: string
            }>
          >(`/api/entities/${newPlayer.id}/related/factions`)
            .then((data) =>
              data.map((fac) => ({
                ...fac,
                relation_id: fac.id,
              })),
            )
            .catch((error) => {
              console.error('Failed to load factions:', error)
              return []
            }),
          // Lore
          $fetch<
            Array<{
              id: number
              name: string
              description: string | null
              image_url: string | null
            }>
          >(`/api/entities/${newPlayer.id}/related/lore`).catch((error) => {
            console.error('Failed to load lore:', error)
            return []
          }),
          // Documents
          $fetch<Array<{ id: number; title: string; content: string }>>(
            `/api/entities/${newPlayer.id}/documents`,
          ).catch((error) => {
            console.error('Failed to load documents:', error)
            return []
          }),
          // Images
          $fetch<Array<{ id: number; image_url: string; is_primary: boolean }>>(
            `/api/entity-images/${newPlayer.id}`,
          ).catch((error) => {
            console.error('Failed to load images:', error)
            return []
          }),
        ])

      characters.value = charactersData
      items.value = itemsData
      locations.value = locationsData
      factions.value = factionsData
      loreEntries.value = loreData
      documents.value = documentsData
      images.value = imagesData
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function close() {
  emit('update:show', false)
}
</script>
