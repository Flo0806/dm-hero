<template>
  <v-container>
    <UiPageHeader :title="$t('factions.title')" :subtitle="$t('factions.subtitle')">
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
    </UiPageHeader>

    <!-- Search Bar -->
    <v-text-field
      v-model="searchQuery"
      :placeholder="$t('common.search')"
      prepend-inner-icon="mdi-magnify"
      :loading="searching"
      variant="outlined"
      clearable
      class="mb-4"
    />

    <v-row v-if="pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Faction Cards with Search Overlay -->
    <div v-else-if="filteredFactions && filteredFactions.length > 0" class="position-relative">
      <!-- Search Loading Overlay -->
      <v-overlay
        :model-value="searching"
        contained
        persistent
        class="align-center justify-center"
        scrim="surface"
        opacity="0.8"
      >
        <div class="text-center">
          <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
          <div class="text-h6">
            {{ $t('common.searching') }}
          </div>
        </div>
      </v-overlay>

      <!-- Faction Cards -->
      <v-row>
        <v-col v-for="faction in filteredFactions" :key="faction.id" cols="12" md="6" lg="4">
          <FactionCard
            :faction="faction"
            :is-highlighted="highlightedId === faction.id"
            @view="viewFaction"
            @edit="editFaction"
            @download="(faction) => downloadImage(`/uploads/${faction.image_url}`, faction.name)"
            @delete="deleteFaction"
          />
        </v-col>
      </v-row>
    </div>

    <ClientOnly v-else>
      <v-empty-state
        icon="mdi-shield-account-outline"
        :title="$t('factions.empty')"
        :text="$t('factions.emptyText')"
      >
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('factions.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-shield-account-outline" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('factions.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('factions.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('factions.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- Create/Edit Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="800"
      :persistent="saving || uploadingImage || generatingImage"
    >
      <v-card>
        <v-card-title>
          {{ editingFaction ? $t('factions.edit') : $t('factions.create') }}
        </v-card-title>

        <v-tabs v-if="editingFaction" v-model="factionDialogTab" class="mb-4">
          <v-tab value="details">
            <v-icon start> mdi-shield-account </v-icon>
            {{ $t('factions.details') }}
          </v-tab>
          <v-tab value="members">
            <v-icon start> mdi-account-group </v-icon>
            {{ $t('factions.members') }} ({{ factionMembers.length }})
          </v-tab>
          <v-tab value="locations">
            <v-icon start> mdi-map-marker </v-icon>
            {{ $t('factions.locations') }} ({{ factionLocations.length }})
          </v-tab>
          <v-tab value="lore">
            <v-icon start> mdi-book-open-variant </v-icon>
            {{ $t('lore.title') }} ({{ linkedLore.length }})
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 600px; overflow-y: auto">
          <v-tabs-window v-if="editingFaction" v-model="factionDialogTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
              <!-- Image Upload Section -->
              <v-card variant="outlined" class="mb-4">
                <v-card-text>
                  <div class="d-flex align-start gap-4">
                    <!-- Image Preview -->
                    <div style="position: relative">
                      <v-avatar
                        size="160"
                        rounded="lg"
                        :color="editingFaction?.image_url ? undefined : 'grey-lighten-2'"
                        :style="editingFaction?.image_url ? 'cursor: pointer;' : ''"
                        @click="
                          editingFaction?.image_url
                            ? openImagePreview(
                                `/uploads/${editingFaction.image_url}`,
                                factionForm.name,
                              )
                            : null
                        "
                      >
                        <v-img
                          v-if="editingFaction?.image_url"
                          :src="`/uploads/${editingFaction.image_url}`"
                          cover
                          :class="{ 'blur-image': uploadingImage || generatingImage }"
                        />
                        <v-icon
                          v-else-if="!uploadingImage && !generatingImage"
                          icon="mdi-shield-account"
                          size="80"
                          color="grey"
                        />
                      </v-avatar>
                      <v-progress-circular
                        v-if="uploadingImage || generatingImage"
                        indeterminate
                        color="primary"
                        size="64"
                        width="6"
                        style="
                          position: absolute;
                          top: 50%;
                          left: 50%;
                          transform: translate(-50%, -50%);
                        "
                      />
                    </div>

                    <!-- Image Actions -->
                    <div class="flex-grow-1" style="max-width: 280px; margin-left: 16px">
                      <!-- Upload Button -->
                      <v-btn
                        prepend-icon="mdi-camera"
                        color="primary"
                        variant="tonal"
                        block
                        class="mb-2"
                        :disabled="uploadingImage || deletingImage || generatingImage"
                        @click="triggerImageUpload"
                      >
                        {{
                          editingFaction?.image_url
                            ? $t('factions.changeImage')
                            : $t('factions.uploadImage')
                        }}
                      </v-btn>
                      <input
                        ref="fileInputRef"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        style="display: none"
                        @change="handleImageUpload"
                      />

                      <!-- AI Generate Button -->
                      <v-btn
                        prepend-icon="mdi-creation"
                        color="primary"
                        variant="tonal"
                        block
                        class="mb-2"
                        :loading="generatingImage"
                        :disabled="generateButtonDisabled"
                        @click="generateImage"
                      >
                        {{ $t('factions.generateImage') }}
                      </v-btn>

                      <!-- Download Button (only if image exists) -->
                      <v-btn
                        v-if="editingFaction?.image_url"
                        prepend-icon="mdi-download"
                        variant="outlined"
                        block
                        class="mb-2"
                        :disabled="uploadingImage || generatingImage"
                        @click="
                          downloadImage(`/uploads/${editingFaction.image_url}`, factionForm.name)
                        "
                      >
                        Download
                      </v-btn>

                      <!-- Delete Button (only if image exists) -->
                      <v-btn
                        v-if="editingFaction?.image_url"
                        prepend-icon="mdi-delete"
                        color="error"
                        variant="outlined"
                        block
                        :loading="deletingImage"
                        :disabled="uploadingImage || generatingImage"
                        @click="deleteImage"
                      >
                        {{ $t('factions.deleteImage') }}
                      </v-btn>

                      <!-- AI Hint -->
                      <div v-if="!hasApiKey" class="text-caption text-medium-emphasis mt-3">
                        <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
                        KI-Generierung: OpenAI API-Key in Einstellungen hinterlegen
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>

              <v-text-field
                v-model="factionForm.name"
                :label="$t('factions.name')"
                :rules="[(v) => !!v || $t('factions.nameRequired')]"
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
                  <v-select
                    v-model="factionForm.leaderId"
                    :items="npcs || []"
                    item-title="name"
                    item-value="id"
                    :label="$t('factions.leader')"
                    variant="outlined"
                    clearable
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
                <v-list-item v-for="member in factionMembers" :key="member.id" class="mb-2" border>
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

            <!-- Lore Tab -->
            <v-tabs-window-item value="lore">
              <div class="text-h6 mb-4">
                {{ $t('factions.linkedLore') }}
              </div>

              <v-list v-if="linkedLore.length > 0">
                <v-list-item v-for="lore in linkedLore" :key="lore.id" class="mb-2" border>
                  <template #prepend>
                    <v-avatar v-if="lore.image_url" size="40" rounded="lg">
                      <v-img :src="`/uploads/${lore.image_url}`" />
                    </v-avatar>
                    <v-icon v-else icon="mdi-book-open-variant" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ lore.name }}
                  </v-list-item-title>
                  <v-list-item-subtitle v-if="lore.description">
                    {{ lore.description.substring(0, 100) }}{{ lore.description.length > 100 ? '...' : '' }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeLoreRelation(lore.id)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-book-off"
                :title="$t('factions.noLinkedLore')"
                :text="$t('factions.noLinkedLoreText')"
              />

              <v-divider class="my-4" />

              <div class="text-h6 mb-4">
                {{ $t('factions.addLore') }}
              </div>

              <v-autocomplete
                v-model="selectedLoreToLink"
                :items="loreForSelect"
                item-title="name"
                item-value="id"
                :label="$t('factions.selectLore')"
                :placeholder="$t('factions.selectLorePlaceholder')"
                variant="outlined"
                clearable
                class="mb-2"
              />

              <v-btn
                color="primary"
                block
                :disabled="!selectedLoreToLink"
                @click="addLoreRelation"
              >
                {{ $t('factions.linkLore') }}
              </v-btn>
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Form when creating (no tabs) -->
          <template v-if="!editingFaction">
            <v-text-field
              v-model="factionForm.name"
              :label="$t('factions.name')"
              :rules="[(v) => !!v || $t('factions.nameRequired')]"
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
                <v-select
                  v-model="factionForm.leaderId"
                  :items="npcs || []"
                  item-title="name"
                  item-value="id"
                  :label="$t('factions.leader')"
                  variant="outlined"
                  clearable
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
            :disabled="saving || uploadingImage || generatingImage"
            @click="closeDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!factionForm.name || uploadingImage || generatingImage"
            :loading="saving"
            @click="saveFaction"
          >
            {{ editingFaction ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('factions.deleteTitle')"
      :message="$t('factions.deleteConfirm', { name: deletingFaction?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Image Preview Dialog -->
    <ImagePreviewDialog
      v-model="showImagePreview"
      :image-url="previewImageUrl"
      :title="previewImageTitle"
      :download-file-name="previewImageTitle"
    />
  </v-container>
</template>

<script setup lang="ts">
import EntityDocuments from '~/components/shared/EntityDocuments.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import FactionCard from '~/components/factions/FactionCard.vue'

interface Faction {
  id: number
  name: string
  description: string | null
  image_url?: string | null
  metadata: {
    type?: string
    alignment?: string
    headquarters?: string
    goals?: string
    notes?: string
  } | null
  leader_id?: number | null
  leader_name?: string | null
  created_at: string
  updated_at: string
}

// Search state (must be declared early for template)
const searchQuery = ref('')
const searchResults = ref<Faction[]>([])
const searching = ref(false)

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()

// Use image download composable
const { downloadImage } = useImageDownload()

// Auto-imported stores
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()

// Get active campaign
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Highlighted faction (from global search)
const highlightedId = ref<number | null>(null)
const isFromGlobalSearch = ref(false)

// Initialize from query params (global search)
function initializeFromQuery() {
  const highlightParam = route.query.highlight
  const searchParam = route.query.search

  if (highlightParam && searchParam) {
    highlightedId.value = Number(highlightParam)
    searchQuery.value = String(searchParam)
    isFromGlobalSearch.value = true

    // Scroll to highlighted faction after a short delay
    nextTick(() => {
      setTimeout(() => {
        const element = document.getElementById(`faction-${highlightedId.value}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    })
  }
}

const { loadFactionCountsBatch, reloadFactionCounts } = useFactionCounts()

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
    entitiesStore.fetchLore(activeCampaignId.value),
  ])

  // Load counts for all factions in background (non-blocking)
  if (factions.value && factions.value.length > 0) {
    loadFactionCountsBatch(factions.value)
  }

  // Check API key
  try {
    const response = await $fetch<{ hasKey: boolean }>('/api/settings/check-api-key')
    hasApiKey.value = response.hasKey
  } catch {
    hasApiKey.value = false
  }

  // Initialize from query params
  initializeFromQuery()
})

// Watch for route changes (same-page navigation)
watch(
  () => route.query,
  () => {
    highlightedId.value = null
    isFromGlobalSearch.value = false
    // Re-initialize from new query
    initializeFromQuery()
  },
  { deep: true },
)

// Clear highlight when user manually searches
watch(searchQuery, () => {
  if (isFromGlobalSearch.value) {
    // First change after global search, keep highlight
    isFromGlobalSearch.value = false
  } else {
    // Manual search by user, clear highlight
    highlightedId.value = null
    // Remove query params from URL
    if (route.query.highlight || route.query.search) {
      router.replace({ query: {} })
    }
  }
})

// Get factions from store
const factions = computed(() => entitiesStore.factions)
const pending = computed(() => entitiesStore.factionsLoading)

// Debounce search with abort controller
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

// Search execution function
async function executeSearch(query: string) {
  if (!activeCampaignId.value) return

  // Abort previous search if still running
  if (abortController) {
    abortController.abort()
  }

  // Create new abort controller for this search
  abortController = new AbortController()

  searching.value = true
  try {
    const results = await $fetch<Faction[]>('/api/factions', {
      query: {
        campaignId: activeCampaignId.value,
        search: query.trim(),
      },
      headers: {
        'Accept-Language': locale.value,
      },
      signal: abortController.signal,
    })
    searchResults.value = results
  } catch (error: unknown) {
    // Ignore abort errors
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return
    }
    console.error('Faction search failed:', error)
    searchResults.value = []
  } finally {
    searching.value = false
    abortController = null
  }
}

// Watch search query with debounce
watch(searchQuery, async (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  // Abort any running search immediately
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  if (!query || query.trim().length === 0) {
    searchResults.value = []
    searching.value = false
    return
  }

  // Show loading state immediately
  searching.value = true

  // Debounce search by 300ms
  searchTimeout = setTimeout(() => executeSearch(query), 300)
})

// Show search results OR cached factions
const filteredFactions = computed(() => {
  // If user is typing but search hasn't returned yet, show cached factions
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    if (searching.value && searchResults.value.length === 0) {
      return factions.value || []
    }
    return searchResults.value
  }
  return factions.value || []
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

// Lore state
const linkedLore = ref<Array<{ id: number; name: string; description: string | null; image_url: string | null }>>([])
const selectedLoreToLink = ref<number | null>(null)

// Get locations, NPCs, and Lore from store
const locations = computed(() => entitiesStore.locationsForSelect)
const npcs = computed(() => entitiesStore.npcsForSelect)
const loreForSelect = computed(() => {
  return (entitiesStore.lore || []).map((lore) => ({
    id: lore.id,
    name: lore.name,
  }))
})

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
  leaderId: null as number | null,
  metadata: {
    type: '',
    alignment: '',
    headquarters: '',
    goals: '',
    notes: '',
  },
})

// View Faction (currently just opens edit - can be extended to view-only dialog later)
function viewFaction(faction: Faction) {
  editFaction(faction)
}

async function editFaction(faction: Faction) {
  editingFaction.value = faction
  factionForm.value = {
    name: faction.name,
    description: faction.description || '',
    leaderId: faction.leader_id || null,
    metadata: {
      type: faction.metadata?.type || '',
      alignment: faction.metadata?.alignment || '',
      headquarters: faction.metadata?.headquarters || '',
      goals: faction.metadata?.goals || '',
      notes: faction.metadata?.notes || '',
    },
  }
  showCreateDialog.value = true
  factionDialogTab.value = 'details'

  // Load faction members, locations, and lore
  await loadFactionMembers()
  await loadFactionLocations()
  await loadLinkedLore()
}

function deleteFaction(faction: Faction) {
  deletingFaction.value = faction
  showDeleteDialog.value = true
}

async function saveFaction() {
  if (!factionForm.value.name || !activeCampaignId.value) return

  saving.value = true

  try {
    let factionId: number

    if (editingFaction.value) {
      // Update existing faction via store
      await entitiesStore.updateFaction(editingFaction.value.id, {
        name: factionForm.value.name,
        description: factionForm.value.description || null,
        metadata: factionForm.value.metadata,
      })
      factionId = editingFaction.value.id
    } else {
      // Create new faction via store
      const newFaction = await entitiesStore.createFaction(activeCampaignId.value, {
        name: factionForm.value.name,
        description: factionForm.value.description || null,
        metadata: factionForm.value.metadata,
      })
      factionId = newFaction.id
    }

    // Manage leader relation
    // Step 1: Delete old "Anführer" relation if exists
    if (editingFaction.value && editingFaction.value.leader_id) {
      try {
        // Find and delete the old leader relation
        const members = await $fetch<FactionMember[]>(`/api/factions/${factionId}/members`)
        const leaderRelation = members.find((m) => m.relation_type === 'Anführer')
        if (leaderRelation) {
          await $fetch(`/api/relations/${leaderRelation.id}`, { method: 'DELETE' })
        }
      } catch (error) {
        console.error('Failed to delete old leader relation:', error)
      }
    }

    // Step 2: Create new "Anführer" relation if leaderId is set
    if (factionForm.value.leaderId) {
      try {
        await $fetch(`/api/factions/${factionId}/members`, {
          method: 'POST',
          body: {
            npcId: factionForm.value.leaderId,
            membershipType: 'Anführer',
          },
        })
      } catch (error) {
        console.error('Failed to create leader relation:', error)
      }
    }

    // If user is searching, re-execute search to update FTS5 results
    if (searchQuery.value && searchQuery.value.trim().length > 0) {
      await executeSearch(searchQuery.value)
    }

    // Reload counts for the saved Faction (get from store, not API response)
    const factionFromStore = entitiesStore.factions.find((f) => f.id === factionId)
    if (factionFromStore) {
      await reloadFactionCounts(factionFromStore)
    }

    closeDialog()
  } catch (error) {
    console.error('Failed to save faction:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingFaction.value) return

  deleting.value = true

  try {
    await entitiesStore.deleteFaction(deletingFaction.value.id)
    showDeleteDialog.value = false
    deletingFaction.value = null
  } catch (error) {
    console.error('Failed to delete faction:', error)
  } finally {
    deleting.value = false
  }
}

async function loadFactionMembers() {
  if (!editingFaction.value) return

  loadingMembers.value = true

  try {
    const members = await $fetch<FactionMember[]>(
      `/api/factions/${editingFaction.value.id}/members`,
    )
    factionMembers.value = members
  } catch (error) {
    console.error('Failed to load faction members:', error)
    factionMembers.value = []
  } finally {
    loadingMembers.value = false
  }
}

async function addNpcMember() {
  if (!editingFaction.value || !newMember.value.npcId || !newMember.value.membershipType) return

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
  } catch (error) {
    console.error('Failed to add NPC member:', error)
  } finally {
    addingMember.value = false
  }
}

async function removeMember(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, { method: 'DELETE' })
    await loadFactionMembers()
  } catch (error) {
    console.error('Failed to remove member:', error)
  }
}

async function loadFactionLocations() {
  if (!editingFaction.value) return

  loadingLocations.value = true

  try {
    const locations = await $fetch<FactionLocation[]>(
      `/api/factions/${editingFaction.value.id}/locations`,
    )
    factionLocations.value = locations
  } catch (error) {
    console.error('Failed to load faction locations:', error)
    factionLocations.value = []
  } finally {
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
  } catch (error) {
    console.error('Failed to add location link:', error)
  } finally {
    addingLocation.value = false
  }
}

async function removeLocation(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, { method: 'DELETE' })
    await loadFactionLocations()
  } catch (error) {
    console.error('Failed to remove location:', error)
  }
}

// Lore functions
async function loadLinkedLore() {
  if (!editingFaction.value) return
  try {
    const lore = await $fetch<
      Array<{ id: number; name: string; description: string | null; image_url: string | null }>
    >(`/api/factions/${editingFaction.value.id}/lore`)
    linkedLore.value = lore
  } catch (error) {
    console.error('Failed to load linked Lore:', error)
  }
}

async function addLoreRelation() {
  if (!editingFaction.value || !selectedLoreToLink.value) return
  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: selectedLoreToLink.value,
        toEntityId: editingFaction.value.id,
        relationType: 'bezieht sich auf',
        relationNotes: null,
      },
    })
    await loadLinkedLore()
    selectedLoreToLink.value = null
  } catch (error) {
    console.error('Failed to add Lore relation:', error)
  }
}

async function removeLoreRelation(loreId: number) {
  if (!editingFaction.value) return
  try {
    const relation = await $fetch<{ id: number } | null>('/api/entity-relations/find', {
      query: {
        fromEntityId: loreId,
        toEntityId: editingFaction.value.id,
      },
    })
    if (relation) {
      await $fetch(`/api/entity-relations/${relation.id}`, {
        method: 'DELETE',
      })
      await loadLinkedLore()
    }
  } catch (error) {
    console.error('Failed to remove Lore relation:', error)
  }
}

// Generate button disabled state
const generateButtonDisabled = computed(() => {
  const isDisabled =
    uploadingImage.value || deletingImage.value || !factionForm.value.name || !hasApiKey.value
  return isDisabled
})

// Image upload state
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)
const generatingImage = ref(false)
const hasApiKey = ref(false)

// Image preview state
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// Image preview function
function openImagePreview(imageUrl: string, title: string) {
  previewImageUrl.value = imageUrl
  previewImageTitle.value = title
  showImagePreview.value = true
}

// Trigger file input click
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// AI Generate Image function
async function generateImage() {
  if (!editingFaction.value || !factionForm.value.name) return

  generatingImage.value = true

  try {
    const details = []

    // Type (guild, government, criminal, religious, etc.)
    if (factionForm.value.metadata.type) {
      details.push(factionForm.value.metadata.type)
    }

    // Name (required)
    details.push(factionForm.value.name)

    // Description (free-form details)
    if (factionForm.value.description) {
      details.push(factionForm.value.description)
    }

    // Goals (what the faction wants)
    if (factionForm.value.metadata.goals) {
      details.push(factionForm.value.metadata.goals)
    }

    // Alignment (lawful, chaotic, neutral, etc.)
    if (factionForm.value.metadata.alignment) {
      details.push(factionForm.value.metadata.alignment)
    }

    // Notes (additional context)
    if (factionForm.value.metadata.notes) {
      details.push(factionForm.value.metadata.notes)
    }

    const prompt = details.filter((d) => d).join(', ')

    const result = await $fetch<{ imageUrl: string; revisedPrompt?: string }>(
      '/api/ai/generate-image',
      {
        method: 'POST',
        body: {
          prompt,
          entityName: factionForm.value.name,
          entityType: 'Faction',
          style: 'fantasy-art',
        },
      },
    )

    if (result.imageUrl && editingFaction.value) {
      // Add the generated image directly to the entity (no re-upload needed)
      const filename = result.imageUrl.replace('/uploads/', '')

      await $fetch(`/api/entities/${editingFaction.value.id}/add-generated-image`, {
        method: 'POST',
        body: {
          imageUrl: filename,
        },
      })

      // Update local state
      editingFaction.value.image_url = filename

      // Reload factions from server to get updated data
      if (activeCampaignId.value) {
        await entitiesStore.fetchFactions(activeCampaignId.value)
      }
    }
  } catch (error: unknown) {
    console.error('[Faction] Failed to generate image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image'
    alert(errorMessage)
  } finally {
    generatingImage.value = false
  }
}

// Handle image upload from native input
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length || !editingFaction.value) return

  const file = target.files[0]
  if (!file) return
  uploadingImage.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ success: boolean; imageUrl: string }>(
      `/api/entities/${editingFaction.value.id}/upload-image`,
      {
        method: 'POST',
        body: formData,
      },
    )

    if (response.success) {
      // Update the editing faction with new image URL
      editingFaction.value.image_url = response.imageUrl

      // Update the faction in the store list directly
      const factionInList = entitiesStore.factions?.find((f) => f.id === editingFaction.value!.id)
      if (factionInList) {
        factionInList.image_url = response.imageUrl
      }

      // Clear file input
      target.value = ''
    }
  } catch (error) {
    console.error('Failed to upload image:', error)
    alert(t('factions.uploadImageError'))
  } finally {
    uploadingImage.value = false
  }
}

// Delete image function
async function deleteImage() {
  if (!editingFaction.value?.image_url) return

  deletingImage.value = true

  try {
    await $fetch(`/api/entities/${editingFaction.value.id}/delete-image`, {
      method: 'DELETE',
    })

    // Update the editing faction
    editingFaction.value.image_url = null

    // Update the faction in the store list directly
    const factionInList = entitiesStore.factions?.find((f) => f.id === editingFaction.value!.id)
    if (factionInList) {
      factionInList.image_url = null
    }
  } catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('factions.deleteImageError'))
  } finally {
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
    leaderId: null,
    metadata: {
      type: '',
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
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.image-container:hover .image-download-btn {
  opacity: 1;
  transform: scale(1.1);
}

/* Blur effect during image upload/generation */
.blur-image {
  filter: blur(8px);
  opacity: 0.6;
  transition:
    filter 0.3s ease,
    opacity 0.3s ease;
}

/* Highlight animation for factions from global search */
.highlighted-card {
  animation: highlight-pulse 2s ease-in-out;
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary)) !important;
}

@keyframes highlight-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgb(var(--v-theme-primary));
  }
  50% {
    box-shadow: 0 0 20px 5px rgb(var(--v-theme-primary));
  }
}
</style>
