<template>
  <v-dialog v-model="internalShow" max-width="900" scrollable>
    <v-card v-if="npc">
      <!-- Header with Avatar & Name -->
      <v-card-title class="d-flex align-center pa-4">
        <!-- Back Button (only when viewing nested NPC) -->
        <v-btn v-if="canGoBack" icon="mdi-arrow-left" variant="text" class="mr-2" @click="$emit('go-back')">
          <v-icon>mdi-arrow-left</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ $t('common.back') }}
          </v-tooltip>
        </v-btn>

        <v-avatar :size="64" class="mr-4">
          <v-img v-if="npc.image_url" :src="`/uploads/${npc.image_url}`" cover />
          <v-icon v-else icon="mdi-account" size="32" />
        </v-avatar>
        <div class="flex-grow-1">
          <h2 class="text-h5">{{ npc.name }}</h2>
          <div class="text-body-2 text-medium-emphasis">
            <span v-if="npc.metadata?.race">{{ getRaceDisplayName(npc.metadata.race) }}</span>
            <span v-if="npc.metadata?.race && npc.metadata?.class"> • </span>
            <span v-if="npc.metadata?.class">{{ getClassDisplayName(npc.metadata.class) }}</span>
          </div>
        </div>
        <v-btn icon="mdi-pencil" variant="text" @click="$emit('edit', npc)">
          <v-icon>mdi-pencil</v-icon>
          <v-tooltip activator="parent" location="bottom">
            {{ $t('common.edit') }}
          </v-tooltip>
        </v-btn>
        <v-btn icon="mdi-close" variant="text" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- Tabs -->
      <v-tabs v-model="activeTab" bg-color="surface">
        <v-tab value="overview">
          <v-icon start>mdi-information</v-icon>
          {{ $t('npcs.details') }}
        </v-tab>
        <v-tab value="relations">
          <v-icon start>mdi-account-group</v-icon>
          {{ $t('npcs.npcRelations') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.relations }}</v-chip>
        </v-tab>
        <v-tab value="items">
          <v-icon start>mdi-bag-personal</v-icon>
          {{ $t('npcs.items') }}
          <v-chip v-if="counts" size="x-small" class="ml-2">{{ counts.items }}</v-chip>
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('nav.locations') }}
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
        <v-window v-model="activeTab">
          <!-- Overview Tab -->
          <v-window-item value="overview">
            <div class="pa-4">
              <!-- Type & Status -->
              <div v-if="npc.metadata?.type || npc.metadata?.status" class="mb-4">
                <v-chip
                  v-if="npc.metadata?.type"
                  :prepend-icon="getTypeIcon(npc.metadata.type)"
                  size="small"
                  color="primary"
                  variant="tonal"
                  class="mr-2"
                >
                  {{ $t(`npcs.types.${npc.metadata.type}`) }}
                </v-chip>
                <v-chip
                  v-if="npc.metadata?.status"
                  :prepend-icon="getStatusIcon(npc.metadata.status)"
                  :color="getStatusColor(npc.metadata.status)"
                  size="small"
                  variant="flat"
                >
                  {{ $t(`npcs.statuses.${npc.metadata.status}`) }}
                </v-chip>
              </div>

              <!-- Description -->
              <div v-if="npc.description" class="mb-6">
                <h3 class="text-subtitle-1 font-weight-bold mb-2">{{ $t('npcs.description') }}</h3>
                <p class="text-body-2">{{ npc.description }}</p>
              </div>

              <!-- Metadata Grid -->
              <v-row dense>
                <v-col v-if="npc.metadata?.location" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="primary">mdi-map-marker</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('npcs.location') }}</div>
                        <div class="font-weight-medium">{{ npc.metadata.location }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="counts?.factionName" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3" color="secondary">mdi-shield-account</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('npcs.faction') }}</div>
                        <div class="font-weight-medium">{{ counts.factionName }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="npc.metadata?.age" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3">mdi-calendar</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('npcs.age') }}</div>
                        <div class="font-weight-medium">{{ npc.metadata.age }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
                <v-col v-if="npc.metadata?.gender" cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="d-flex align-center">
                      <v-icon class="mr-3">mdi-gender-male-female</v-icon>
                      <div>
                        <div class="text-caption text-medium-emphasis">{{ $t('npcs.gender') }}</div>
                        <div class="font-weight-medium">{{ $t(`npcs.genders.${npc.metadata.gender}`) }}</div>
                      </div>
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-window-item>

          <!-- Relations Tab -->
          <v-window-item value="relations">
            <div class="pa-4">
              <div v-if="loading" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else-if="relations.length === 0" class="text-center py-8 text-medium-emphasis">
                {{ $t('npcs.npcRelations') }} - Keine Daten
              </div>
              <v-list v-else lines="two">
                <v-list-item
                  v-for="rel in relations"
                  :key="rel.relation_id"
                  class="mb-2"
                  style="cursor: pointer"
                  @click="$emit('view-npc', rel.id)"
                >
                  <template #prepend>
                    <v-avatar color="primary" size="48">
                      <v-img v-if="rel.image_url" :src="`/uploads/${rel.image_url}`" />
                      <v-icon v-else>mdi-account</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-medium">
                    {{ rel.name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <div class="d-flex align-center gap-2 mt-1">
                      <v-chip size="x-small" color="primary" variant="tonal">
                        {{ $t(`npcs.npcRelationTypes.${rel.relation_type}`, rel.relation_type) }}
                      </v-chip>
                      <span v-if="rel.notes" class="text-caption">{{ rel.notes }}</span>
                    </div>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>
          </v-window-item>

          <!-- Items Tab -->
          <v-window-item value="items">
            <div class="pa-4">
              <div v-if="loading" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else-if="items.length === 0" class="text-center py-8 text-medium-emphasis">
                {{ $t('npcs.items') }} - Keine Daten
              </div>
              <v-list v-else lines="two">
                <v-list-item
                  v-for="item in items"
                  :key="item.relation_id"
                  class="mb-2"
                  style="cursor: pointer"
                  @click="$emit('view-item', item.id)"
                >
                  <template #prepend>
                    <v-avatar color="secondary" size="48">
                      <v-img v-if="item.image_url" :src="`/uploads/${item.image_url}`" />
                      <v-icon v-else>mdi-treasure-chest</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-medium">
                    {{ item.name }}
                    <v-chip v-if="item.rarity" size="x-small" :color="getRarityColor(item.rarity)" class="ml-2">
                      {{ $t(`items.rarities.${item.rarity}`) }}
                    </v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <div class="d-flex align-center gap-2 mt-1">
                      <v-chip v-if="item.relation_type" size="x-small" color="primary" variant="tonal">
                        {{ $t(`npcs.itemRelationTypes.${item.relation_type}`, item.relation_type) }}
                      </v-chip>
                      <v-chip v-if="item.quantity && item.quantity > 1" size="x-small" variant="outlined">
                        {{ item.quantity }}x
                      </v-chip>
                      <v-chip v-if="item.equipped" size="x-small" color="success" variant="tonal">
                        {{ $t('npcs.equipped') }}
                      </v-chip>
                      <span v-if="item.description" class="text-caption text-medium-emphasis">
                        {{ item.description }}
                      </span>
                    </div>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>
          </v-window-item>

          <!-- Locations Tab -->
          <v-window-item value="locations">
            <div class="pa-4">
              <div v-if="loading" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else-if="locations.length === 0" class="text-center py-8 text-medium-emphasis">
                {{ $t('nav.locations') }} - Keine Daten
              </div>
              <v-list v-else lines="two">
                <v-list-item
                  v-for="location in locations"
                  :key="location.relation_id"
                  class="mb-2"
                  style="cursor: pointer"
                  @click="$emit('view-location', location.id)"
                >
                  <template #prepend>
                    <v-avatar color="accent" size="48">
                      <v-img v-if="location.image_url" :src="`/uploads/${location.image_url}`" />
                      <v-icon v-else>mdi-map-marker</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-medium">
                    {{ location.name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <div class="d-flex align-center gap-2 mt-1">
                      <v-chip v-if="location.relation_type" size="x-small" color="primary" variant="tonal">
                        {{ $t(`npcs.relationTypes.${location.relation_type}`, location.relation_type) }}
                      </v-chip>
                      <v-chip v-if="location.type" size="x-small" variant="outlined">
                        {{ $t(`locations.types.${location.type}`) }}
                      </v-chip>
                      <span v-if="location.description" class="text-caption text-medium-emphasis">
                        {{ location.description }}
                      </span>
                    </div>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>
          </v-window-item>

          <!-- Documents Tab -->
          <v-window-item value="documents">
            <div class="pa-4">
              <div v-if="loading" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else-if="documents.length === 0" class="text-center py-8 text-medium-emphasis">
                {{ $t('documents.empty') }}
              </div>
              <div v-else>
                <v-expansion-panels variant="accordion">
                  <v-expansion-panel v-for="doc in documents" :key="doc.id">
                    <v-expansion-panel-title>
                      <v-icon start>mdi-file-document</v-icon>
                      {{ doc.title }}
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <MdPreview :model-value="doc.content || ''" language="en-US" />
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </div>
            </div>
          </v-window-item>

          <!-- Gallery Tab -->
          <v-window-item value="gallery">
            <div class="pa-4">
              <div v-if="loading" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else-if="images.length === 0" class="text-center py-8 text-medium-emphasis">
                {{ $t('common.noImages') }}
              </div>
              <v-row v-else dense>
                <v-col v-for="image in images" :key="image.id" cols="6" sm="4" md="3">
                  <v-card @click="openImagePreview(image)">
                    <v-img :src="`/uploads/${image.image_url}`" aspect-ratio="1" cover>
                      <v-chip v-if="image.is_primary" size="x-small" color="primary" class="ma-2">
                        {{ $t('common.primary') }}
                      </v-chip>
                    </v-img>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.close') }}</v-btn>
        <v-btn color="primary" variant="tonal" @click="$emit('edit', npc)">
          <v-icon start>mdi-pencil</v-icon>
          {{ $t('common.edit') }}
        </v-btn>
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
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import type { NPC } from '~~/types/npc'

interface Props {
  show: boolean
  npc: NPC | null
  races?: Array<{ name: string; name_de?: string; name_en?: string }>
  classes?: Array<{ name: string; name_de?: string; name_en?: string }>
  canGoBack?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  races: () => [],
  classes: () => [],
  canGoBack: false,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  edit: [npc: NPC]
  'view-npc': [npcId: number]
  'view-item': [itemId: number]
  'view-location': [locationId: number]
  'go-back': []
}>()

const { locale } = useI18n()
const { getCounts } = useNpcCounts()

const internalShow = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const activeTab = ref('overview')
const loading = ref(false)

// Reactive counts
const counts = computed(() => (props.npc ? getCounts(props.npc.id) || props.npc._counts : undefined))

// Data refs
const relations = ref<
  Array<{
    id: number
    relation_id: number
    name: string
    relation_type: string
    notes?: string
    image_url?: string
  }>
>([])
const items = ref<
  Array<{
    id: number
    relation_id: number
    name: string
    description?: string
    relation_type?: string
    quantity?: number
    equipped?: boolean
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
    relation_type?: string
    image_url?: string
    type?: string
    region?: string
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

// Load data when NPC changes
watch(
  () => props.npc,
  async (newNpc) => {
    if (!newNpc) return

    loading.value = true
    try {
      // Load all data in parallel
      const [relationsData, itemsData, locationsData, documentsData, imagesData] = await Promise.all([
        $fetch<
          Array<{
            id: number
            relation_id: number
            name: string
            relation_type: string
            notes?: string
            image_url?: string
          }>
        >(`/api/npcs/${newNpc.id}/relations`).catch((error) => {
          console.error('Failed to load relations:', error)
          return []
        }),
        $fetch<
          Array<{
            id: number
            relation_id: number
            name: string
            description?: string
            relation_type?: string
            quantity?: number
            equipped?: boolean
            image_url?: string
            rarity?: string
          }>
        >(`/api/npcs/${newNpc.id}/items`).catch((error) => {
          console.error('Failed to load items:', error)
          return []
        }),
        $fetch<
          Array<{
            id: number
            relation_id: number
            name: string
            description?: string
            relation_type?: string
            image_url?: string
            type?: string
            region?: string
          }>
        >(`/api/npcs/${newNpc.id}/locations`).catch((error) => {
          console.error('Failed to load locations:', error)
          return []
        }),
        $fetch<Array<{ id: number; title: string; content: string }>>(`/api/entities/${newNpc.id}/documents`).catch(
          (error) => {
            console.error('Failed to load documents:', error)
            return []
          },
        ),
        $fetch<Array<{ id: number; image_url: string; is_primary: boolean }>>(
          `/api/entity-images/${newNpc.id}`,
        ).catch((error) => {
          console.error('Failed to load images:', error)
          return []
        }),
      ])

      relations.value = relationsData
      items.value = itemsData
      locations.value = locationsData
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

// Helper functions
function getRaceDisplayName(raceName: string): string {
  const race = props.races.find((r) => r.name === raceName)
  if (!race) return raceName
  if (race.name_de && race.name_en) {
    return locale.value === 'de' ? race.name_de : race.name_en
  }
  return race.name
}

function getClassDisplayName(className: string): string {
  const classData = props.classes.find((c) => c.name === className)
  if (!classData) return className
  if (classData.name_de && classData.name_en) {
    return locale.value === 'de' ? classData.name_de : classData.name_en
  }
  return classData.name
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    ally: 'mdi-handshake',
    enemy: 'mdi-sword-cross',
    neutral: 'mdi-minus-circle',
    questgiver: 'mdi-exclamation',
    merchant: 'mdi-cart',
    guard: 'mdi-shield',
    noble: 'mdi-crown',
    commoner: 'mdi-account',
    villain: 'mdi-skull',
    mentor: 'mdi-school',
    companion: 'mdi-account-multiple',
    informant: 'mdi-eye',
  }
  return icons[type] || 'mdi-account'
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    alive: 'mdi-heart-pulse',
    dead: 'mdi-skull',
    missing: 'mdi-help-circle',
    imprisoned: 'mdi-lock',
    unknown: 'mdi-help',
    undead: 'mdi-zombie',
  }
  return icons[status] || 'mdi-help'
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    alive: 'success',
    dead: 'error',
    missing: 'warning',
    imprisoned: 'grey-darken-2',
    unknown: 'grey',
    undead: 'purple',
  }
  return colors[status] || 'grey'
}

function getRarityColor(rarity: string): string {
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
