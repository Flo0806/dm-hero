<template>
  <v-container>
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h1 class="text-h3 mb-2">
          {{ $t('locations.title') }}
        </h1>
        <p class="text-body-1 text-medium-emphasis">
          {{ $t('locations.subtitle') }}
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        size="large"
        @click="showCreateDialog = true"
      >
        {{ $t('locations.create') }}
      </v-btn>
    </div>

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
        <v-card hover class="h-100">
          <v-card-title>
            <v-icon icon="mdi-map-marker" class="mr-2" color="primary" />
            {{ location.name }}
          </v-card-title>
          <v-card-text>
            <div v-if="location.description" class="text-body-2 mb-3">
              {{ truncateText(location.description, 100) }}
            </div>
            <div v-if="location.metadata" class="text-caption">
              <div v-if="location.metadata.type" class="mb-1">
                <strong>{{ $t('locations.type') }}:</strong> {{ location.metadata.type }}
              </div>
              <div v-if="location.metadata.region" class="mb-1">
                <strong>{{ $t('locations.region') }}:</strong> {{ location.metadata.region }}
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              variant="text"
              prepend-icon="mdi-eye"
              @click="viewLocation(location)"
            >
              {{ $t('common.view') }}
            </v-btn>
            <v-btn
              variant="text"
              prepend-icon="mdi-pencil"
              @click="editLocation(location)"
            >
              {{ $t('common.edit') }}
            </v-btn>
            <v-spacer />
            <v-btn
              variant="text"
              color="error"
              prepend-icon="mdi-delete"
              @click="deleteLocation(location)"
            >
              {{ $t('common.delete') }}
            </v-btn>
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
    <v-dialog
      v-model="showDeleteDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ $t('locations.deleteTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('locations.deleteConfirm', { name: deletingLocation?.name }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeleteDialog = false"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="confirmDelete"
          >
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
interface Location {
  id: number
  name: string
  description: string | null
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

// Get active campaign
const activeCampaignId = ref<string | null>(null)

onMounted(() => {
  activeCampaignId.value = localStorage.getItem('activeCampaignId')

  if (!activeCampaignId.value) {
    router.push('/campaigns')
  }
})

// Fetch Locations
const { data: locations, pending, refresh } = await useFetch<Location[]>('/api/locations', {
  query: computed(() => ({ campaignId: activeCampaignId.value })),
  watch: [activeCampaignId],
})

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

// Connected NPCs
const connectedNpcs = ref<ConnectedNPC[]>([])
const loadingNpcs = ref(false)

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
}

function editLocation(location: Location) {
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
      await $fetch(`/api/locations/${editingLocation.value.id}`, {
        method: 'PATCH',
        body: {
          name: locationForm.value.name,
          description: locationForm.value.description,
          metadata: locationForm.value.metadata,
        },
      })
    }
    else {
      await $fetch('/api/locations', {
        method: 'POST',
        body: {
          ...locationForm.value,
          campaignId: activeCampaignId.value,
        },
      })
    }

    await refresh()
    closeDialog()
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
    await $fetch(`/api/locations/${deletingLocation.value.id}`, {
      method: 'DELETE',
    })

    await refresh()
    showDeleteDialog.value = false
    deletingLocation.value = null
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
