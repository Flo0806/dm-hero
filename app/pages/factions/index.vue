<template>
  <v-container>
    <PageHeader
      :title="$t('factions.title')"
      :subtitle="$t('factions.subtitle')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('factions.create') }}
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

    <v-row v-else-if="filteredFactions && filteredFactions.length > 0">
      <v-col
        v-for="faction in filteredFactions"
        :key="faction.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card hover class="h-100">
          <v-card-title>
            <v-icon icon="mdi-shield-account" class="mr-2" color="primary" />
            {{ faction.name }}
          </v-card-title>
          <v-card-text>
            <div
              v-if="faction.image_url"
              class="float-right ml-3 mb-2 position-relative image-container"
              style="width: 80px; height: 80px;"
            >
              <v-avatar
                size="80"
                rounded="lg"
              >
                <v-img :src="`/pictures/${faction.image_url}`" cover />
              </v-avatar>
              <v-btn
                icon="mdi-download"
                size="x-small"
                variant="tonal"
                class="image-download-btn"
                @click.stop="downloadImage(`/pictures/${faction.image_url}`, faction.name)"
              />
            </div>
            <div v-if="faction.description" class="text-body-2 mb-3">
              {{ truncateText(faction.description, 100) }}
            </div>
            <div v-if="faction.metadata" class="text-caption">
              <div v-if="faction.metadata.type" class="mb-1">
                <strong>{{ $t('factions.type') }}:</strong> {{ faction.metadata.type }}
              </div>
              <div v-if="faction.metadata.leader" class="mb-1">
                <strong>{{ $t('factions.leader') }}:</strong> {{ faction.metadata.leader }}
              </div>
              <div v-if="faction.metadata.alignment" class="mb-1">
                <strong>{{ $t('factions.alignment') }}:</strong> {{ faction.metadata.alignment }}
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              icon="mdi-pencil"
              variant="text"
              @click="editFaction(faction)"
            />
            <v-spacer />
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              @click="deleteFaction(faction)"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      icon="mdi-shield-account-outline"
      :title="$t('factions.empty')"
      :text="$t('factions.emptyText')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          {{ $t('factions.create') }}
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
          {{ editingFaction ? $t('factions.edit') : $t('factions.create') }}
        </v-card-title>

        <v-tabs v-if="editingFaction" v-model="factionDialogTab" class="mb-4">
          <v-tab value="details">
            <v-icon start>
              mdi-shield-account
            </v-icon>
            {{ $t('factions.details') }}
          </v-tab>
          <v-tab value="members">
            <v-icon start>
              mdi-account-group
            </v-icon>
            {{ $t('factions.members') }} ({{ factionMembers.length }})
          </v-tab>
          <v-tab value="locations">
            <v-icon start>
              mdi-map-marker
            </v-icon>
            {{ $t('factions.locations') }} ({{ factionLocations.length }})
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 600px; overflow-y: auto">
          <v-tabs-window v-if="editingFaction" v-model="factionDialogTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
              <!-- Image Upload Section -->
              <v-card variant="outlined" class="mb-4">
                <v-card-text>
                  <div class="d-flex align-center gap-4">
                    <div class="position-relative image-container">
                      <v-avatar
                        size="120"
                        rounded="lg"
                        :color="editingFaction?.image_url ? undefined : 'grey-lighten-2'"
                      >
                        <v-img
                          v-if="editingFaction?.image_url && !uploadingImage"
                          :src="`/pictures/${editingFaction.image_url}`"
                          cover
                        />
                        <v-icon v-else-if="!uploadingImage" icon="mdi-shield-account" size="64" color="grey" />
                      </v-avatar>
                      <v-btn
                        v-if="editingFaction?.image_url && !uploadingImage"
                        icon="mdi-download"
                        size="small"
                        variant="tonal"
                        class="image-download-btn"
                        @click="downloadImage(`/pictures/${editingFaction.image_url}`, editingFaction.name)"
                      />
                      <v-progress-circular
                        v-if="uploadingImage"
                        indeterminate
                        color="primary"
                        size="120"
                        width="8"
                        style="position: absolute; top: 0; left: 0;"
                      />
                    </div>
                    <div class="flex-grow-1">
                      <div class="d-flex gap-2">
                        <v-btn
                          icon="mdi-camera"
                          color="primary"
                          size="large"
                          :disabled="uploadingImage || deletingImage"
                          @click="triggerImageUpload"
                        >
                          <v-icon>mdi-camera</v-icon>
                          <v-tooltip activator="parent" location="bottom">
                            {{ editingFaction?.image_url ? $t('factions.changeImage') : $t('factions.uploadImage') }}
                          </v-tooltip>
                        </v-btn>
                        <input
                          ref="fileInputRef"
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                          style="display: none"
                          @change="handleImageUpload"
                        >
                        <v-btn
                          v-if="editingFaction?.image_url"
                          icon="mdi-delete"
                          color="error"
                          variant="tonal"
                          size="large"
                          :loading="deletingImage"
                          :disabled="uploadingImage"
                          @click="deleteImage"
                        >
                          <v-icon>mdi-delete</v-icon>
                          <v-tooltip activator="parent" location="bottom">
                            {{ $t('factions.deleteImage') }}
                          </v-tooltip>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>

          <v-text-field
            v-model="factionForm.name"
            :label="$t('factions.name')"
            :rules="[v => !!v || $t('factions.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="factionForm.description"
            :label="$t('factions.description')"
            variant="outlined"
            rows="4"
            class="mb-4"
          />

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="factionForm.metadata.type"
                :label="$t('factions.type')"
                variant="outlined"
                :placeholder="$t('factions.typePlaceholder')"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="factionForm.metadata.leader"
                :label="$t('factions.leader')"
                variant="outlined"
                :placeholder="$t('factions.leaderPlaceholder')"
              />
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="factionForm.metadata.alignment"
                :label="$t('factions.alignment')"
                variant="outlined"
                :placeholder="$t('factions.alignmentPlaceholder')"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="factionForm.metadata.headquarters"
                :label="$t('factions.headquarters')"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-textarea
            v-model="factionForm.metadata.goals"
            :label="$t('factions.goals')"
            :placeholder="$t('factions.goalsPlaceholder')"
            variant="outlined"
            rows="3"
            class="mb-4"
          />

          <v-textarea
            v-model="factionForm.metadata.notes"
            :label="$t('factions.notes')"
            variant="outlined"
            rows="3"
          />
            </v-tabs-window-item>

            <!-- Members Tab -->
            <v-tabs-window-item value="members">
              <div class="text-h6 mb-4">
                {{ $t('factions.membersList') }}
              </div>

              <v-progress-linear v-if="loadingMembers" indeterminate />

              <v-list v-else-if="factionMembers.length > 0">
                <v-list-item
                  v-for="member in factionMembers"
                  :key="member.id"
                  class="mb-2"
                  border
                >
                  <template #prepend>
                    <v-icon icon="mdi-account" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ member.npc_name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" class="mr-1">
                      {{ member.relation_type }}
                    </v-chip>
                    <span v-if="member.notes?.rank" class="text-caption">
                      {{ $t('factions.rank') }}: {{ member.notes.rank }}
                    </span>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeMember(member.id)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-account-group-outline"
                :title="$t('factions.noMembers')"
                :text="$t('factions.noMembersText')"
              />

              <v-divider class="my-4" />

              <div class="text-h6 mb-4">
                {{ $t('factions.addMember') }}
              </div>

              <v-select
                v-model="newMember.npcId"
                :items="npcs || []"
                item-title="name"
                item-value="id"
                :label="$t('factions.selectNpc')"
                variant="outlined"
                class="mb-3"
              />

              <v-combobox
                v-model="newMember.membershipType"
                :items="membershipTypeSuggestions"
                :label="$t('factions.membershipType')"
                :placeholder="$t('factions.membershipTypePlaceholder')"
                variant="outlined"
                class="mb-3"
              />

              <v-text-field
                v-model="newMember.rank"
                :label="$t('factions.rank')"
                :placeholder="$t('factions.rankPlaceholder')"
                variant="outlined"
                class="mb-3"
              />

              <v-btn
                color="primary"
                prepend-icon="mdi-account-plus"
                :disabled="!newMember.npcId || !newMember.membershipType"
                :loading="addingMember"
                @click="addNpcMember"
              >
                {{ $t('factions.addMember') }}
              </v-btn>
            </v-tabs-window-item>

            <!-- Locations Tab -->
            <v-tabs-window-item value="locations">
              <div class="text-h6 mb-4">
                {{ $t('factions.locationsList') }}
              </div>

              <v-progress-linear v-if="loadingLocations" indeterminate />

              <v-list v-else-if="factionLocations.length > 0">
                <v-list-item
                  v-for="location in factionLocations"
                  :key="location.id"
                  class="mb-2"
                  border
                >
                  <template #prepend>
                    <v-icon icon="mdi-map-marker" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ location.location_name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" class="mr-1">
                      {{ location.relation_type }}
                    </v-chip>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeLocation(location.id)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-map-marker-outline"
                :title="$t('factions.noLocations')"
                :text="$t('factions.noLocationsText')"
              />

              <v-divider class="my-4" />

              <div class="text-h6 mb-4">
                {{ $t('factions.addLocation') }}
              </div>

              <v-select
                v-model="newLocation.locationId"
                :items="locations || []"
                item-title="name"
                item-value="id"
                :label="$t('factions.selectLocation')"
                variant="outlined"
                class="mb-3"
              />

              <v-combobox
                v-model="newLocation.relationType"
                :items="locationRelationTypeSuggestions"
                :label="$t('factions.locationType')"
                :placeholder="$t('factions.locationTypePlaceholder')"
                variant="outlined"
                class="mb-3"
              />

              <v-btn
                color="primary"
                prepend-icon="mdi-link"
                :disabled="!newLocation.locationId || !newLocation.relationType"
                :loading="addingLocation"
                @click="addLocationLink"
              >
                {{ $t('factions.addLocation') }}
              </v-btn>
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Form when creating (no tabs) -->
          <template v-if="!editingFaction">
            <v-text-field
              v-model="factionForm.name"
              :label="$t('factions.name')"
              :rules="[v => !!v || $t('factions.nameRequired')]"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="factionForm.description"
              :label="$t('factions.description')"
              variant="outlined"
              rows="4"
              class="mb-4"
            />

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="factionForm.metadata.type"
                  :label="$t('factions.type')"
                  variant="outlined"
                  :placeholder="$t('factions.typePlaceholder')"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="factionForm.metadata.leader"
                  :label="$t('factions.leader')"
                  variant="outlined"
                  :placeholder="$t('factions.leaderPlaceholder')"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="factionForm.metadata.alignment"
                  :label="$t('factions.alignment')"
                  variant="outlined"
                  :placeholder="$t('factions.alignmentPlaceholder')"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="factionForm.metadata.headquarters"
                  :label="$t('factions.headquarters')"
                  variant="outlined"
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="factionForm.metadata.goals"
              :label="$t('factions.goals')"
              :placeholder="$t('factions.goalsPlaceholder')"
              variant="outlined"
              rows="3"
              class="mb-4"
            />

            <v-textarea
              v-model="factionForm.metadata.notes"
              :label="$t('factions.notes')"
              variant="outlined"
              rows="3"
            />
          </template>
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
            :disabled="!factionForm.name"
            :loading="saving"
            @click="saveFaction"
          >
            {{ editingFaction ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('factions.deleteTitle')"
      :message="$t('factions.deleteConfirm', { name: deletingFaction?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
interface Faction {
  id: number
  name: string
  description: string | null
  image_url: string | null
  metadata: {
    type?: string
    leader?: string
    alignment?: string
    headquarters?: string
    goals?: string
    notes?: string
  } | null
  created_at: string
  updated_at: string
}

const router = useRouter()

// Use image download composable
const { downloadImage } = useImageDownload()

// Auto-imported stores
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()

// Get active campaign
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Check if campaign is selected
onMounted(async () => {
  if (!activeCampaignId.value) {
    router.push('/campaigns')
    return
  }

  // Load entities for this campaign
  await Promise.all([
    entitiesStore.fetchFactions(activeCampaignId.value),
    entitiesStore.fetchLocations(activeCampaignId.value),
    entitiesStore.fetchNPCs(activeCampaignId.value),
  ])
})

// Get factions from store
const factions = computed(() => entitiesStore.factions)
const pending = computed(() => entitiesStore.factionsLoading)

// Search
const searchQuery = ref('')
const filteredFactions = computed(() => {
  if (!factions.value)
    return []

  if (!searchQuery.value)
    return factions.value

  const query = searchQuery.value.toLowerCase()
  return factions.value.filter(faction =>
    faction.name.toLowerCase().includes(query)
    || faction.description?.toLowerCase().includes(query)
    || faction.metadata?.type?.toLowerCase().includes(query)
    || faction.metadata?.leader?.toLowerCase().includes(query)
    || faction.metadata?.alignment?.toLowerCase().includes(query),
  )
})

// Form state
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const editingFaction = ref<Faction | null>(null)
const deletingFaction = ref<Faction | null>(null)
const saving = ref(false)
const deleting = ref(false)
const factionDialogTab = ref('details')

// Members state
interface FactionMember {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  npc_name: string
}

const factionMembers = ref<FactionMember[]>([])
const loadingMembers = ref(false)

const newMember = ref({
  npcId: null as number | null,
  membershipType: '',
  rank: '',
})
const addingMember = ref(false)

// Locations state
interface FactionLocation {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  location_name: string
}

const factionLocations = ref<FactionLocation[]>([])
const loadingLocations = ref(false)

const newLocation = ref({
  locationId: null as number | null,
  relationType: '',
})
const addingLocation = ref(false)

// Get locations and NPCs from store
const locations = computed(() => entitiesStore.locationsForSelect)
const npcs = computed(() => entitiesStore.npcsForSelect)

const { t } = useI18n()
const locationRelationTypeSuggestions = computed(() => [
  t('factions.locationTypes.headquarters'),
  t('factions.locationTypes.hideout'),
  t('factions.locationTypes.meetingPlace'),
  t('factions.locationTypes.territory'),
  t('factions.locationTypes.safehouse'),
  t('factions.locationTypes.baseOfOperations'),
])

const membershipTypeSuggestions = computed(() => [
  t('factions.membershipTypes.member'),
  t('factions.membershipTypes.leader'),
  t('factions.membershipTypes.founder'),
  t('factions.membershipTypes.officer'),
  t('factions.membershipTypes.recruit'),
  t('factions.membershipTypes.veteran'),
  t('factions.membershipTypes.exile'),
])

const factionForm = ref({
  name: '',
  description: '',
  metadata: {
    type: '',
    leader: '',
    alignment: '',
    headquarters: '',
    goals: '',
    notes: '',
  },
})

// Utility functions
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength)
    return text
  return `${text.substring(0, maxLength)}...`
}

async function editFaction(faction: Faction) {
  editingFaction.value = faction
  factionForm.value = {
    name: faction.name,
    description: faction.description || '',
    metadata: {
      type: faction.metadata?.type || '',
      leader: faction.metadata?.leader || '',
      alignment: faction.metadata?.alignment || '',
      headquarters: faction.metadata?.headquarters || '',
      goals: faction.metadata?.goals || '',
      notes: faction.metadata?.notes || '',
    },
  }
  showCreateDialog.value = true
  factionDialogTab.value = 'details'

  // Load faction members and locations
  await loadFactionMembers()
  await loadFactionLocations()
}

function deleteFaction(faction: Faction) {
  deletingFaction.value = faction
  showDeleteDialog.value = true
}

async function saveFaction() {
  if (!factionForm.value.name || !activeCampaignId.value)
    return

  saving.value = true

  try {
    if (editingFaction.value) {
      // Update existing faction via store
      await entitiesStore.updateFaction(editingFaction.value.id, {
        name: factionForm.value.name,
        description: factionForm.value.description || null,
        metadata: factionForm.value.metadata,
      })
    }
    else {
      // Create new faction via store
      await entitiesStore.createFaction(activeCampaignId.value, {
        name: factionForm.value.name,
        description: factionForm.value.description || null,
        metadata: factionForm.value.metadata,
      })
    }

    closeDialog()
  }
  catch (error) {
    console.error('Failed to save faction:', error)
  }
  finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingFaction.value)
    return

  deleting.value = true

  try {
    await entitiesStore.deleteFaction(deletingFaction.value.id)
    showDeleteDialog.value = false
    deletingFaction.value = null
  }
  catch (error) {
    console.error('Failed to delete faction:', error)
  }
  finally {
    deleting.value = false
  }
}

async function loadFactionMembers() {
  if (!editingFaction.value)
    return

  loadingMembers.value = true

  try {
    const members = await $fetch<FactionMember[]>(`/api/factions/${editingFaction.value.id}/members`)
    factionMembers.value = members
  }
  catch (error) {
    console.error('Failed to load faction members:', error)
    factionMembers.value = []
  }
  finally {
    loadingMembers.value = false
  }
}

async function addNpcMember() {
  if (!editingFaction.value || !newMember.value.npcId || !newMember.value.membershipType)
    return

  addingMember.value = true

  try {
    await $fetch(`/api/factions/${editingFaction.value.id}/members`, {
      method: 'POST',
      body: {
        npcId: newMember.value.npcId,
        membershipType: newMember.value.membershipType,
        rank: newMember.value.rank || undefined,
      },
    })
    await loadFactionMembers()
    newMember.value = { npcId: null, membershipType: '', rank: '' }
  }
  catch (error) {
    console.error('Failed to add NPC member:', error)
  }
  finally {
    addingMember.value = false
  }
}

async function removeMember(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, { method: 'DELETE' })
    await loadFactionMembers()
  }
  catch (error) {
    console.error('Failed to remove member:', error)
  }
}

async function loadFactionLocations() {
  if (!editingFaction.value)
    return

  loadingLocations.value = true

  try {
    const locations = await $fetch<FactionLocation[]>(`/api/factions/${editingFaction.value.id}/locations`)
    factionLocations.value = locations
  }
  catch (error) {
    console.error('Failed to load faction locations:', error)
    factionLocations.value = []
  }
  finally {
    loadingLocations.value = false
  }
}

async function addLocationLink() {
  if (!editingFaction.value || !newLocation.value.locationId || !newLocation.value.relationType)
    return

  addingLocation.value = true

  try {
    await $fetch(`/api/factions/${editingFaction.value.id}/locations`, {
      method: 'POST',
      body: {
        locationId: newLocation.value.locationId,
        relationType: newLocation.value.relationType,
      },
    })
    await loadFactionLocations()
    newLocation.value = { locationId: null, relationType: '' }
  }
  catch (error) {
    console.error('Failed to add location link:', error)
  }
  finally {
    addingLocation.value = false
  }
}

async function removeLocation(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, { method: 'DELETE' })
    await loadFactionLocations()
  }
  catch (error) {
    console.error('Failed to remove location:', error)
  }
}

// Image upload state
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)

// Trigger file input click
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// Handle image upload from native input
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length || !editingFaction.value)
    return

  const file = target.files[0]
  uploadingImage.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ success: boolean, imageUrl: string }>(`/api/entities/${editingFaction.value.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    if (response.success) {
      // Update the editing faction with new image URL
      editingFaction.value.image_url = response.imageUrl

      // Update the faction in the store list directly
      const factionInList = entitiesStore.factions?.find(f => f.id === editingFaction.value!.id)
      if (factionInList) {
        factionInList.image_url = response.imageUrl
      }

      // Clear file input
      target.value = ''
    }
  }
  catch (error) {
    console.error('Failed to upload image:', error)
    alert(t('factions.uploadImageError'))
  }
  finally {
    uploadingImage.value = false
  }
}

// Delete image function
async function deleteImage() {
  if (!editingFaction.value?.image_url)
    return

  deletingImage.value = true

  try {
    await $fetch(`/api/entities/${editingFaction.value.id}/delete-image`, {
      method: 'DELETE',
    })

    // Update the editing faction
    editingFaction.value.image_url = null

    // Update the faction in the store list directly
    const factionInList = entitiesStore.factions?.find(f => f.id === editingFaction.value!.id)
    if (factionInList) {
      factionInList.image_url = null
    }
  }
  catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('factions.deleteImageError'))
  }
  finally {
    deletingImage.value = false
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingFaction.value = null
  factionMembers.value = []
  factionLocations.value = []
  newMember.value = { npcId: null, membershipType: '', rank: '' }
  newLocation.value = { locationId: null, relationType: '' }
  factionDialogTab.value = 'details'
  factionForm.value = {
    name: '',
    description: '',
    metadata: {
      type: '',
      leader: '',
      alignment: '',
      headquarters: '',
      goals: '',
      notes: '',
    },
  }
}
</script>

<style scoped>
.image-download-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  opacity: 0.5;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.image-container:hover .image-download-btn {
  opacity: 1;
  transform: scale(1.1);
}
</style>
