<template>
  <v-container>
    <UiPageHeader :title="$t('items.title')" :subtitle="$t('items.subtitle')">
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
      :hint="searchQuery && searchQuery.trim().length > 0 ? $t('items.searchHint') : ''"
      persistent-hint
    />

    <v-row v-if="pending">
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Item Cards with Search Overlay -->
    <div v-else-if="filteredItems && filteredItems.length > 0" class="position-relative">
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

      <!-- Item Cards -->
      <v-row>
        <v-col v-for="item in filteredItems" :key="item.id" cols="12" md="6" lg="4">
          <ItemCard
            :item="item"
            :is-highlighted="highlightedId === item.id"
            @view="viewItem"
            @edit="editItem"
            @download="(item) => downloadImage(`/uploads/${item.image_url}`, item.name)"
            @delete="deleteItem"
          />
        </v-col>
      </v-row>
    </div>

    <ClientOnly v-else>
      <v-empty-state icon="mdi-sword" :title="$t('items.empty')" :text="$t('items.emptyText')">
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('items.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-sword" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('items.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('items.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('items.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- View Item Dialog -->
    <v-dialog v-model="showViewDialog" max-width="1200" scrollable>
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

        <v-card-text style="max-height: 70vh">
          <v-row>
            <!-- Image -->
            <v-col v-if="viewingItem.image_url" cols="12" md="4">
              <div class="position-relative image-container">
                <v-img
                  :src="`/uploads/${viewingItem.image_url}`"
                  aspect-ratio="1"
                  cover
                  rounded="lg"
                />
                <v-btn
                  icon="mdi-download"
                  size="small"
                  variant="tonal"
                  class="image-download-btn"
                  @click="downloadImage(`/uploads/${viewingItem.image_url}`, viewingItem.name)"
                />
              </div>
            </v-col>

            <!-- Content -->
            <v-col :cols="viewingItem.image_url ? 12 : 12" :md="viewingItem.image_url ? 8 : 12">
              <!-- Type & Attunement -->
              <div class="mb-4">
                <v-chip v-if="viewingItem.metadata?.type" size="small" variant="tonal" class="mr-2">
                  {{ $t(`items.types.${viewingItem.metadata.type}`) }}
                </v-chip>
                <v-chip v-if="viewingItem.metadata?.attunement" size="small" color="purple">
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
            @click="editItemAndCloseView(viewingItem)"
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
      :persistent="generatingImage || uploadingImage"
    >
      <v-card>
        <v-card-title>
          {{ editingItem ? $t('items.edit') : $t('items.create') }}
        </v-card-title>

        <v-tabs v-if="editingItem" v-model="itemDialogTab" class="px-4">
          <v-tab value="details">
            <v-icon start> mdi-information </v-icon>
            {{ $t('items.details') }}
          </v-tab>
          <v-tab value="owners">
            <v-icon start> mdi-account </v-icon>
            {{ $t('items.owners') }} ({{ itemOwners.length }})
          </v-tab>
          <v-tab value="locations">
            <v-icon start> mdi-map-marker </v-icon>
            {{ $t('items.locations') }} ({{ itemLocations.length }})
          </v-tab>
          <v-tab value="lore">
            <v-icon start> mdi-book-open-variant </v-icon>
            {{ $t('lore.title') }} ({{ linkedLore.length }})
          </v-tab>
          <v-tab value="documents">
            <v-icon start> mdi-file-document </v-icon>
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
                    <!-- Image Preview -->
                    <div style="position: relative">
                      <v-avatar
                        size="160"
                        rounded="lg"
                        :color="editingItem?.image_url ? undefined : 'grey-lighten-2'"
                        :style="editingItem?.image_url ? 'cursor: pointer;' : ''"
                        @click="
                          editingItem?.image_url
                            ? openImagePreview(`/uploads/${editingItem.image_url}`, itemForm.name)
                            : null
                        "
                      >
                        <v-img
                          v-if="editingItem?.image_url"
                          :src="`/uploads/${editingItem.image_url}`"
                          cover
                          :class="{ 'blur-image': uploadingImage || generatingImage }"
                        />
                        <v-icon
                          v-else-if="!uploadingImage && !generatingImage"
                          icon="mdi-sword"
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
                          editingItem?.image_url ? $t('items.changeImage') : $t('items.uploadImage')
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
                      <div class="d-flex align-center gap-2">
                        <v-btn
                          prepend-icon="mdi-creation"
                          color="primary"
                          variant="tonal"
                          block
                          class="mb-2"
                          :loading="generatingImage"
                          :disabled="
                            uploadingImage ||
                            deletingImage ||
                            !itemForm.name ||
                            !hasApiKey ||
                            hasUnsavedChanges
                          "
                          @click="generateImage"
                        >
                          {{ $t('items.generateImage') }}
                        </v-btn>
                        <v-tooltip v-if="hasUnsavedChanges" location="top">
                          <template #activator="{ props }">
                            <v-icon
                              v-bind="props"
                              icon="mdi-information-outline"
                              color="warning"
                              size="small"
                              class="mb-2"
                            />
                          </template>
                          <span>{{ $t('items.saveBeforeGenerating') }}</span>
                        </v-tooltip>
                      </div>

                      <!-- Download Button (only if image exists) -->
                      <v-btn
                        v-if="editingItem?.image_url"
                        prepend-icon="mdi-download"
                        variant="outlined"
                        block
                        class="mb-2"
                        :disabled="uploadingImage || generatingImage"
                        @click="downloadImage(`/uploads/${editingItem.image_url}`, itemForm.name)"
                      >
                        Download
                      </v-btn>

                      <!-- Delete Button (only if image exists) -->
                      <v-btn
                        v-if="editingItem?.image_url"
                        prepend-icon="mdi-delete"
                        color="error"
                        variant="outlined"
                        block
                        :loading="deletingImage"
                        :disabled="uploadingImage || generatingImage"
                        @click="deleteImage"
                      >
                        {{ $t('items.deleteImage') }}
                      </v-btn>

                      <!-- AI Hint -->
                      <div v-if="!hasApiKey" class="text-caption text-medium-emphasis mt-3">
                        <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
                        KI-Generierung: OpenAI API-Key in Einstellungen hinterlegen
                      </div>
                      <div
                        v-else-if="!itemForm.name"
                        class="text-caption text-medium-emphasis mt-3"
                      >
                        <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
                        KI-Generierung: Bitte zuerst einen Namen eingeben
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>

              <v-text-field
                v-model="itemForm.name"
                :label="$t('items.name')"
                :rules="[(v) => !!v || $t('items.nameRequired')]"
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
                <v-list-item v-for="owner in itemOwners" :key="owner.id" class="mb-2" border>
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
                    <v-icon start> mdi-plus </v-icon>
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
                    <v-icon start> mdi-plus </v-icon>
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

            <!-- Lore Tab -->
            <v-tabs-window-item value="lore">
              <div v-if="editingItem">
                <!-- Add Lore Relation -->
                <v-card variant="outlined" class="mb-4">
                  <v-card-text>
                    <v-autocomplete
                      v-model="selectedLoreId"
                      :items="loreItems"
                      :label="$t('lore.selectLore')"
                      :placeholder="$t('lore.selectLorePlaceholder')"
                      variant="outlined"
                      clearable
                      :loading="loadingLore"
                      class="mb-2"
                    />
                    <v-btn color="primary" :disabled="!selectedLoreId" @click="addLoreRelation">
                      <v-icon start> mdi-link-plus </v-icon>
                      {{ $t('lore.addRelation') }}
                    </v-btn>
                  </v-card-text>
                </v-card>

                <!-- Linked Lore List -->
                <v-list v-if="linkedLore.length > 0">
                  <v-list-item v-for="lore in linkedLore" :key="lore.id" class="mb-2">
                    <template #prepend>
                      <v-avatar v-if="lore.image_url" size="56" rounded="lg" class="mr-3">
                        <v-img :src="`/uploads/${lore.image_url}`" />
                      </v-avatar>
                      <v-avatar v-else size="56" rounded="lg" class="mr-3" color="surface-variant">
                        <v-icon icon="mdi-book-open-variant" />
                      </v-avatar>
                    </template>
                    <v-list-item-title>{{ lore.name }}</v-list-item-title>
                    <v-list-item-subtitle v-if="lore.description">
                      {{ lore.description.substring(0, 100)
                      }}{{ lore.description.length > 100 ? '...' : '' }}
                    </v-list-item-subtitle>
                    <template #append>
                      <v-btn
                        icon="mdi-delete"
                        variant="text"
                        color="error"
                        size="small"
                        @click="removeLoreRelation(lore.id)"
                      />
                    </template>
                  </v-list-item>
                </v-list>

                <v-empty-state
                  v-else
                  icon="mdi-book-open-variant"
                  :title="$t('lore.noLinkedLore')"
                  :text="$t('lore.noLinkedLoreText')"
                />
              </div>
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
              :rules="[(v) => !!v || $t('items.nameRequired')]"
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
          <v-btn variant="text" :disabled="generatingImage || uploadingImage" @click="closeDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!itemForm.name || generatingImage || uploadingImage"
            :loading="saving"
            @click="saveItem"
          >
            {{ editingItem ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Image Preview Dialog -->
    <ImagePreviewDialog
      v-model="showImagePreview"
      :image-url="previewImageUrl"
      :title="previewImageTitle"
      :download-file-name="previewImageTitle"
    />

    <!-- Delete Confirmation Dialog -->
    <UiDeleteConfirmDialog
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
import EntityDocuments from '~/components/shared/EntityDocuments.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'
import ItemCard from '~/components/items/ItemCard.vue'

// Check if OpenAI API key is configured
const hasApiKey = ref(false)

// Image Preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

function openImagePreview(imageUrl: string, title: string) {
  previewImageUrl.value = imageUrl
  previewImageTitle.value = title
  showImagePreview.value = true
}

// Debounced FTS5 + Levenshtein Search (must be declared early for template)
const searchQuery = ref('')
const searchResults = ref<Item[]>([])
const searching = ref(false)

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Highlighted item (from global search)
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

    // Scroll to highlighted item after a short delay
    nextTick(() => {
      setTimeout(() => {
        const element = document.getElementById(`item-${highlightedId.value}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    })
  }
}

const { loadItemCountsBatch, reloadItemCounts } = useItemCounts()

onMounted(async () => {
  if (!activeCampaignId.value) {
    router.push('/campaigns')
    return
  }

  await Promise.all([
    entitiesStore.fetchItems(activeCampaignId.value),
    entitiesStore.fetchNPCs(activeCampaignId.value),
    entitiesStore.fetchLocations(activeCampaignId.value),
    entitiesStore.fetchLore(activeCampaignId.value),
  ])

  // Load counts for all items in background (non-blocking)
  if (items.value && items.value.length > 0) {
    loadItemCountsBatch(items.value)
  }

  // Check if API key is configured
  try {
    const settings = await $fetch<{ openai_api_key_full?: string }>('/api/settings')
    hasApiKey.value = !!settings.openai_api_key_full
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

const items = computed(() => entitiesStore.items)
const pending = computed(() => entitiesStore.itemsLoading)
const npcs = computed(() => entitiesStore.npcsForSelect)
const locations = computed(() => entitiesStore.locationsForSelect)

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
    const results = await $fetch<Item[]>('/api/items', {
      query: {
        campaignId: activeCampaignId.value,
        search: query.trim(),
      },
      headers: {
        'Accept-Language': locale.value, // Send current locale to backend
      },
      signal: abortController.signal, // Pass abort signal to fetch
    })
    searchResults.value = results
  } catch (error: unknown) {
    // Ignore abort errors (expected when user types fast)
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return
    }
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    searching.value = false
    abortController = null
  }
}

// Watch search query with debounce
watch(searchQuery, async (query) => {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  // Abort any running search immediately
  if (abortController) {
    abortController.abort()
    abortController = null
  }

  // If empty, show all items from store
  if (!query || query.trim().length === 0) {
    searchResults.value = []
    searching.value = false
    return
  }

  // Show loading state immediately (user sees overlay during debounce)
  searching.value = true

  // Debounce search by 300ms
  searchTimeout = setTimeout(() => executeSearch(query), 300)
})

// Show search results OR cached items
const filteredItems = computed(() => {
  // If user is actively searching, show search results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }

  // Otherwise show all cached items
  return items.value || []
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

// Track original item data to detect unsaved changes
const originalItemData = ref<{
  name: string
  description: string
  metadata: ItemMetadata
} | null>(null)

// Check if form has unsaved changes
const hasUnsavedChanges = computed(() => {
  if (!originalItemData.value) return false

  return (
    itemForm.value.name !== originalItemData.value.name ||
    itemForm.value.description !== originalItemData.value.description ||
    JSON.stringify(itemForm.value.metadata) !== JSON.stringify(originalItemData.value.metadata)
  )
})

// Dialog tab state
const itemDialogTab = ref('details')

// Lore linking state
const linkedLore = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const selectedLoreId = ref<number | null>(null)
const loadingLore = ref(false)

// Image upload state
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)
const generatingImage = ref(false)

// Trigger file input click
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// AI Image Generation
async function generateImage() {
  if (!editingItem.value || !itemForm.value.name) return

  generatingImage.value = true

  try {
    // Build detailed prompt from all available item data
    const details = []

    // Type (most important - weapon, armor, potion, etc.)
    if (itemForm.value.metadata.type) {
      details.push(itemForm.value.metadata.type)
    }

    // Rarity (affects visual quality and details)
    if (itemForm.value.metadata.rarity) {
      const rarityDescriptions: Record<string, string> = {
        common: 'simple',
        uncommon: 'well-crafted',
        rare: 'ornate and detailed',
        very_rare: 'exquisitely decorated',
        legendary: 'legendary artifact with glowing runes',
        artifact: 'ancient powerful artifact radiating magic',
      }
      const rarityDesc =
        rarityDescriptions[itemForm.value.metadata.rarity] || itemForm.value.metadata.rarity
      details.push(rarityDesc)
    }

    // Name (required)
    details.push(itemForm.value.name)

    // Description (free-form details)
    if (itemForm.value.description) {
      details.push(itemForm.value.description)
    }

    const prompt = details.filter((d) => d).join(', ')

    const result = await $fetch<{ imageUrl: string; revisedPrompt?: string }>(
      '/api/ai/generate-image',
      {
        method: 'POST',
        body: {
          prompt,
          entityName: itemForm.value.name,
          entityType: 'Item',
          style: 'fantasy-art',
        },
      },
    )

    if (result.imageUrl && editingItem.value) {
      // Update the item with the generated image
      const response = await $fetch<{ success: boolean }>(
        `/api/entities/${editingItem.value.id}/set-image`,
        {
          method: 'POST',
          body: {
            imageUrl: result.imageUrl.replace('/uploads/', ''), // Remove /uploads/ prefix
          },
        },
      )

      if (response.success) {
        // Update local item
        editingItem.value.image_url = result.imageUrl.replace('/uploads/', '')
        // Refresh NPCs to update the list
        if (activeCampaignId.value) {
          await entitiesStore.fetchItems(activeCampaignId.value)
        }
      }
    }
  } catch (error: unknown) {
    console.error('[Item] Failed to generate image:', error)
    const errorMessage =
      error &&
      typeof error === 'object' &&
      'data' in error &&
      error.data &&
      typeof error.data === 'object' &&
      'message' in error.data
        ? String(error.data.message)
        : 'Failed to generate image'
    alert(errorMessage)
  } finally {
    generatingImage.value = false
  }
}

// Handle image upload from native input
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length || !editingItem.value) return

  const file = target.files[0]
  if (!file) return

  uploadingImage.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ success: boolean; imageUrl: string }>(
      `/api/entities/${editingItem.value.id}/upload-image`,
      {
        method: 'POST',
        body: formData,
      },
    )

    if (response.success) {
      // Update the editing item with new image URL
      editingItem.value.image_url = response.imageUrl

      // Update the item in the store list directly
      const itemInList = entitiesStore.items?.find((i) => i.id === editingItem.value!.id)
      if (itemInList) {
        itemInList.image_url = response.imageUrl
      }

      // Clear file input
      target.value = ''
    }
  } catch (error) {
    console.error('Failed to upload image:', error)
    alert(t('items.uploadImageError'))
  } finally {
    uploadingImage.value = false
  }
}

// Delete image function
async function deleteImage() {
  if (!editingItem.value?.image_url) return

  deletingImage.value = true

  try {
    await $fetch(`/api/entities/${editingItem.value.id}/delete-image`, {
      method: 'DELETE',
    })

    // Update the editing item
    editingItem.value.image_url = null

    // Update the item in the store list directly
    const itemInList = entitiesStore.items?.find((i) => i.id === editingItem.value!.id)
    if (itemInList) {
      itemInList.image_url = null
    }
  } catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('items.deleteImageError'))
  } finally {
    deletingImage.value = false
  }
}

// Use image download composable
const { downloadImage } = useImageDownload()

// Owners state
const itemOwners = ref<
  Array<{
    id: number
    from_entity_id: number
    npc_name: string
    relation_type: string
    notes: Record<string, unknown> | null
  }>
>([])

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
const itemLocations = ref<
  Array<{
    id: number
    from_entity_id: number
    location_name: string
    relation_type: string
    notes: Record<string, unknown> | null
  }>
>([])

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

// Helper function for rarity colors (used in View Dialog)
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

  // Store original data to track changes
  originalItemData.value = JSON.parse(JSON.stringify(itemForm.value))

  // Load owners and locations
  await Promise.all([loadItemOwners(), loadItemLocations()])

  showCreateDialog.value = true
  itemDialogTab.value = 'details'
}

async function editItemAndCloseView(item: Item) {
  await editItem(item)
  showViewDialog.value = false
}

function deleteItem(item: Item) {
  deletingItem.value = item
  showDeleteDialog.value = true
}

async function saveItem() {
  if (!itemForm.value.name || !activeCampaignId.value) return

  saving.value = true

  try {
    let savedItemId: number

    if (editingItem.value) {
      await entitiesStore.updateItem(editingItem.value.id, {
        name: itemForm.value.name,
        description: itemForm.value.description || null,
        metadata: itemForm.value.metadata,
      })
      savedItemId = editingItem.value.id

      // Update original data after successful save
      originalItemData.value = JSON.parse(JSON.stringify(itemForm.value))
    } else {
      // Create new item
      const newItem = await entitiesStore.createItem(activeCampaignId.value, {
        name: itemForm.value.name,
        description: itemForm.value.description || null,
        metadata: itemForm.value.metadata,
      })
      savedItemId = newItem.id
    }

    // If user is searching, re-execute search to update FTS5 results
    if (searchQuery.value && searchQuery.value.trim().length > 0) {
      await executeSearch(searchQuery.value)
    }

    // Reload counts for the saved Item (get Item from store, not API response!)
    const itemFromStore = entitiesStore.items.find((i) => i.id === savedItemId)
    if (itemFromStore) {
      await reloadItemCounts(itemFromStore)
    }

    closeDialog()
  } catch (error) {
    console.error('Failed to save item:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingItem.value) return

  deleting.value = true

  try {
    await entitiesStore.deleteItem(deletingItem.value.id)
    showDeleteDialog.value = false
    deletingItem.value = null
  } catch (error) {
    console.error('Failed to delete item:', error)
  } finally {
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
  if (!editingItem.value) return

  try {
    const owners = await $fetch<typeof itemOwners.value>(
      `/api/items/${editingItem.value.id}/owners`,
    )
    itemOwners.value = owners
  } catch (error) {
    console.error('Failed to load item owners:', error)
    itemOwners.value = []
  }
}

async function addOwnerToItem() {
  if (!editingItem.value || !newOwner.value.npcId || !newOwner.value.relationType) return

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
  } catch (error) {
    console.error('Failed to add owner to item:', error)
  } finally {
    addingOwner.value = false
  }
}

async function removeOwner(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, {
      method: 'DELETE',
    })
    await loadItemOwners()
  } catch (error) {
    console.error('Failed to remove owner:', error)
  }
}

// Location functions
async function loadItemLocations() {
  if (!editingItem.value) return

  try {
    const locs = await $fetch<typeof itemLocations.value>(
      `/api/items/${editingItem.value.id}/locations`,
    )
    itemLocations.value = locs
  } catch (error) {
    console.error('Failed to load item locations:', error)
    itemLocations.value = []
  }
}

async function addLocationToItem() {
  if (!editingItem.value || !newLocation.value.locationId || !newLocation.value.relationType) return

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
  } catch (error) {
    console.error('Failed to add location to item:', error)
  } finally {
    addingLocation.value = false
  }
}

async function removeLocation(relationId: number) {
  try {
    await $fetch(`/api/relations/${relationId}`, {
      method: 'DELETE',
    })
    await loadItemLocations()
  } catch (error) {
    console.error('Failed to remove location:', error)
  }
}

// Lore items for selection
const loreItems = computed(() => {
  return entitiesStore.loreForSelect.map((lore: { id: number; name: string }) => ({
    title: lore.name,
    value: lore.id,
  }))
})

// Load linked lore when editing Item
watch(
  () => editingItem.value?.id,
  async (itemId) => {
    if (itemId) {
      await loadLinkedLore(itemId)
    } else {
      linkedLore.value = []
    }
  },
)

// Load linked lore entries
async function loadLinkedLore(itemId: number) {
  loadingLore.value = true
  try {
    const relations = await $fetch<
      Array<{ id: number; name: string; description: string | null; image_url: string | null }>
    >(`/api/items/${itemId}/lore`)
    linkedLore.value = relations
  } catch (error) {
    console.error('Failed to load linked lore:', error)
    linkedLore.value = []
  } finally {
    loadingLore.value = false
  }
}

// Add lore relation
async function addLoreRelation() {
  if (!editingItem.value || !selectedLoreId.value) return

  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: editingItem.value.id,
        toEntityId: selectedLoreId.value,
        relationType: 'bezieht sich auf',
      },
    })

    await loadLinkedLore(editingItem.value.id)
    selectedLoreId.value = null
  } catch (error) {
    console.error('Failed to add lore relation:', error)
  }
}

// Remove lore relation
async function removeLoreRelation(loreId: number) {
  if (!editingItem.value) return

  try {
    // Find the relation ID
    const relation = await $fetch<{ id: number } | null>('/api/entity-relations/find', {
      query: {
        from_entity_id: editingItem.value.id,
        to_entity_id: loreId,
      },
    })

    if (relation?.id) {
      await $fetch(`/api/entity-relations/${relation.id}`, {
        method: 'DELETE',
      })

      await loadLinkedLore(editingItem.value.id)
    }
  } catch (error) {
    console.error('Failed to remove lore relation:', error)
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

/* Blur image during upload/generation */
.blur-image {
  filter: blur(8px);
  opacity: 0.6;
  transition:
    filter 0.3s ease,
    opacity 0.3s ease;
}
</style>
