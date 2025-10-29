<template>
  <v-container>
    <PageHeader
      :title="$t('locations.title')"
      :subtitle="$t('locations.subtitle')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('locations.create') }}
        </v-btn>
      </template>
    </PageHeader>

    <!-- Search Bar -->
    <v-text-field
      v-model="searchQuery"
      :placeholder="$t('common.search')"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      clearable
      class="mb-4"
    />

    <v-row v-if="pending">
      <v-col
        v-for="i in 6"
        :key="i"
        cols="12"
        md="6"
        lg="4"
      >
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <v-row v-else-if="filteredLocations && filteredLocations.length > 0">
      <v-col
        v-for="location in filteredLocations"
        :key="location.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card hover class="h-100 d-flex flex-column">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-map-marker" class="mr-2" color="primary" />
            {{ location.name }}
            <v-spacer />
            <v-chip
              v-if="location.metadata?.type"
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ location.metadata.type }}
            </v-chip>
          </v-card-title>
          <v-card-text class="flex-grow-1">
            <v-avatar
              v-if="location.image_url"
              size="80"
              rounded="lg"
              class="float-right ml-3 mb-2"
            >
              <v-img :src="`/pictures/${location.image_url}`" cover />
            </v-avatar>
            <div v-if="location.metadata?.region" class="mb-2">
              <v-chip size="small" prepend-icon="mdi-map" variant="outlined">
                {{ location.metadata.region }}
              </v-chip>
            </div>
            <div v-if="location.description" class="text-body-2">
              {{ truncateText(location.description, 100) }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              icon="mdi-eye"
              variant="text"
              @click="viewLocation(location)"
            />
            <v-btn
              icon="mdi-pencil"
              variant="text"
              @click="editLocation(location)"
            />
            <v-spacer />
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              @click="deleteLocation(location)"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      icon="mdi-map-marker-multiple"
      :title="$t('locations.empty')"
      :text="$t('locations.emptyText')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          {{ $t('locations.create') }}
        </v-btn>
      </template>
    </v-empty-state>

    <!-- Create/Edit Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="800"
    >
      <v-card>
        <v-card-title>
          {{ editingLocation ? $t('locations.edit') : $t('locations.create') }}
        </v-card-title>
        <v-card-text>
          <!-- Image Upload Section (only for editing) -->
          <!-- Image Gallery -->
          <v-card v-if="editingLocation" variant="outlined" class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-image-multiple" class="mr-2" />
              Bilder
              <v-spacer />
              <v-btn
                icon="mdi-plus"
                color="primary"
                size="small"
                :disabled="uploadingImage"
                @click="triggerImageUpload"
              >
                <v-icon>mdi-plus</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  Bilder hochladen
                </v-tooltip>
              </v-btn>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                multiple
                style="display: none"
                @change="handleImageUpload"
              >
            </v-card-title>
            <v-card-text>
              <v-progress-linear v-if="loadingImages" indeterminate />
              <v-list v-else-if="locationImages.length > 0">
                <v-list-item
                  v-for="image in locationImages"
                  :key="image.id"
                  class="mb-3"
                >
                  <template #prepend>
                    <v-avatar size="80" rounded="lg">
                      <v-img :src="`/pictures/${image.image_url}`" cover />
                    </v-avatar>
                  </template>
                  <v-list-item-title class="mb-2">
                    <div class="d-flex align-center gap-2">
                      <v-chip v-if="image.is_primary" size="small" color="primary">
                        <v-icon start icon="mdi-star" />
                        Primär
                      </v-chip>
                      <span class="text-caption text-medium-emphasis">
                        {{ new Date(image.created_at).toLocaleDateString('de-DE') }}
                      </span>
                    </div>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-text-field
                      :model-value="image.caption || ''"
                      placeholder="Beschriftung..."
                      variant="outlined"
                      density="compact"
                      hide-details
                      @blur="(e) => updateImageCaption(image.id, (e.target as HTMLInputElement).value)"
                      @keyup.enter="(e) => (e.target as HTMLInputElement).blur()"
                    />
                  </v-list-item-subtitle>
                  <template #append>
                    <div class="d-flex gap-1">
                      <v-btn
                        v-if="!image.is_primary"
                        icon="mdi-star-outline"
                        variant="text"
                        size="small"
                        @click="setPrimaryImage(image.id)"
                      >
                        <v-icon>mdi-star-outline</v-icon>
                        <v-tooltip activator="parent" location="bottom">
                          Als Primär setzen
                        </v-tooltip>
                      </v-btn>
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        size="small"
                        color="error"
                        @click="deleteImageFromGallery(image.id)"
                      >
                        <v-icon>mdi-delete</v-icon>
                        <v-tooltip activator="parent" location="bottom">
                          Löschen
                        </v-tooltip>
                      </v-btn>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
              <v-empty-state
                v-else
                icon="mdi-image-off"
                title="Keine Bilder"
                text="Lade Bilder hoch, um sie hier zu sehen"
              />
            </v-card-text>
          </v-card>

          <v-text-field
            v-model="locationForm.name"
            :label="$t('locations.name')"
            :rules="[v => !!v || $t('locations.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="locationForm.description"
            :label="$t('locations.description')"
            variant="outlined"
            rows="4"
            class="mb-4"
          />

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="locationForm.metadata.type"
                :label="$t('locations.type')"
                variant="outlined"
                :placeholder="$t('locations.typePlaceholder')"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="locationForm.metadata.region"
                :label="$t('locations.region')"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-textarea
            v-model="locationForm.metadata.notes"
            :label="$t('locations.notes')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="closeDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!locationForm.name"
            :loading="saving"
            @click="saveLocation"
          >
            {{ editingLocation ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- View Location Dialog -->
    <v-dialog
      v-model="showViewDialog"
      max-width="900"
    >
      <v-card v-if="viewingLocation">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-map-marker" class="mr-2" />
          {{ viewingLocation.name }}
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="showViewDialog = false"
          />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div v-if="viewingLocation.description" class="mb-4">
            <h3 class="text-h6 mb-2">
              {{ $t('locations.description') }}
            </h3>
            <p class="text-body-1">
              {{ viewingLocation.description }}
            </p>
          </div>

          <v-row v-if="viewingLocation.metadata" class="mb-4">
            <v-col v-if="viewingLocation.metadata.type" cols="12" md="6">
              <h4 class="text-subtitle-2 text-medium-emphasis">
                {{ $t('locations.type') }}
              </h4>
              <p>{{ viewingLocation.metadata.type }}</p>
            </v-col>
            <v-col v-if="viewingLocation.metadata.region" cols="12" md="6">
              <h4 class="text-subtitle-2 text-medium-emphasis">
                {{ $t('locations.region') }}
              </h4>
              <p>{{ viewingLocation.metadata.region }}</p>
            </v-col>
            <v-col v-if="viewingLocation.metadata.notes" cols="12">
              <h4 class="text-subtitle-2 text-medium-emphasis">
                {{ $t('locations.notes') }}
              </h4>
              <p>{{ viewingLocation.metadata.notes }}</p>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <h3 class="text-h6 mb-3">
            {{ $t('locations.connectedNpcs') }}
          </h3>
          <v-progress-linear v-if="loadingNpcs" indeterminate />
          <v-list v-else-if="connectedNpcs && connectedNpcs.length > 0">
            <v-list-item
              v-for="npc in connectedNpcs"
              :key="npc.id"
              :title="npc.name"
              :subtitle="`${npc.relation_type}${npc.relation_notes ? ': ' + npc.relation_notes : ''}`"
            >
              <template #prepend>
                <v-icon icon="mdi-account" />
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-body-2 text-medium-emphasis">
            {{ $t('locations.noConnectedNpcs') }}
          </p>

          <v-divider class="my-4" />

          <div class="d-flex justify-space-between align-center mb-3">
            <h3 class="text-h6">
              {{ $t('locations.items') }}
            </h3>
            <v-btn
              size="small"
              color="primary"
              prepend-icon="mdi-plus"
              @click="showAddItemForm = !showAddItemForm"
            >
              {{ $t('locations.addItem') }}
            </v-btn>
          </div>

          <!-- Add Item Form -->
          <v-card v-if="showAddItemForm" class="mb-4" elevation="0" border>
            <v-card-text>
              <v-row>
                <v-col cols="12">
                  <v-select
                    v-model="newItem.itemId"
                    :items="items"
                    :label="$t('locations.selectItem')"
                    item-title="name"
                    item-value="id"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-combobox
                    v-model="newItem.relationType"
                    :items="itemRelationTypeSuggestions"
                    :label="$t('locations.itemRelationType')"
                    :placeholder="$t('locations.itemRelationTypePlaceholder')"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="newItem.quantity"
                    :label="$t('locations.quantity')"
                    :placeholder="$t('locations.quantityPlaceholder')"
                    type="number"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>
              <div class="d-flex justify-end gap-2">
                <v-btn
                  variant="text"
                  @click="showAddItemForm = false; resetItemForm()"
                >
                  {{ $t('common.cancel') }}
                </v-btn>
                <v-btn
                  color="primary"
                  :disabled="!newItem.itemId || !newItem.relationType"
                  :loading="addingItem"
                  @click="addItemToLocation"
                >
                  {{ $t('common.save') }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-progress-linear v-if="loadingItems" indeterminate />
          <v-list v-else-if="locationItems && locationItems.length > 0">
            <v-list-item
              v-for="item in locationItems"
              :key="item.id"
              class="mb-2"
              border
            >
              <template #prepend>
                <v-icon icon="mdi-sword" color="primary" />
              </template>
              <v-list-item-title>
                {{ item.item_name }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <v-chip size="small" class="mr-1">
                  {{ $t(`locations.itemRelationTypes.${item.relation_type}`) }}
                </v-chip>
                <span v-if="item.notes?.quantity" class="text-caption">
                  {{ $t('locations.quantity') }}: {{ item.notes.quantity }}
                </span>
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="removeItem(item.id)"
                />
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-body-2 text-medium-emphasis">
            {{ $t('locations.noItems') }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            prepend-icon="mdi-pencil"
            @click="editLocation(viewingLocation); showViewDialog = false"
          >
            {{ $t('common.edit') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('locations.deleteTitle')"
      :message="$t('locations.deleteConfirm', { name: deletingLocation?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
interface Location {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: {
    type?: string
    region?: string
    notes?: string
  } | null
  created_at: string
  updated_at: string
}

interface ConnectedNPC {
  id: number
  name: string
  relation_type: string
  relation_notes: string | null
}

const { t } = useI18n()
const router = useRouter()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

// Get active campaign from campaign store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

onMounted(async () => {
  // Initialize campaign from cookie
  campaignStore.initFromCookie()

  if (!activeCampaignId.value) {
    router.push('/campaigns')
    return
  }

  // Load locations from store (cached)
  await entitiesStore.fetchLocations(activeCampaignId.value)
})

// Use store data
const locations = computed(() => entitiesStore.locations)
const pending = computed(() => entitiesStore.locationsLoading)

// Search
const searchQuery = ref('')
const filteredLocations = computed(() => {
  if (!locations.value)
    return []

  if (!searchQuery.value)
    return locations.value

  const query = searchQuery.value.toLowerCase()
  return locations.value.filter(location =>
    location.name.toLowerCase().includes(query)
    || location.description?.toLowerCase().includes(query)
    || location.metadata?.type?.toLowerCase().includes(query)
    || location.metadata?.region?.toLowerCase().includes(query),
  )
})

// Form state
const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const editingLocation = ref<Location | null>(null)
const viewingLocation = ref<Location | null>(null)
const deletingLocation = ref<Location | null>(null)
const saving = ref(false)
const deleting = ref(false)

const locationForm = ref({
  name: '',
  description: '',
  metadata: {
    type: '',
    region: '',
    notes: '',
  },
})

// Image gallery state
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const loadingImages = ref(false)
const locationImages = ref<Array<{
  id: number
  entity_id: number
  image_url: string
  caption: string | null
  is_primary: number
  display_order: number
  created_at: string
}>>([])

// Trigger file input click
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// Load images for location
async function loadLocationImages() {
  if (!editingLocation.value)
    return

  loadingImages.value = true
  try {
    const images = await $fetch<typeof locationImages.value>(`/api/entities/${editingLocation.value.id}/images`)
    locationImages.value = images
  }
  catch (error) {
    console.error('Failed to load images:', error)
    locationImages.value = []
  }
  finally {
    loadingImages.value = false
  }
}

// Handle image upload from native input (multiple files)
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length || !editingLocation.value)
    return

  uploadingImage.value = true

  try {
    const formData = new FormData()
    for (const file of Array.from(target.files)) {
      formData.append('file', file)
    }

    const response = await $fetch<{ success: boolean, images: Array<{ id: number, imageUrl: string, isPrimary: boolean }> }>(`/api/entities/${editingLocation.value.id}/images`, {
      method: 'POST',
      body: formData,
    })

    // Reload images
    await loadLocationImages()

    // If a primary image was uploaded, update the location
    const primaryImage = response.images.find(img => img.isPrimary)
    if (primaryImage && editingLocation.value) {
      editingLocation.value.image_url = primaryImage.imageUrl

      // Update the location in the store list directly
      const locationInList = entitiesStore.locations?.find(l => l.id === editingLocation.value!.id)
      if (locationInList) {
        locationInList.image_url = primaryImage.imageUrl
      }
    }

    // Clear file input
    target.value = ''
  }
  catch (error) {
    console.error('Failed to upload images:', error)
    alert(t('locations.uploadImageError'))
  }
  finally {
    uploadingImage.value = false
  }
}

// Delete image from gallery
async function deleteImageFromGallery(imageId: number) {
  try {
    await $fetch(`/api/entity-images/${imageId}`, {
      method: 'DELETE',
    })

    // Remove image from local array
    locationImages.value = locationImages.value.filter(img => img.id !== imageId)

    // Update the editingLocation's image_url with the new primary image (if any)
    const primaryImage = locationImages.value.find(img => img.is_primary === 1)
    if (editingLocation.value) {
      editingLocation.value.image_url = primaryImage?.image_url || null

      // Update the location in the store list directly
      const locationInList = entitiesStore.locations?.find(l => l.id === editingLocation.value!.id)
      if (locationInList) {
        locationInList.image_url = primaryImage?.image_url || null
      }
    }
  }
  catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('locations.deleteImageError'))
  }
}

// Set image as primary
async function setPrimaryImage(imageId: number) {
  try {
    await $fetch(`/api/entity-images/${imageId}/set-primary`, {
      method: 'PATCH',
    })

    // Update local image states
    locationImages.value.forEach((img) => {
      img.is_primary = img.id === imageId ? 1 : 0
    })

    // Update the editingLocation's image_url with the new primary image
    const primaryImage = locationImages.value.find(img => img.id === imageId)
    if (primaryImage && editingLocation.value) {
      editingLocation.value.image_url = primaryImage.image_url

      // Update the location in the store list directly
      const locationInList = entitiesStore.locations?.find(l => l.id === editingLocation.value!.id)
      if (locationInList) {
        locationInList.image_url = primaryImage.image_url
      }
    }
  }
  catch (error) {
    console.error('Failed to set primary image:', error)
  }
}

// Update image caption
async function updateImageCaption(imageId: number, caption: string) {
  try {
    await $fetch(`/api/entity-images/${imageId}/caption`, {
      method: 'PATCH',
      body: { caption },
    })

    // Update local state
    const image = locationImages.value.find(img => img.id === imageId)
    if (image) {
      image.caption = caption
    }
  }
  catch (error) {
    console.error('Failed to update caption:', error)
  }
}

// Connected NPCs
const connectedNpcs = ref<ConnectedNPC[]>([])
const loadingNpcs = ref(false)

// Location Items
const locationItems = ref<Array<{
  id: number
  to_entity_id: number
  item_name: string
  item_description: string | null
  item_metadata: Record<string, unknown> | null
  relation_type: string
  notes: Record<string, unknown> | null
}>>([])
const loadingItems = ref(false)
const showAddItemForm = ref(false)
const addingItem = ref(false)

const newItem = ref({
  itemId: null as number | null,
  relationType: '',
  quantity: 1,
})

const items = computed(() => entitiesStore.itemsForSelect)

const itemRelationTypeSuggestions = computed(() => [
  t('locations.itemRelationTypes.contains'),
  t('locations.itemRelationTypes.hidden'),
  t('locations.itemRelationTypes.displayed'),
  t('locations.itemRelationTypes.stored'),
  t('locations.itemRelationTypes.lost'),
  t('locations.itemRelationTypes.guarded'),
])

function truncateText(text: string, length: number) {
  if (text.length <= length)
    return text
  return `${text.substring(0, length)}...`
}

async function viewLocation(location: Location) {
  viewingLocation.value = location
  showViewDialog.value = true

  // Load connected NPCs
  loadingNpcs.value = true
  try {
    const data = await $fetch<ConnectedNPC[]>(`/api/locations/${location.id}/npcs`)
    connectedNpcs.value = data
  }
  finally {
    loadingNpcs.value = false
  }

  // Load Items
  await loadLocationItems()

  // Load items for the form if not already loaded
  if (!entitiesStore.itemsLoaded && activeCampaignId.value) {
    await entitiesStore.fetchItems(activeCampaignId.value)
  }
}

async function loadLocationItems() {
  if (!viewingLocation.value)
    return

  loadingItems.value = true
  try {
    const items = await $fetch<typeof locationItems.value>(`/api/locations/${viewingLocation.value.id}/items`)
    locationItems.value = items
  }
  catch (error) {
    console.error('Failed to load location items:', error)
    locationItems.value = []
  }
  finally {
    loadingItems.value = false
  }
}

async function addItemToLocation() {
  if (!viewingLocation.value || !newItem.value.itemId || !newItem.value.relationType)
    return

  addingItem.value = true

  try {
    await $fetch(`/api/locations/${viewingLocation.value.id}/items`, {
      method: 'POST',
      body: {
        itemId: newItem.value.itemId,
        relationType: newItem.value.relationType,
        quantity: newItem.value.quantity || undefined,
      },
    })

    await loadLocationItems()
    resetItemForm()
    showAddItemForm.value = false
  }
  catch (error) {
    console.error('Failed to add item to location:', error)
  }
  finally {
    addingItem.value = false
  }
}

async function removeItem(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, {
      method: 'DELETE',
    })
    await loadLocationItems()
  }
  catch (error) {
    console.error('Failed to remove item:', error)
  }
}

function resetItemForm() {
  newItem.value = {
    itemId: null,
    relationType: '',
    quantity: 1,
  }
}

async function editLocation(location: Location) {
  editingLocation.value = location
  locationForm.value = {
    name: location.name,
    description: location.description || '',
    metadata: {
      type: location.metadata?.type || '',
      region: location.metadata?.region || '',
      notes: location.metadata?.notes || '',
    },
  }
  showCreateDialog.value = true
  // Load images for this location
  await loadLocationImages()
}

function deleteLocation(location: Location) {
  deletingLocation.value = location
  showDeleteDialog.value = true
}

async function saveLocation() {
  if (!activeCampaignId.value)
    return

  saving.value = true

  try {
    if (editingLocation.value) {
      await entitiesStore.updateLocation(editingLocation.value.id, {
        name: locationForm.value.name,
        description: locationForm.value.description,
        metadata: locationForm.value.metadata,
      })
    }
    else {
      await entitiesStore.createLocation(activeCampaignId.value, {
        name: locationForm.value.name,
        description: locationForm.value.description,
        metadata: locationForm.value.metadata,
      })
    }

    closeDialog()
  }
  catch (error) {
    console.error('Failed to save location:', error)
  }
  finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingLocation.value)
    return

  deleting.value = true

  try {
    await entitiesStore.deleteLocation(deletingLocation.value.id)
    showDeleteDialog.value = false
    deletingLocation.value = null
  }
  catch (error) {
    console.error('Failed to delete location:', error)
  }
  finally {
    deleting.value = false
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingLocation.value = null
  locationForm.value = {
    name: '',
    description: '',
    metadata: {
      type: '',
      region: '',
      notes: '',
    },
  }
}
</script>
