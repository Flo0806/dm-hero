<template>
  <v-container>
    <UiPageHeader
      :title="$t('npcs.title')"
      :subtitle="$t('npcs.subtitle')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('npcs.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Search Bar -->
    <v-text-field
      v-model="searchQuery"
      :placeholder="$t('common.search')"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      clearable
      class="mb-4"
    />

    <v-row v-if="entitiesStore.npcsLoading">
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

    <!-- NPC Cards with Search Overlay -->
    <div v-else-if="filteredNpcs && filteredNpcs.length > 0" class="position-relative">
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
          <v-progress-circular
            indeterminate
            size="64"
            color="primary"
            class="mb-4"
          />
          <div class="text-h6">
            {{ $t('common.searching') }}
          </div>
        </div>
      </v-overlay>

      <!-- NPC Cards -->
      <v-row>
      <v-col
        v-for="npc in filteredNpcs"
        :key="npc.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card
          :id="`npc-${npc.id}`"
          hover
          :class="[
            'h-100 d-flex flex-column',
            { 'highlighted-card': highlightedId === npc.id }
          ]"
        >
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-account" class="mr-2" color="primary" />
            {{ npc.name }}
            <v-spacer />
            <v-chip
              v-if="npc.metadata?.status"
              :prepend-icon="getNpcStatusIcon(npc.metadata.status)"
              :color="getNpcStatusColor(npc.metadata.status)"
              size="small"
              variant="flat"
            >
              {{ $t(`npcs.statuses.${npc.metadata.status}`) }}
            </v-chip>
          </v-card-title>
          <v-card-text class="flex-grow-1">
            <div
              v-if="npc.image_url"
              class="float-right ml-3 mb-2 position-relative image-container"
              style="width: 80px; height: 80px;"
            >
              <v-avatar
                size="80"
                rounded="lg"
              >
                <v-img :src="`/pictures/${npc.image_url}`" cover />
              </v-avatar>
              <v-btn
                icon="mdi-download"
                size="x-small"
                variant="tonal"
                class="image-download-btn"
                @click.stop="downloadImage(`/pictures/${npc.image_url}`, npc.name)"
              />
            </div>
            <div v-if="npc.metadata?.type" class="mb-2">
              <v-chip
                :prepend-icon="getNpcTypeIcon(npc.metadata.type)"
                size="small"
                color="primary"
              >
                {{ $t(`npcs.types.${npc.metadata.type}`) }}
              </v-chip>
            </div>
            <div v-if="npc.description" class="text-body-2 mb-3">
              {{ truncateText(npc.description, 100) }}
            </div>
            <div v-if="npc.metadata" class="text-caption">
              <div v-if="npc.metadata.race" class="mb-1">
                <strong>{{ $t('npcs.race') }}:</strong> {{ getRaceDisplayName(npc.metadata.race) }}
              </div>
              <div v-if="npc.metadata.class" class="mb-1">
                <strong>{{ $t('npcs.class') }}:</strong> {{ getClassDisplayName(npc.metadata.class) }}
              </div>
              <div v-if="npc.metadata.location">
                <strong>{{ $t('npcs.location') }}:</strong> {{ npc.metadata.location }}
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              icon="mdi-pencil"
              variant="text"
              @click="editNpc(npc)"
            />
            <v-spacer />
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              @click="deleteNpc(npc)"
            />
          </v-card-actions>
        </v-card>
      </v-col>
      </v-row>
    </div>

    <div v-else>
      <ClientOnly>
        <v-empty-state
          icon="mdi-account-group"
          :title="$t('npcs.empty')"
          :text="$t('npcs.emptyText')"
        >
          <template #actions>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              @click="showCreateDialog = true"
            >
              {{ $t('npcs.create') }}
            </v-btn>
          </template>
        </v-empty-state>
        <template #fallback>
          <v-container class="text-center py-16">
            <v-icon icon="mdi-account-group" size="64" color="grey" class="mb-4" />
            <h2 class="text-h5 mb-2">{{ $t('npcs.empty') }}</h2>
            <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('npcs.emptyText') }}</p>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              @click="showCreateDialog = true"
            >
              {{ $t('npcs.create') }}
            </v-btn>
          </v-container>
        </template>
      </ClientOnly>
    </div>

    <!-- Create/Edit Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="900"
      scrollable
    >
      <v-card>
        <v-card-title>
          {{ editingNpc ? $t('npcs.edit') : $t('npcs.create') }}
        </v-card-title>

        <v-tabs v-if="editingNpc" v-model="npcDialogTab" class="mb-4">
          <v-tab value="details">
            <v-icon start>
              mdi-account-details
            </v-icon>
            {{ $t('npcs.details') }}
          </v-tab>
          <v-tab value="relations">
            <v-icon start>
              mdi-map-marker
            </v-icon>
            {{ $t('npcs.linkedLocations') }}
          </v-tab>
          <v-tab value="memberships">
            <v-icon start>
              mdi-account-group
            </v-icon>
            {{ $t('npcs.memberships') }}
          </v-tab>
          <v-tab value="items">
            <v-icon start>
              mdi-sword
            </v-icon>
            {{ $t('npcs.items') }}
          </v-tab>
          <v-tab value="notes">
            <v-icon start>
              mdi-note-text
            </v-icon>
            {{ $t('npcs.notes') }} ({{ npcNotes.length }})
          </v-tab>
          <v-tab value="documents">
            <v-icon start>
              mdi-file-document
            </v-icon>
            {{ $t('documents.title') }}
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 600px">
          <v-tabs-window v-if="editingNpc" v-model="npcDialogTab">
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
                        :color="editingNpc?.image_url ? undefined : 'grey-lighten-2'"
                      >
                        <v-img
                          v-if="editingNpc?.image_url && !uploadingImage"
                          :src="`/pictures/${editingNpc.image_url}`"
                          cover
                        />
                        <v-icon v-else-if="!uploadingImage" icon="mdi-account" size="64" color="grey" />
                      </v-avatar>
                      <v-btn
                        v-if="editingNpc?.image_url && !uploadingImage"
                        icon="mdi-download"
                        size="small"
                        variant="tonal"
                        class="image-download-btn"
                        @click="downloadImage(`/pictures/${editingNpc.image_url}`, editingNpc.name)"
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
                            {{ editingNpc?.image_url ? $t('npcs.changeImage') : $t('npcs.uploadImage') }}
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
                          v-if="editingNpc?.image_url"
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
                            {{ $t('npcs.deleteImage') }}
                          </v-tooltip>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>

              <v-text-field
                v-model="npcForm.name"
                :label="$t('npcs.name')"
                :rules="[v => !!v || $t('npcs.nameRequired')]"
                variant="outlined"
                class="mb-4"
              />

              <v-textarea
                v-model="npcForm.description"
                :label="$t('npcs.description')"
                variant="outlined"
                rows="4"
                class="mb-4"
              />

              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    :key="`race-${locale}`"
                    v-model="npcForm.metadata.race"
                    :items="raceItems"
                    :label="$t('npcs.race')"
                    variant="outlined"
                    clearable
                    item-title="title"
                    item-value="value"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    :key="`class-${locale}`"
                    v-model="npcForm.metadata.class"
                    :items="classItems"
                    :label="$t('npcs.class')"
                    variant="outlined"
                    clearable
                    item-title="title"
                    item-value="value"
                  />
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="npcForm.metadata.type"
                    :items="npcTypes"
                    :label="$t('npcs.type')"
                    variant="outlined"
                    clearable
                  >
                    <template #item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-icon :icon="getNpcTypeIcon(item.value)" />
                        </template>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <v-chip>
                        <template #prepend>
                          <v-icon :icon="getNpcTypeIcon(item.value)" size="small" class="mr-1" />
                        </template>
                        {{ item.title }}
                      </v-chip>
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="npcForm.metadata.status"
                    :items="npcStatuses"
                    :label="$t('npcs.status')"
                    variant="outlined"
                    clearable
                  >
                    <template #item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-icon :icon="getNpcStatusIcon(item.value)" :color="getNpcStatusColor(item.value)" />
                        </template>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <v-chip :color="getNpcStatusColor(item.value)">
                        <template #prepend>
                          <v-icon :icon="getNpcStatusIcon(item.value)" size="small" class="mr-1" />
                        </template>
                        {{ item.title }}
                      </v-chip>
                    </template>
                  </v-select>
                </v-col>
              </v-row>

              <v-text-field
                v-model="npcForm.metadata.location"
                :label="$t('npcs.location')"
                variant="outlined"
                class="mb-4"
              />

              <v-text-field
                v-model="npcForm.metadata.faction"
                :label="$t('npcs.faction')"
                variant="outlined"
                class="mb-4"
              />

              <v-textarea
                v-model="npcForm.metadata.relationship"
                :label="$t('npcs.relationship')"
                variant="outlined"
                rows="2"
              />
            </v-tabs-window-item>

            <!-- Relations Tab -->
            <v-tabs-window-item value="relations">

          <v-list v-if="editingNpc && npcRelations.filter(r => r.to_entity_type === 'Location').length > 0" class="mb-3">
            <v-list-item
              v-for="relation in npcRelations.filter(r => r.to_entity_type === 'Location')"
              :key="relation.id"
              class="mb-2"
              border
            >
              <template #prepend>
                <v-icon icon="mdi-map-marker" color="primary" />
              </template>
              <v-list-item-title>
                {{ relation.to_entity_name }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <v-chip size="small" class="mr-1">
                  {{ relation.relation_type }}
                </v-chip>
                <span v-if="relation.notes" class="text-caption">
                  {{ relation.notes }}
                </span>
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-pencil"
                  variant="text"
                  size="small"
                  @click="editRelation(relation)"
                />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="removeRelation(relation.id)"
                />
              </template>
            </v-list-item>
          </v-list>

          <v-expansion-panels v-if="editingNpc" class="mb-3">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon start>
                  mdi-plus
                </v-icon>
                {{ $t('npcs.addLocationLink') }}
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-select
                  v-model="newRelation.locationId"
                  :items="locations || []"
                  item-title="name"
                  item-value="id"
                  :label="$t('npcs.selectLocation')"
                  variant="outlined"
                  class="mb-3"
                />

                <v-combobox
                  v-model="newRelation.relationType"
                  :items="relationTypeSuggestions"
                  :label="$t('npcs.relationType')"
                  :placeholder="$t('npcs.relationTypePlaceholder')"
                  variant="outlined"
                  class="mb-3"
                />

                <v-textarea
                  v-model="newRelation.notes"
                  :label="$t('npcs.relationNotes')"
                  :placeholder="$t('npcs.relationNotesPlaceholder')"
                  variant="outlined"
                  rows="2"
                  class="mb-3"
                />

                <v-btn
                  color="primary"
                  prepend-icon="mdi-link"
                  :disabled="!newRelation.locationId || !newRelation.relationType"
                  :loading="addingRelation"
                  @click="addLocationRelation"
                >
                  {{ $t('npcs.addLocationLink') }}
                </v-btn>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
            </v-tabs-window-item>

            <!-- Memberships Tab -->
            <v-tabs-window-item value="memberships">
              <div class="text-h6 mb-4">
                {{ $t('npcs.factionMemberships') }}
              </div>

              <v-list v-if="factionMemberships.length > 0" class="mb-3">
                <v-list-item
                  v-for="membership in factionMemberships"
                  :key="membership.id"
                  class="mb-2"
                  border
                >
                  <template #prepend>
                    <v-icon icon="mdi-shield-account" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ membership.to_entity_name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" class="mr-1">
                      {{ membership.relation_type }}
                    </v-chip>
                    <span v-if="membership.notes?.rank" class="text-caption">
                      {{ $t('npcs.rank') }}: {{ membership.notes.rank }}
                    </span>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-pencil"
                      variant="text"
                      size="small"
                      @click="editMembership(membership)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeMembership(membership.id)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-expansion-panels class="mb-4">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon start>
                      mdi-plus
                    </v-icon>
                    {{ $t('npcs.addFactionMembership') }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-select
                      v-model="newMembership.factionId"
                      :items="factions || []"
                      item-title="name"
                      item-value="id"
                      :label="$t('npcs.selectFaction')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-combobox
                      v-model="newMembership.relationType"
                      :items="membershipTypeSuggestions"
                      :label="$t('npcs.membershipType')"
                      :placeholder="$t('npcs.membershipTypePlaceholder')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-text-field
                      v-model="newMembership.rank"
                      :label="$t('npcs.rank')"
                      :placeholder="$t('npcs.rankPlaceholder')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-btn
                      color="primary"
                      prepend-icon="mdi-link"
                      :disabled="!newMembership.factionId || !newMembership.relationType"
                      :loading="addingMembership"
                      @click="addFactionMembership"
                    >
                      {{ $t('npcs.addFactionMembership') }}
                    </v-btn>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <v-divider class="my-6" />

              <div class="text-h6 mb-4">
                {{ $t('npcs.npcRelations') }}
              </div>

              <v-list v-if="npcRelationsList.length > 0" class="mb-3">
                <v-list-item
                  v-for="relation in npcRelationsList"
                  :key="relation.id"
                  class="mb-2"
                  border
                >
                  <template #prepend>
                    <v-icon icon="mdi-account" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ relation.to_entity_name }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small">
                      {{ relation.relation_type }}
                    </v-chip>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-pencil"
                      variant="text"
                      size="small"
                      @click="editNpcRelation(relation)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeNpcRelation(relation.id)"
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
                    {{ $t('npcs.addNpcRelation') }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-select
                      v-model="newNpcRelation.npcId"
                      :items="otherNpcs"
                      item-title="name"
                      item-value="id"
                      :label="$t('npcs.selectNpc')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-combobox
                      v-model="newNpcRelation.relationType"
                      :items="npcRelationTypeSuggestions"
                      :label="$t('npcs.relationType')"
                      :placeholder="$t('npcs.npcRelationTypePlaceholder')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-btn
                      color="primary"
                      prepend-icon="mdi-link"
                      :disabled="!newNpcRelation.npcId || !newNpcRelation.relationType"
                      :loading="addingNpcRelation"
                      @click="addNpcRelation"
                    >
                      {{ $t('npcs.addNpcRelation') }}
                    </v-btn>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-tabs-window-item>

            <!-- Items Tab -->
            <v-tabs-window-item value="items">
              <div class="text-h6 mb-4">
                {{ $t('npcs.itemsList') }}
              </div>

              <v-list v-if="npcItems.length > 0" class="mb-3">
                <v-list-item
                  v-for="item in npcItems"
                  :key="item.id"
                  class="mb-2"
                  border
                >
                  <template #prepend>
                    <v-icon icon="mdi-sword" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ item.item_name }}
                    <v-chip
                      v-if="item.notes?.equipped"
                      size="x-small"
                      color="success"
                      class="ml-2"
                    >
                      {{ $t('npcs.equipped') }}
                    </v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" class="mr-1">
                      {{ $t(`npcs.itemRelationTypes.${item.relation_type}`) }}
                    </v-chip>
                    <span v-if="item.notes?.quantity" class="text-caption">
                      {{ $t('npcs.quantity') }}: {{ item.notes.quantity }}
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

              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon start>
                      mdi-plus
                    </v-icon>
                    {{ $t('npcs.addItem') }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-select
                      v-model="newItem.itemId"
                      :items="items || []"
                      item-title="name"
                      item-value="id"
                      :label="$t('npcs.selectItem')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-combobox
                      v-model="newItem.relationType"
                      :items="itemRelationTypeSuggestions"
                      :label="$t('npcs.itemRelationType')"
                      :placeholder="$t('npcs.itemRelationTypePlaceholder')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="newItem.quantity"
                          :label="$t('npcs.quantity')"
                          :placeholder="$t('npcs.quantityPlaceholder')"
                          variant="outlined"
                          type="number"
                          min="1"
                        />
                      </v-col>
                      <v-col cols="12" md="6" class="d-flex align-center">
                        <v-switch
                          v-model="newItem.equipped"
                          :label="$t('npcs.equipped')"
                          color="primary"
                          hide-details
                        />
                      </v-col>
                    </v-row>

                    <v-btn
                      color="primary"
                      prepend-icon="mdi-link"
                      :disabled="!newItem.itemId || !newItem.relationType"
                      :loading="addingItem"
                      @click="addItemToNpc"
                    >
                      {{ $t('npcs.addItem') }}
                    </v-btn>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-tabs-window-item>

            <!-- Notes Tab -->
            <v-tabs-window-item value="notes">
              <div class="d-flex justify-space-between align-center mb-4">
                <v-text-field
                  v-model="notesSearch"
                  :placeholder="$t('npcs.searchNotes')"
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  clearable
                  hide-details
                  class="mr-2"
                />
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  @click="showNoteDialog = true"
                >
                  {{ $t('npcs.newNote') }}
                </v-btn>
              </div>

              <v-progress-linear v-if="loadingNotes" indeterminate />

              <v-list v-else-if="filteredNotes.length > 0">
                <v-list-item
                  v-for="note in filteredNotes"
                  :key="note.id"
                  class="mb-2"
                  border
                >
                  <template #prepend>
                    <v-icon icon="mdi-note-text" color="primary" />
                  </template>
                  <v-list-item-title>
                    <span class="text-caption text-medium-emphasis mr-2">
                      {{ formatDate(note.date || note.created_at) }}
                    </span>
                    <span v-if="note.title" class="font-weight-medium">
                      {{ note.title }}
                    </span>
                  </v-list-item-title>
                  <v-list-item-subtitle class="mt-1">
                    {{ truncateText(note.summary, 150) }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-pencil"
                      variant="text"
                      size="small"
                      @click="editNote(note)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="deleteNote(note)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-empty-state
                v-else
                icon="mdi-note-text-outline"
                :title="$t('npcs.noNotes')"
                :text="$t('npcs.noNotesText')"
              />
            </v-tabs-window-item>

            <!-- Documents Tab -->
            <v-tabs-window-item value="documents">
              <EntityDocuments v-if="editingNpc" :entity-id="editingNpc.id" />
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Create Form (no tabs) -->
          <div v-if="!editingNpc">
            <v-text-field
              v-model="npcForm.name"
              :label="$t('npcs.name')"
              :rules="[v => !!v || $t('npcs.nameRequired')]"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="npcForm.description"
              :label="$t('npcs.description')"
              variant="outlined"
              rows="4"
              class="mb-4"
            />

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  :key="`race-${locale}`"
                  v-model="npcForm.metadata.race"
                  :items="raceItems"
                  :label="$t('npcs.race')"
                  variant="outlined"
                  clearable
                  item-title="title"
                  item-value="value"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  :key="`class-${locale}`"
                  v-model="npcForm.metadata.class"
                  :items="classItems"
                  :label="$t('npcs.class')"
                  variant="outlined"
                  clearable
                  item-title="title"
                  item-value="value"
                />
              </v-col>
            </v-row>

            <v-text-field
              v-model="npcForm.metadata.location"
              :label="$t('npcs.location')"
              variant="outlined"
              class="mb-4"
            />

            <v-text-field
              v-model="npcForm.metadata.faction"
              :label="$t('npcs.faction')"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="npcForm.metadata.relationship"
              :label="$t('npcs.relationship')"
              variant="outlined"
              rows="2"
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
            :disabled="!npcForm.name"
            :loading="saving"
            @click="saveNpc"
          >
            {{ editingNpc ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Note Create/Edit Dialog -->
    <v-dialog
      v-model="showNoteDialog"
      max-width="700"
    >
      <v-card>
        <v-card-title>
          {{ editingNote ? $t('npcs.editNote') : $t('npcs.newNote') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="noteForm.title"
            :label="$t('npcs.noteTitle')"
            :placeholder="$t('npcs.noteTitlePlaceholder')"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="noteForm.summary"
            :label="$t('npcs.noteContent')"
            :placeholder="$t('npcs.noteContentPlaceholder')"
            :rules="[v => !!v || $t('npcs.noteContentRequired')]"
            variant="outlined"
            rows="6"
            class="mb-4"
          />

          <v-text-field
            v-model="noteForm.date"
            :label="$t('npcs.noteDate')"
            type="datetime-local"
            variant="outlined"
            class="mb-4"
          />

          <v-textarea
            v-model="noteForm.notes"
            :label="$t('npcs.noteDetails')"
            :placeholder="$t('npcs.noteDetailsPlaceholder')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="closeNoteDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!noteForm.summary"
            :loading="savingNote"
            @click="saveNote"
          >
            {{ editingNote ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Note Confirmation -->
    <v-dialog
      v-model="showDeleteNoteDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ $t('npcs.deleteNoteTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('npcs.deleteNoteConfirm') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeleteNoteDialog = false"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="deletingNoteLoading"
            @click="confirmDeleteNote"
          >
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Relation Dialog -->
    <v-dialog
      v-model="showEditRelationDialog"
      max-width="600"
    >
      <v-card v-if="editingRelation">
        <v-card-title>{{ $t('npcs.editRelation') }}</v-card-title>
        <v-card-text>
          <v-text-field
            :model-value="editingRelation.to_entity_name"
            :label="$t('npcs.location')"
            variant="outlined"
            readonly
            disabled
            class="mb-3"
          />

          <v-combobox
            v-model="relationEditForm.relationType"
            :items="relationTypeSuggestions"
            :label="$t('npcs.relationType')"
            variant="outlined"
            class="mb-3"
          />

          <v-textarea
            v-model="relationEditForm.notes"
            :label="$t('npcs.relationNotes')"
            :placeholder="$t('npcs.relationNotesPlaceholder')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="closeEditRelationDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="savingRelation"
            @click="saveRelation"
          >
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('npcs.deleteTitle')"
      :message="$t('npcs.deleteConfirm', { name: deletingNpc?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { NPC, NpcType, NpcStatus } from '../../../types/npc'
import { NPC_TYPES, NPC_STATUSES } from '../../../types/npc'

const { t, locale } = useI18n()
const router = useRouter()

// Use image download composable
const { downloadImage } = useImageDownload()

// Auto-imported stores
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()

// Get active campaign from campaign store
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Check if campaign is selected
onMounted(async () => {
  // Initialize campaign from cookie
  campaignStore.initFromCookie()

  if (!activeCampaignId.value) {
    router.push('/campaigns')
    return
  }

  // Load entities for this campaign
  await Promise.all([
    entitiesStore.fetchNPCs(activeCampaignId.value),
    entitiesStore.fetchLocations(activeCampaignId.value),
    entitiesStore.fetchFactions(activeCampaignId.value),
    entitiesStore.fetchItems(activeCampaignId.value),
  ])

  // Load races and classes for dropdowns
  await loadReferenceData()
})

// Search with FTS5
const route = useRoute()
const searchQuery = ref('')
const searchResults = ref<NPC[]>([])
const searching = ref(false)

// Highlighted NPC (from global search)
const highlightedId = ref<number | null>(null)
const isFromGlobalSearch = ref(false)

// Initialize from URL query parameters
function initializeFromQuery() {
  if (route.query.search && typeof route.query.search === 'string') {
    searchQuery.value = route.query.search
    isFromGlobalSearch.value = true
  }
  if (route.query.highlight && typeof route.query.highlight === 'string') {
    highlightedId.value = parseInt(route.query.highlight, 10)
    // Auto-scroll to highlighted card after a short delay
    setTimeout(() => {
      const element = document.getElementById(`npc-${highlightedId.value}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 500)
  }
}

onMounted(() => {
  initializeFromQuery()
})

// Watch for route changes (same-page navigation)
watch(() => route.query, () => {
  // Clear previous highlight
  highlightedId.value = null
  isFromGlobalSearch.value = false
  // Re-initialize from new query
  initializeFromQuery()
}, { deep: true })

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

// Get data from stores
const npcs = computed(() => entitiesStore.npcs)
const locations = computed(() => entitiesStore.locationsForSelect)
const factions = computed(() => entitiesStore.factionsForSelect)
const items = computed(() => entitiesStore.itemsForSelect)

// Reference data for dropdowns
const races = ref<Array<{ id: number, name: string, name_de?: string | null, name_en?: string | null, key: string, description: string }>>([])
const classes = ref<Array<{ id: number, name: string, name_de?: string | null, name_en?: string | null, key: string, description: string }>>([])

// Load reference data
async function loadReferenceData() {
  const [racesData, classesData] = await Promise.all([
    $fetch<Array<{ id: number, name: string, name_de?: string | null, name_en?: string | null, key: string, description: string }>>('/api/races'),
    $fetch<Array<{ id: number, name: string, name_de?: string | null, name_en?: string | null, key: string, description: string }>>('/api/classes'),
  ])
  races.value = racesData
  classes.value = classesData
}

// Helper functions to get race/class display name from string key
function getRaceDisplayName(raceName: string | undefined): string {
  if (!raceName) return ''
  const race = races.value.find(r => r.name === raceName)
  return race ? useRaceName(race) : raceName
}

function getClassDisplayName(className: string | undefined): string {
  if (!className) return ''
  const classData = classes.value.find(c => c.name === className)
  return classData ? useClassName(classData) : className
}

// Translated race/class items for dropdowns (uses DB translations or i18n fallback)
const raceItems = computed(() => {
  return races.value.map(r => ({
    title: useRaceName(r),
    value: r.name,
  }))
})
const classItems = computed(() => {
  return classes.value.map(c => ({
    title: useClassName(c),
    value: c.name,
  }))
})

// Debounced search with abort controller
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

// Search execution function (extracted for reuse)
async function executeSearch(query: string) {
  if (!activeCampaignId.value)
    return

  // Abort previous search if still running
  if (abortController) {
    abortController.abort()
  }

  // Create new abort controller for this search
  abortController = new AbortController()

  searching.value = true
  try {
    const results = await $fetch<NPC[]>('/api/npcs', {
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
  }
  catch (error: unknown) {
    // Ignore abort errors (expected when user types fast)
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      console.log('Search aborted (new search started)')
      return
    }
    console.error('Search failed:', error)
    searchResults.value = []
  }
  finally {
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

  // If empty, show all NPCs from store
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

// Re-trigger search when locale changes (no debounce)
watch(locale, () => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    executeSearch(searchQuery.value)
  }
})

// Show search results if searching, otherwise show all NPCs from store
const filteredNpcs = computed(() => {
  // If user is typing but search hasn't returned yet, show cached NPCs (prevents "empty" flash)
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    // If search is running but no results yet, keep showing cached NPCs
    if (searching.value && searchResults.value.length === 0) {
      return npcs.value || []
    }
    return searchResults.value
  }
  return npcs.value || []
})

// Form state
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const editingNpc = ref<NPC | null>(null)
const deletingNpc = ref<NPC | null>(null)
const saving = ref(false)
const deleting = ref(false)
const npcDialogTab = ref('details')

const npcForm = ref({
  name: '',
  description: '',
  metadata: {
    race: '',
    class: '',
    location: '',
    faction: '',
    relationship: '',
    type: undefined as NpcType | undefined,
    status: undefined as NpcStatus | undefined,
  },
})

// Image upload state
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)

// Trigger native file input
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// Handle image upload
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length || !editingNpc.value)
    return

  const file = target.files[0]
  if (!file) return

  uploadingImage.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ success: boolean, imageUrl: string }>(`/api/entities/${editingNpc.value.id}/upload-image`, {
      method: 'POST',
      body: formData,
    })

    if (response.success) {
      // Update the editing NPC with new image URL
      editingNpc.value.image_url = response.imageUrl
      // Refresh the list
      await entitiesStore.fetchNPCs(activeCampaignId.value!)
      // Reset input
      target.value = ''
    }
  }
  catch (error) {
    console.error('Failed to upload image:', error)
    alert(t('npcs.uploadImageError'))
  }
  finally {
    uploadingImage.value = false
  }
}

// Delete image function
async function deleteImage() {
  if (!editingNpc.value?.image_url)
    return

  deletingImage.value = true

  try {
    await $fetch<{ success: boolean }>(`/api/entities/${editingNpc.value.id}/delete-image`, {
      method: 'DELETE' as const,
    })

    // Update the editing NPC
    editingNpc.value.image_url = null
    // Refresh the list
    await entitiesStore.fetchNPCs(activeCampaignId.value!)
  }
  catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('npcs.deleteImageError'))
  }
  finally {
    deletingImage.value = false
  }
}

// NPC Types for select
const npcTypes = computed(() =>
  NPC_TYPES.map(type => ({
    value: type,
    title: t(`npcs.types.${type}`),
  })),
)

// NPC Statuses for select
const npcStatuses = computed(() =>
  NPC_STATUSES.map(status => ({
    value: status,
    title: t(`npcs.statuses.${status}`),
  })),
)

// Get icon for NPC type
function getNpcTypeIcon(type: NpcType): string {
  const iconMap: Record<NpcType, string> = {
    ally: 'mdi-handshake',
    enemy: 'mdi-skull',
    neutral: 'mdi-account-circle',
    questgiver: 'mdi-message-question',
    merchant: 'mdi-storefront',
    guard: 'mdi-shield-account',
    noble: 'mdi-crown',
    commoner: 'mdi-account',
    villain: 'mdi-skull-crossbones',
    mentor: 'mdi-book-open-variant',
    companion: 'mdi-account-heart',
    informant: 'mdi-information',
  }
  return iconMap[type] || 'mdi-account'
}

// Get icon for NPC status
function getNpcStatusIcon(status: NpcStatus): string {
  const iconMap: Record<NpcStatus, string> = {
    alive: 'mdi-heart-pulse',
    dead: 'mdi-skull',
    missing: 'mdi-help-circle',
    imprisoned: 'mdi-lock',
    unknown: 'mdi-help',
  }
  return iconMap[status] || 'mdi-help'
}

// Get color for NPC status
function getNpcStatusColor(status: NpcStatus): string {
  const colorMap: Record<NpcStatus, string> = {
    alive: 'success',
    dead: 'grey-darken-2',
    missing: 'warning',
    imprisoned: 'error',
    unknown: 'grey',
  }
  return colorMap[status] || 'grey'
}

// NPC Relations state
const npcRelations = ref<Array<{
  id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: string | null
}>>([])

const newRelation = ref({
  locationId: null as number | null,
  relationType: '',
  notes: '',
})

const addingRelation = ref(false)

// Relation editing state
const showEditRelationDialog = ref(false)
const editingRelation = ref<typeof npcRelations.value[0] | null>(null)
const savingRelation = ref(false)
const relationEditForm = ref({
  relationType: '',
  notes: '',
})

// Suggested relation types (i18n)
const relationTypeSuggestions = computed(() => [
  t('npcs.relationTypes.livesIn'),
  t('npcs.relationTypes.worksAt'),
  t('npcs.relationTypes.visitsOften'),
  t('npcs.relationTypes.bornIn'),
  t('npcs.relationTypes.hidesIn'),
  t('npcs.relationTypes.owns'),
  t('npcs.relationTypes.searchesFor'),
  t('npcs.relationTypes.banishedFrom'),
])

// Memberships state (all relations loaded from API)
interface Relation {
  id: number
  from_entity_id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
}

const allRelations = ref<Relation[]>([])
const loadingRelations = ref(false)

// Computed: Filter faction memberships
const factionMemberships = computed(() =>
  allRelations.value.filter(rel => rel.to_entity_type === 'Faction'),
)

// Computed: Filter NPC relations
const npcRelationsList = computed(() =>
  allRelations.value.filter(rel => rel.to_entity_type === 'NPC'),
)

// Computed: Other NPCs (excluding current one)
const otherNpcs = computed(() => {
  if (!npcs.value || !editingNpc.value)
    return []
  return npcs.value.filter((npc: NPC) => npc.id !== editingNpc.value?.id)
})

// New membership state
const newMembership = ref({
  factionId: null as number | null,
  relationType: '',
  rank: '',
})
const addingMembership = ref(false)

// Suggested membership types (i18n)
const membershipTypeSuggestions = computed(() => [
  t('npcs.membershipTypes.member'),
  t('npcs.membershipTypes.leader'),
  t('npcs.membershipTypes.founder'),
  t('npcs.membershipTypes.officer'),
  t('npcs.membershipTypes.recruit'),
  t('npcs.membershipTypes.veteran'),
  t('npcs.membershipTypes.exile'),
])

// New NPC relation state
const newNpcRelation = ref({
  npcId: null as number | null,
  relationType: '',
})
const addingNpcRelation = ref(false)

// Suggested NPC relation types (i18n)
const npcRelationTypeSuggestions = computed(() => [
  t('npcs.npcRelationTypes.ally'),
  t('npcs.npcRelationTypes.enemy'),
  t('npcs.npcRelationTypes.family'),
  t('npcs.npcRelationTypes.friend'),
  t('npcs.npcRelationTypes.rival'),
  t('npcs.npcRelationTypes.mentor'),
  t('npcs.npcRelationTypes.student'),
  t('npcs.npcRelationTypes.colleague'),
])

// Items state
const npcItems = ref<Array<{
  id: number
  to_entity_id: number
  item_name: string
  item_description: string | null
  item_metadata: Record<string, unknown> | null
  relation_type: string
  notes: Record<string, unknown> | null
}>>([])

const newItem = ref({
  itemId: null as number | null,
  relationType: '',
  quantity: 1,
  equipped: false,
})
const addingItem = ref(false)

// Suggested item relation types (i18n)
const itemRelationTypeSuggestions = computed(() => [
  t('npcs.itemRelationTypes.owns'),
  t('npcs.itemRelationTypes.carries'),
  t('npcs.itemRelationTypes.wields'),
  t('npcs.itemRelationTypes.wears'),
  t('npcs.itemRelationTypes.seeks'),
  t('npcs.itemRelationTypes.guards'),
  t('npcs.itemRelationTypes.stole'),
  t('npcs.itemRelationTypes.lost'),
])

// Notes state
const npcNotes = ref<Array<{
  id: number
  title: string | null
  summary: string
  date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}>>([])

const loadingNotes = ref(false)
const notesSearch = ref('')
const showNoteDialog = ref(false)
const showDeleteNoteDialog = ref(false)
const editingNote = ref<typeof npcNotes.value[0] | null>(null)
const deletingNote = ref<typeof npcNotes.value[0] | null>(null)
const savingNote = ref(false)
const deletingNoteLoading = ref(false)

const noteForm = ref({
  title: '',
  summary: '',
  date: '',
  notes: '',
})

const filteredNotes = computed(() => {
  if (!notesSearch.value)
    return npcNotes.value

  const query = notesSearch.value.toLowerCase()
  return npcNotes.value.filter(note =>
    note.title?.toLowerCase().includes(query)
    || note.summary?.toLowerCase().includes(query)
    || note.notes?.toLowerCase().includes(query),
  )
})

function truncateText(text: string, length: number) {
  if (text.length <= length)
    return text
  return `${text.substring(0, length)}...`
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadNotes() {
  if (!editingNpc.value)
    return

  loadingNotes.value = true
  try {
    const notes = await $fetch<typeof npcNotes.value>(`/api/npcs/${editingNpc.value.id}/notes`, {
      query: notesSearch.value ? { search: notesSearch.value } : {},
    })
    npcNotes.value = notes
  }
  catch (error) {
    console.error('Failed to load notes:', error)
    npcNotes.value = []
  }
  finally {
    loadingNotes.value = false
  }
}

function editNote(note: typeof npcNotes.value[0]) {
  editingNote.value = note
  noteForm.value = {
    title: note.title || '',
    summary: note.summary,
    date: note.date ? new Date(note.date).toISOString().slice(0, 16) : '',
    notes: note.notes || '',
  }
  showNoteDialog.value = true
}

async function saveNote() {
  if (!editingNpc.value || !activeCampaignId.value)
    return

  savingNote.value = true

  try {
    if (editingNote.value) {
      // Update existing note
      await $fetch<{ success: boolean }>(`/api/npcs/${editingNpc.value.id}/notes/${editingNote.value.id}`, {
        method: 'PATCH',
        body: {
          title: noteForm.value.title || null,
          summary: noteForm.value.summary,
          date: noteForm.value.date ? new Date(noteForm.value.date).toISOString() : null,
          notes: noteForm.value.notes || null,
        },
      })
    }
    else {
      // Create new note
      await $fetch(`/api/npcs/${editingNpc.value.id}/notes`, {
        method: 'POST',
        body: {
          title: noteForm.value.title || null,
          summary: noteForm.value.summary,
          date: noteForm.value.date ? new Date(noteForm.value.date).toISOString() : null,
          notes: noteForm.value.notes || null,
          campaignId: activeCampaignId.value,
        },
      })
    }

    await loadNotes()
    closeNoteDialog()
  }
  catch (error) {
    console.error('Failed to save note:', error)
  }
  finally {
    savingNote.value = false
  }
}

function deleteNote(note: typeof npcNotes.value[0]) {
  deletingNote.value = note
  showDeleteNoteDialog.value = true
}

async function confirmDeleteNote() {
  if (!deletingNote.value)
    return

  deletingNoteLoading.value = true

  try {
    await $fetch<{ success: boolean }>(`/api/npcs/${editingNpc.value!.id}/notes/${deletingNote.value.id}`, {
      method: 'DELETE' as const,
    })

    await loadNotes()
    showDeleteNoteDialog.value = false
    deletingNote.value = null
  }
  catch (error) {
    console.error('Failed to delete note:', error)
  }
  finally {
    deletingNoteLoading.value = false
  }
}

// Memberships functions
async function loadAllRelations() {
  if (!editingNpc.value)
    return

  loadingRelations.value = true

  try {
    const relations = await $fetch<Relation[]>(`/api/npcs/${editingNpc.value.id}/relations`)
    allRelations.value = relations
  }
  catch (error) {
    console.error('Failed to load relations:', error)
    allRelations.value = []
  }
  finally {
    loadingRelations.value = false
  }
}

async function addFactionMembership() {
  if (!editingNpc.value || !newMembership.value.factionId || !newMembership.value.relationType)
    return

  addingMembership.value = true

  try {
    await $fetch(`/api/npcs/${editingNpc.value.id}/relations`, {
      method: 'POST',
      body: {
        toEntityId: newMembership.value.factionId,
        relationType: newMembership.value.relationType,
        notes: newMembership.value.rank ? { rank: newMembership.value.rank } : null,
      },
    })

    await loadAllRelations()

    // Reset form
    newMembership.value = {
      factionId: null,
      relationType: '',
      rank: '',
    }
  }
  catch (error) {
    console.error('Failed to add faction membership:', error)
  }
  finally {
    addingMembership.value = false
  }
}

function editMembership(membership: Relation) {
  // TODO: Implement edit dialog for membership
  console.log('Edit membership:', membership)
}

async function removeMembership(relationId: number) {
  try {
    await $fetch<{ success: boolean }>(`/api/relations/${relationId}`, {
      method: 'DELETE' as const,
    })
    await loadAllRelations()
  }
  catch (error) {
    console.error('Failed to remove membership:', error)
  }
}

async function addNpcRelation() {
  if (!editingNpc.value || !newNpcRelation.value.npcId || !newNpcRelation.value.relationType)
    return

  addingNpcRelation.value = true

  try {
    await $fetch(`/api/npcs/${editingNpc.value.id}/relations`, {
      method: 'POST',
      body: {
        toEntityId: newNpcRelation.value.npcId,
        relationType: newNpcRelation.value.relationType,
        notes: null,
      },
    })

    await loadAllRelations()

    // Reset form
    newNpcRelation.value = {
      npcId: null,
      relationType: '',
    }
  }
  catch (error) {
    console.error('Failed to add NPC relation:', error)
  }
  finally {
    addingNpcRelation.value = false
  }
}

function editNpcRelation(relation: Relation) {
  // TODO: Implement edit dialog for NPC relation
  console.log('Edit NPC relation:', relation)
}

async function removeNpcRelation(relationId: number) {
  try {
    await $fetch<{ success: boolean }>(`/api/relations/${relationId}`, {
      method: 'DELETE' as const,
    })
    await loadAllRelations()
  }
  catch (error) {
    console.error('Failed to remove NPC relation:', error)
  }
}

// Items functions
async function loadNpcItems() {
  if (!editingNpc.value)
    return

  try {
    const items = await $fetch<typeof npcItems.value>(`/api/npcs/${editingNpc.value.id}/items`)
    npcItems.value = items
  }
  catch (error) {
    console.error('Failed to load NPC items:', error)
    npcItems.value = []
  }
}

async function addItemToNpc() {
  if (!editingNpc.value || !newItem.value.itemId || !newItem.value.relationType)
    return

  addingItem.value = true

  try {
    await $fetch(`/api/npcs/${editingNpc.value.id}/items`, {
      method: 'POST',
      body: {
        itemId: newItem.value.itemId,
        relationType: newItem.value.relationType,
        quantity: newItem.value.quantity || undefined,
        equipped: newItem.value.equipped,
      },
    })

    await loadNpcItems()

    // Reset form
    newItem.value = {
      itemId: null,
      relationType: '',
      quantity: 1,
      equipped: false,
    }
  }
  catch (error) {
    console.error('Failed to add item to NPC:', error)
  }
  finally {
    addingItem.value = false
  }
}

async function removeItem(relationId: number) {
  try {
    await $fetch<{ success: boolean }>(`/api/relations/${relationId}`, {
      method: 'DELETE' as const,
    })
    await loadNpcItems()
  }
  catch (error) {
    console.error('Failed to remove item:', error)
  }
}

function closeNoteDialog() {
  showNoteDialog.value = false
  editingNote.value = null
  noteForm.value = {
    title: '',
    summary: '',
    date: '',
    notes: '',
  }
}

async function editNpc(npc: NPC) {
  editingNpc.value = npc
  npcForm.value = {
    name: npc.name,
    description: npc.description || '',
    metadata: {
      race: npc.metadata?.race || '',
      class: npc.metadata?.class || '',
      location: npc.metadata?.location || '',
      faction: npc.metadata?.faction || '',
      relationship: npc.metadata?.relationship || '',
      type: npc.metadata?.type,
      status: npc.metadata?.status,
    },
  }

  // Load existing relations
  try {
    const relations = await $fetch<typeof npcRelations.value>(`/api/npcs/${npc.id}/relations`)
    npcRelations.value = relations
  }
  catch (error) {
    console.error('Failed to load relations:', error)
    npcRelations.value = []
  }

  // Load notes
  await loadNotes()

  // Load all relations (memberships + NPC relations)
  await loadAllRelations()

  // Load items
  await loadNpcItems()

  showCreateDialog.value = true
  npcDialogTab.value = 'details'
}

function deleteNpc(npc: NPC) {
  deletingNpc.value = npc
  showDeleteDialog.value = true
}

async function saveNpc() {
  if (!activeCampaignId.value)
    return

  saving.value = true

  try {
    if (editingNpc.value) {
      await entitiesStore.updateNPC(editingNpc.value.id, {
        name: npcForm.value.name,
        description: npcForm.value.description,
        metadata: npcForm.value.metadata,
      })
    }
    else {
      await entitiesStore.createNPC(activeCampaignId.value, npcForm.value)
    }

    closeDialog()
  }
  catch (error) {
    console.error('Failed to save NPC:', error)
  }
  finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingNpc.value)
    return

  deleting.value = true

  try {
    await entitiesStore.deleteNPC(deletingNpc.value.id)
    showDeleteDialog.value = false
    deletingNpc.value = null
  }
  catch (error) {
    console.error('Failed to delete NPC:', error)
  }
  finally {
    deleting.value = false
  }
}

async function addLocationRelation() {
  if (!editingNpc.value || !newRelation.value.locationId)
    return

  addingRelation.value = true

  try {
    const relation = await $fetch<Relation>(`/api/npcs/${editingNpc.value.id}/relations`, {
      method: 'POST',
      body: {
        toEntityId: newRelation.value.locationId,
        relationType: newRelation.value.relationType || t('npcs.relationTypes.livesIn'),
        notes: newRelation.value.notes || null,
      },
    })

    npcRelations.value.push({
      id: relation.id,
      to_entity_id: relation.to_entity_id,
      to_entity_name: relation.to_entity_name,
      to_entity_type: relation.to_entity_type,
      relation_type: relation.relation_type,
      notes: typeof relation.notes === 'string' ? relation.notes : null,
    })
    newRelation.value = {
      locationId: null,
      relationType: '',
      notes: '',
    }
  }
  catch (error) {
    console.error('Failed to add relation:', error)
  }
  finally {
    addingRelation.value = false
  }
}

function editRelation(relation: typeof npcRelations.value[0]) {
  editingRelation.value = relation
  relationEditForm.value = {
    relationType: relation.relation_type,
    notes: relation.notes || '',
  }
  showEditRelationDialog.value = true
}

async function saveRelation() {
  if (!editingRelation.value)
    return

  savingRelation.value = true

  try {
    const updated = await $fetch<Relation>(`/api/entity-relations/${editingRelation.value.id}`, {
      method: 'PATCH' as const,
      body: {
        relationType: relationEditForm.value.relationType,
        notes: relationEditForm.value.notes || null,
      },
    })

    // Update in local array
    const index = npcRelations.value.findIndex(r => r.id === editingRelation.value!.id)
    if (index !== -1) {
      npcRelations.value[index] = updated as typeof npcRelations.value[0]
    }

    closeEditRelationDialog()
  }
  catch (error) {
    console.error('Failed to update relation:', error)
  }
  finally {
    savingRelation.value = false
  }
}

function closeEditRelationDialog() {
  showEditRelationDialog.value = false
  editingRelation.value = null
  relationEditForm.value = {
    relationType: '',
    notes: '',
  }
}

async function removeRelation(relationId: number) {
  try {
    await $fetch<{ success: boolean }>(`/api/entity-relations/${relationId}`, {
      method: 'DELETE' as const,
    })

    npcRelations.value = npcRelations.value.filter(r => r.id !== relationId)
  }
  catch (error) {
    console.error('Failed to remove relation:', error)
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingNpc.value = null
  npcRelations.value = []
  npcNotes.value = []
  notesSearch.value = ''
  npcDialogTab.value = 'details'
  allRelations.value = []
  newRelation.value = {
    locationId: null,
    relationType: '',
    notes: '',
  }
  newMembership.value = {
    factionId: null,
    relationType: '',
    rank: '',
  }
  newNpcRelation.value = {
    npcId: null,
    relationType: '',
  }
  npcForm.value = {
    name: '',
    description: '',
    metadata: {
      race: '',
      class: '',
      location: '',
      faction: '',
      relationship: '',
      type: undefined,
      status: undefined,
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

/* Highlighted card animation */
.highlighted-card {
  animation: highlight-pulse 2s ease-in-out;
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary)) !important;
}

@keyframes highlight-pulse {
  0%, 100% {
    box-shadow: 0 0 0 3px rgb(var(--v-theme-primary));
  }
  50% {
    box-shadow: 0 0 20px 5px rgb(var(--v-theme-primary));
  }
}
</style>
