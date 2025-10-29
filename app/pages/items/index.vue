<template>
  <v-container>
    <PageHeader
      :title="$t('items.title')"
      :subtitle="$t('items.subtitle')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('items.create') }}
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

    <v-row v-else-if="filteredItems && filteredItems.length > 0">
      <v-col
        v-for="item in filteredItems"
        :key="item.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card
          hover
          class="h-100 d-flex flex-column"
          @click="viewItem(item)"
        >
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-sword" class="mr-2" color="primary" />
            {{ item.name }}
            <v-chip
              v-if="item.metadata?.rarity"
              :color="getRarityColor(item.metadata.rarity)"
              size="small"
              class="ml-auto"
            >
              {{ $t(`items.rarities.${item.metadata.rarity}`) }}
            </v-chip>
          </v-card-title>
          <v-card-text class="flex-grow-1">
            <div
              v-if="item.image_url"
              class="float-right ml-3 mb-2 position-relative image-container"
              style="width: 80px; height: 80px;"
            >
              <v-img
                :src="`/pictures/${item.image_url}`"
                cover
                rounded="lg"
                style="width: 100%; height: 100%;"
              />
              <v-btn
                icon="mdi-download"
                size="x-small"
                variant="tonal"
                class="image-download-btn"
                @click.stop="downloadImage(`/pictures/${item.image_url}`, item.name)"
              />
            </div>
            <v-chip
              v-if="item.metadata?.type"
              size="small"
              class="mb-3"
              variant="tonal"
            >
              {{ $t(`items.types.${item.metadata.type}`) }}
            </v-chip>

            <div v-if="item.description" class="text-body-2 mb-3">
              {{ item.description }}
            </div>
            <div v-else class="text-body-2 text-disabled mb-3">
              {{ $t('items.noDescription') }}
            </div>

            <div v-if="item.metadata" class="text-caption">
              <div v-if="item.metadata.value">
                <strong>{{ $t('items.value') }}:</strong> {{ item.metadata.value }}
              </div>
              <div v-if="item.metadata.weight">
                <strong>{{ $t('items.weight') }}:</strong> {{ item.metadata.weight }}
              </div>
              <div v-if="item.metadata.attunement">
                <v-chip size="x-small" color="purple" class="mt-1">
                  {{ $t('items.requiresAttunement') }}
                </v-chip>
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              icon="mdi-pencil"
              variant="text"
              @click.stop="editItem(item)"
            />
            <v-spacer />
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              @click.stop="deleteItem(item)"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      icon="mdi-sword"
      :title="$t('items.empty')"
      :text="$t('items.emptyText')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          {{ $t('items.create') }}
        </v-btn>
      </template>
    </v-empty-state>

    <!-- View Item Dialog -->
    <v-dialog
      v-model="showViewDialog"
      max-width="1200"
      scrollable
    >
      <v-card v-if="viewingItem">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-sword" class="mr-2" color="primary" />
          {{ viewingItem.name }}
          <v-chip
            v-if="viewingItem.metadata?.rarity"
            :color="getRarityColor(viewingItem.metadata.rarity)"
            size="small"
            class="ml-2"
          >
            {{ $t(`items.rarities.${viewingItem.metadata.rarity}`) }}
          </v-chip>
        </v-card-title>

        <v-card-text style="max-height: 70vh;">
          <v-row>
            <!-- Image -->
            <v-col v-if="viewingItem.image_url" cols="12" md="4">
              <div class="position-relative image-container">
                <v-img
                  :src="`/pictures/${viewingItem.image_url}`"
                  aspect-ratio="1"
                  cover
                  rounded="lg"
                />
                <v-btn
                  icon="mdi-download"
                  size="small"
                  variant="tonal"
                  class="image-download-btn"
                  @click="downloadImage(`/pictures/${viewingItem.image_url}`, viewingItem.name)"
                />
              </div>
            </v-col>

            <!-- Content -->
            <v-col :cols="viewingItem.image_url ? 12 : 12" :md="viewingItem.image_url ? 8 : 12">
              <!-- Type & Attunement -->
              <div class="mb-4">
                <v-chip
                  v-if="viewingItem.metadata?.type"
                  size="small"
                  variant="tonal"
                  class="mr-2"
                >
                  {{ $t(`items.types.${viewingItem.metadata.type}`) }}
                </v-chip>
                <v-chip
                  v-if="viewingItem.metadata?.attunement"
                  size="small"
                  color="purple"
                >
                  {{ $t('items.requiresAttunement') }}
                </v-chip>
              </div>

              <!-- Description -->
              <div v-if="viewingItem.description" class="text-body-1 mb-4">
                {{ viewingItem.description }}
              </div>
              <div v-else class="text-body-2 text-disabled mb-4">
                {{ $t('items.noDescription') }}
              </div>

              <v-divider class="my-4" />

              <!-- Metadata -->
              <v-row dense>
                <v-col v-if="viewingItem.metadata?.value" cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">
                    {{ $t('items.value') }}
                  </div>
                  <div class="text-body-1">
                    {{ viewingItem.metadata.value }}
                  </div>
                </v-col>
                <v-col v-if="viewingItem.metadata?.weight" cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">
                    {{ $t('items.weight') }}
                  </div>
                  <div class="text-body-1">
                    {{ viewingItem.metadata.weight }}
                  </div>
                </v-col>
              </v-row>

              <!-- Documents -->
              <div v-if="viewingItem.id" class="mt-4">
                <v-divider class="mb-4" />
                <h3 class="text-h6 mb-2">
                  {{ $t('items.documents') }}
                </h3>
                <EntityDocuments :entity-id="viewingItem.id" />
              </div>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-btn
            variant="text"
            prepend-icon="mdi-pencil"
            @click="editItem(viewingItem); showViewDialog = false"
          >
            {{ $t('common.edit') }}
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="showViewDialog = false">
            {{ $t('common.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Create/Edit Item Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="1200"
      scrollable
    >
      <v-card>
        <v-card-title>
          {{ editingItem ? $t('items.edit') : $t('items.create') }}
        </v-card-title>

        <v-tabs v-if="editingItem" v-model="itemDialogTab" class="px-4">
          <v-tab value="details">
            <v-icon start>
              mdi-information
            </v-icon>
            {{ $t('items.details') }}
          </v-tab>
          <v-tab value="owners">
            <v-icon start>
              mdi-account
            </v-icon>
            {{ $t('items.owners') }}
          </v-tab>
          <v-tab value="locations">
            <v-icon start>
              mdi-map-marker
            </v-icon>
            {{ $t('items.locations') }}
          </v-tab>
          <v-tab value="documents">
            <v-icon start>
              mdi-file-document
            </v-icon>
            {{ $t('documents.title') }}
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 600px">
          <v-tabs-window v-if="editingItem" v-model="itemDialogTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
              <!-- Image Upload Section -->
              <v-card variant="outlined" class="mb-4">
                <v-card-text>
                  <div class="d-flex align-center gap-4">
                    <div style="position: relative;">
                      <v-avatar
                        size="120"
                        rounded="lg"
                        :color="editingItem?.image_url ? undefined : 'grey-lighten-2'"
                      >
                        <v-img
                          v-if="editingItem?.image_url && !uploadingImage"
                          :src="`/pictures/${editingItem.image_url}`"
                          cover
                        />
                        <v-icon v-else-if="!uploadingImage" icon="mdi-sword" size="64" color="grey" />
                      </v-avatar>
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
                            {{ editingItem?.image_url ? $t('items.changeImage') : $t('items.uploadImage') }}
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
                          v-if="editingItem?.image_url"
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
                            {{ $t('items.deleteImage') }}
                          </v-tooltip>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>

          <v-text-field
            v-model="itemForm.name"
            :label="$t('items.name')"
            :rules="[v => !!v || $t('items.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="itemForm.description"
            :label="$t('items.description')"
            variant="outlined"
            rows="3"
            class="mb-4"
          />

          <v-divider class="my-4" />

          <div class="text-h6 mb-4">
            {{ $t('items.metadata') }}
          </div>

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="itemForm.metadata.type"
                :items="ITEM_TYPES"
                :label="$t('items.type')"
                variant="outlined"
                clearable
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" :title="$t(`items.types.${item.value}`)" />
                </template>
                <template #selection="{ item }">
                  {{ $t(`items.types.${item.value}`) }}
                </template>
              </v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="itemForm.metadata.rarity"
                :items="ITEM_RARITIES"
                :label="$t('items.rarity')"
                variant="outlined"
                clearable
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props" :title="$t(`items.rarities.${item.value}`)" />
                </template>
                <template #selection="{ item }">
                  {{ $t(`items.rarities.${item.value}`) }}
                </template>
              </v-select>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="itemForm.metadata.value"
                :label="$t('items.value')"
                :placeholder="$t('items.valuePlaceholder')"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="itemForm.metadata.weight"
                :label="$t('items.weight')"
                :placeholder="$t('items.weightPlaceholder')"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <v-text-field
            v-model="itemForm.metadata.charges"
            :label="$t('items.charges')"
            :placeholder="$t('items.chargesPlaceholder')"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="itemForm.metadata.properties"
            :label="$t('items.properties')"
            :placeholder="$t('items.propertiesPlaceholder')"
            variant="outlined"
            rows="3"
            class="mb-4"
          />

          <v-switch
            v-model="itemForm.metadata.attunement"
            :label="$t('items.requiresAttunement')"
            color="primary"
            hide-details
          />
            </v-tabs-window-item>

            <!-- Owners Tab -->
            <v-tabs-window-item value="owners">
              <div class="text-h6 mb-4">
                {{ $t('items.ownersList') }}
              </div>

              <v-list v-if="itemOwners.length > 0" class="mb-3">
                <v-list-item
                  v-for="owner in itemOwners"
                  :key="owner.id"
                  class="mb-2"
                  border
                >
                  <template #prepend>
                    <v-icon icon="mdi-account" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ owner.npc_name }}
                    <v-chip
                      v-if="owner.notes?.equipped"
                      size="x-small"
                      color="success"
                      class="ml-2"
                    >
                      {{ $t('items.equipped') }}
                    </v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" class="mr-1">
                      {{ $t(`items.ownerRelationTypes.${owner.relation_type}`) }}
                    </v-chip>
                    <span v-if="owner.notes?.quantity" class="text-caption">
                      {{ $t('items.quantity') }}: {{ owner.notes.quantity }}
                    </span>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeOwner(owner.id)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon start>
                      mdi-plus
                    </v-icon>
                    {{ $t('items.addOwner') }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-select
                      v-model="newOwner.npcId"
                      :items="npcs || []"
                      item-title="name"
                      item-value="id"
                      :label="$t('items.selectNpc')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-combobox
                      v-model="newOwner.relationType"
                      :items="ownerRelationTypeSuggestions"
                      :label="$t('items.ownerRelationType')"
                      :placeholder="$t('items.ownerRelationTypePlaceholder')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="newOwner.quantity"
                          :label="$t('items.quantity')"
                          :placeholder="$t('items.quantityPlaceholder')"
                          variant="outlined"
                          type="number"
                          min="1"
                        />
                      </v-col>
                      <v-col cols="12" md="6" class="d-flex align-center">
                        <v-switch
                          v-model="newOwner.equipped"
                          :label="$t('items.equipped')"
                          color="primary"
                          hide-details
                        />
                      </v-col>
                    </v-row>

                    <v-btn
                      color="primary"
                      prepend-icon="mdi-link"
                      :disabled="!newOwner.npcId || !newOwner.relationType"
                      :loading="addingOwner"
                      @click="addOwnerToItem"
                    >
                      {{ $t('items.addOwner') }}
                    </v-btn>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-tabs-window-item>

            <!-- Locations Tab -->
            <v-tabs-window-item value="locations">
              <div class="text-h6 mb-4">
                {{ $t('items.locationsList') }}
              </div>

              <v-list v-if="itemLocations.length > 0" class="mb-3">
                <v-list-item
                  v-for="location in itemLocations"
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
                      {{ $t(`items.locationRelationTypes.${location.relation_type}`) }}
                    </v-chip>
                    <span v-if="location.notes?.quantity" class="text-caption">
                      {{ $t('items.quantity') }}: {{ location.notes.quantity }}
                    </span>
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

              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon start>
                      mdi-plus
                    </v-icon>
                    {{ $t('items.addLocation') }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-select
                      v-model="newLocation.locationId"
                      :items="locations || []"
                      item-title="name"
                      item-value="id"
                      :label="$t('items.selectLocation')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-combobox
                      v-model="newLocation.relationType"
                      :items="locationRelationTypeSuggestions"
                      :label="$t('items.locationRelationType')"
                      :placeholder="$t('items.locationRelationTypePlaceholder')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-text-field
                      v-model.number="newLocation.quantity"
                      :label="$t('items.quantity')"
                      :placeholder="$t('items.quantityPlaceholder')"
                      variant="outlined"
                      type="number"
                      min="1"
                      class="mb-3"
                    />

                    <v-btn
                      color="primary"
                      prepend-icon="mdi-link"
                      :disabled="!newLocation.locationId || !newLocation.relationType"
                      :loading="addingLocation"
                      @click="addLocationToItem"
                    >
                      {{ $t('items.addLocation') }}
                    </v-btn>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-tabs-window-item>

            <!-- Documents Tab -->
            <v-tabs-window-item value="documents">
              <EntityDocuments v-if="editingItem" :entity-id="editingItem.id" />
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Form for creating new items (no tabs) -->
          <div v-else>
            <v-text-field
              v-model="itemForm.name"
              :label="$t('items.name')"
              :rules="[v => !!v || $t('items.nameRequired')]"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="itemForm.description"
              :label="$t('items.description')"
              variant="outlined"
              rows="3"
              class="mb-4"
            />

            <v-divider class="my-4" />

            <div class="text-h6 mb-4">
              {{ $t('items.metadata') }}
            </div>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="itemForm.metadata.type"
                  :items="ITEM_TYPES"
                  :label="$t('items.type')"
                  variant="outlined"
                  clearable
                >
                  <template #item="{ props, item }">
                    <v-list-item v-bind="props" :title="$t(`items.types.${item.value}`)" />
                  </template>
                  <template #selection="{ item }">
                    {{ $t(`items.types.${item.value}`) }}
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="itemForm.metadata.rarity"
                  :items="ITEM_RARITIES"
                  :label="$t('items.rarity')"
                  variant="outlined"
                  clearable
                >
                  <template #item="{ props, item }">
                    <v-list-item v-bind="props" :title="$t(`items.rarities.${item.value}`)" />
                  </template>
                  <template #selection="{ item }">
                    {{ $t(`items.rarities.${item.value}`) }}
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="itemForm.metadata.value"
                  :label="$t('items.value')"
                  :placeholder="$t('items.valuePlaceholder')"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="itemForm.metadata.weight"
                  :label="$t('items.weight')"
                  :placeholder="$t('items.weightPlaceholder')"
                  variant="outlined"
                />
              </v-col>
            </v-row>

            <v-text-field
              v-model="itemForm.metadata.charges"
              :label="$t('items.charges')"
              :placeholder="$t('items.chargesPlaceholder')"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="itemForm.metadata.properties"
              :label="$t('items.properties')"
              :placeholder="$t('items.propertiesPlaceholder')"
              variant="outlined"
              rows="3"
              class="mb-4"
            />

            <v-switch
              v-model="itemForm.metadata.attunement"
              :label="$t('items.requiresAttunement')"
              color="primary"
              hide-details
            />
          </div>
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
            :disabled="!itemForm.name"
            :loading="saving"
            @click="saveItem"
          >
            {{ editingItem ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('items.deleteTitle')"
      :message="$t('items.deleteConfirm', { name: deletingItem?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { Item, ItemMetadata } from '../../../types/item'
import { ITEM_TYPES, ITEM_RARITIES } from '../../../types/item'

const router = useRouter()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)

onMounted(async () => {
  if (!activeCampaignId.value) {
    router.push('/campaigns')
    return
  }

  await Promise.all([
    entitiesStore.fetchItems(activeCampaignId.value),
    entitiesStore.fetchNPCs(activeCampaignId.value),
    entitiesStore.fetchLocations(activeCampaignId.value),
  ])
})

const items = computed(() => entitiesStore.items)
const pending = computed(() => entitiesStore.itemsLoading)
const npcs = computed(() => entitiesStore.npcsForSelect)
const locations = computed(() => entitiesStore.locationsForSelect)

// Search
const searchQuery = ref('')
const filteredItems = computed(() => {
  if (!items.value)
    return []

  if (!searchQuery.value)
    return items.value

  const query = searchQuery.value.toLowerCase()
  return items.value.filter(item =>
    item.name.toLowerCase().includes(query)
    || item.description?.toLowerCase().includes(query)
    || item.metadata?.type?.toLowerCase().includes(query)
    || item.metadata?.rarity?.toLowerCase().includes(query),
  )
})

// Form state
const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const editingItem = ref<Item | null>(null)
const viewingItem = ref<Item | null>(null)
const deletingItem = ref<Item | null>(null)
const saving = ref(false)
const deleting = ref(false)

const itemForm = ref<{
  name: string
  description: string
  metadata: ItemMetadata
}>({
  name: '',
  description: '',
  metadata: {},
})

// Dialog tab state
const itemDialogTab = ref('details')

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
  if (!target.files || !target.files.length || !editingItem.value)
    return

  const file = target.files[0]
  uploadingImage.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ success: boolean, imageUrl: string }>(`/api/entities/${editingItem.value.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    if (response.success) {
      // Update the editing item with new image URL
      editingItem.value.image_url = response.imageUrl

      // Update the item in the store list directly
      const itemInList = entitiesStore.items?.find(i => i.id === editingItem.value!.id)
      if (itemInList) {
        itemInList.image_url = response.imageUrl
      }

      // Clear file input
      target.value = ''
    }
  }
  catch (error) {
    console.error('Failed to upload image:', error)
    alert(t('items.uploadImageError'))
  }
  finally {
    uploadingImage.value = false
  }
}

// Delete image function
async function deleteImage() {
  if (!editingItem.value?.image_url)
    return

  deletingImage.value = true

  try {
    await $fetch(`/api/entities/${editingItem.value.id}/delete-image`, {
      method: 'DELETE',
    })

    // Update the editing item
    editingItem.value.image_url = null

    // Update the item in the store list directly
    const itemInList = entitiesStore.items?.find(i => i.id === editingItem.value!.id)
    if (itemInList) {
      itemInList.image_url = null
    }
  }
  catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('items.deleteImageError'))
  }
  finally {
    deletingImage.value = false
  }
}

// Use image download composable
const { downloadImage } = useImageDownload()

// Owners state
const itemOwners = ref<Array<{
  id: number
  from_entity_id: number
  npc_name: string
  relation_type: string
  notes: Record<string, unknown> | null
}>>([])

const newOwner = ref({
  npcId: null as number | null,
  relationType: '',
  quantity: 1,
  equipped: false,
})
const addingOwner = ref(false)

// Suggested owner relation types (i18n)
const ownerRelationTypeSuggestions = computed(() => [
  'owns',
  'carries',
  'wields',
  'wears',
  'seeks',
  'guards',
  'stole',
  'lost',
])

// Locations state
const itemLocations = ref<Array<{
  id: number
  from_entity_id: number
  location_name: string
  relation_type: string
  notes: Record<string, unknown> | null
}>>([])

const newLocation = ref({
  locationId: null as number | null,
  relationType: '',
  quantity: 1,
})
const addingLocation = ref(false)

// Suggested location relation types (i18n)
const locationRelationTypeSuggestions = computed(() => [
  'contains',
  'hidden',
  'displayed',
  'stored',
  'lost',
  'guarded',
])

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

function viewItem(item: Item) {
  viewingItem.value = item
  showViewDialog.value = true
}

async function editItem(item: Item) {
  editingItem.value = item
  itemForm.value = {
    name: item.name,
    description: item.description || '',
    metadata: {
      type: item.metadata?.type,
      rarity: item.metadata?.rarity,
      value: item.metadata?.value,
      weight: item.metadata?.weight,
      attunement: item.metadata?.attunement || false,
      charges: item.metadata?.charges,
      properties: item.metadata?.properties,
    },
  }

  // Load owners and locations
  await Promise.all([
    loadItemOwners(),
    loadItemLocations(),
  ])

  showCreateDialog.value = true
  itemDialogTab.value = 'details'
}

function deleteItem(item: Item) {
  deletingItem.value = item
  showDeleteDialog.value = true
}

async function saveItem() {
  if (!itemForm.value.name || !activeCampaignId.value)
    return

  saving.value = true

  try {
    if (editingItem.value) {
      await entitiesStore.updateItem(editingItem.value.id, {
        name: itemForm.value.name,
        description: itemForm.value.description || null,
        metadata: itemForm.value.metadata,
      })
      closeDialog()
    }
    else {
      // Create new item and immediately open edit dialog
      const newItem = await entitiesStore.createItem(activeCampaignId.value, {
        name: itemForm.value.name,
        description: itemForm.value.description || null,
        metadata: itemForm.value.metadata,
      })

      // Close create dialog first
      closeDialog()

      // Open edit dialog with the newly created item
      // Small delay to ensure smooth transition
      await nextTick()
      editItem(newItem)
    }
  }
  catch (error) {
    console.error('Failed to save item:', error)
  }
  finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingItem.value)
    return

  deleting.value = true

  try {
    await entitiesStore.deleteItem(deletingItem.value.id)
    showDeleteDialog.value = false
    deletingItem.value = null
  }
  catch (error) {
    console.error('Failed to delete item:', error)
  }
  finally {
    deleting.value = false
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingItem.value = null
  itemForm.value = {
    name: '',
    description: '',
    metadata: {},
  }
  itemOwners.value = []
  itemLocations.value = []
}

// Owner functions
async function loadItemOwners() {
  if (!editingItem.value)
    return

  try {
    const owners = await $fetch<typeof itemOwners.value>(`/api/items/${editingItem.value.id}/owners`)
    itemOwners.value = owners
  }
  catch (error) {
    console.error('Failed to load item owners:', error)
    itemOwners.value = []
  }
}

async function addOwnerToItem() {
  if (!editingItem.value || !newOwner.value.npcId || !newOwner.value.relationType)
    return

  addingOwner.value = true

  try {
    await $fetch(`/api/items/${editingItem.value.id}/owners`, {
      method: 'POST',
      body: {
        npcId: newOwner.value.npcId,
        relationType: newOwner.value.relationType,
        quantity: newOwner.value.quantity || undefined,
        equipped: newOwner.value.equipped,
      },
    })

    await loadItemOwners()

    // Reset form
    newOwner.value = {
      npcId: null,
      relationType: '',
      quantity: 1,
      equipped: false,
    }
  }
  catch (error) {
    console.error('Failed to add owner to item:', error)
  }
  finally {
    addingOwner.value = false
  }
}

async function removeOwner(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, {
      method: 'DELETE',
    })
    await loadItemOwners()
  }
  catch (error) {
    console.error('Failed to remove owner:', error)
  }
}

// Location functions
async function loadItemLocations() {
  if (!editingItem.value)
    return

  try {
    const locs = await $fetch<typeof itemLocations.value>(`/api/items/${editingItem.value.id}/locations`)
    itemLocations.value = locs
  }
  catch (error) {
    console.error('Failed to load item locations:', error)
    itemLocations.value = []
  }
}

async function addLocationToItem() {
  if (!editingItem.value || !newLocation.value.locationId || !newLocation.value.relationType)
    return

  addingLocation.value = true

  try {
    await $fetch(`/api/items/${editingItem.value.id}/locations`, {
      method: 'POST',
      body: {
        locationId: newLocation.value.locationId,
        relationType: newLocation.value.relationType,
        quantity: newLocation.value.quantity || undefined,
      },
    })

    await loadItemLocations()

    // Reset form
    newLocation.value = {
      locationId: null,
      relationType: '',
      quantity: 1,
    }
  }
  catch (error) {
    console.error('Failed to add location to item:', error)
  }
  finally {
    addingLocation.value = false
  }
}

async function removeLocation(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, {
      method: 'DELETE',
    })
    await loadItemLocations()
  }
  catch (error) {
    console.error('Failed to remove location:', error)
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
