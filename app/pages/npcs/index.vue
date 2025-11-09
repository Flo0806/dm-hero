<template>
  <v-container>
    <UiPageHeader :title="$t('npcs.title')" :subtitle="$t('npcs.subtitle')">
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
      <v-col v-for="i in 6" :key="i" cols="12" md="6" lg="4">
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
          <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
          <div class="text-h6">
            {{ $t('common.searching') }}
          </div>
        </div>
      </v-overlay>

      <!-- NPC Cards -->
      <v-row>
        <v-col v-for="npc in filteredNpcs" :key="npc.id" cols="12" md="6" lg="4">
          <NpcCard
            :npc="npc"
            :is-highlighted="highlightedId === npc.id"
            :races="races"
            :classes="classes"
            @view="viewNpc"
            @edit="editNpc"
            @download="(npc) => downloadImage(`/uploads/${npc.image_url}`, npc.name)"
            @delete="deleteNpc"
          />
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
            <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
              {{ $t('npcs.create') }}
            </v-btn>
          </template>
        </v-empty-state>
        <template #fallback>
          <v-container class="text-center py-16">
            <v-icon icon="mdi-account-group" size="64" color="grey" class="mb-4" />
            <h2 class="text-h5 mb-2">{{ $t('npcs.empty') }}</h2>
            <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('npcs.emptyText') }}</p>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
              {{ $t('npcs.create') }}
            </v-btn>
          </v-container>
        </template>
      </ClientOnly>
    </div>

    <!-- View NPC Dialog -->
    <NpcViewDialog
      v-model:show="showViewDialog"
      :npc="viewingNpc"
      :races="races"
      :classes="classes"
      :can-go-back="npcViewStack.length > 0"
      @edit="handleEditFromView"
      @view-npc="viewNpcById"
      @view-item="viewItemById"
      @view-location="viewLocationById"
      @go-back="goBackInNpcView"
    />

    <!-- Create/Edit Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="900" scrollable>
      <v-card>
        <v-card-title>
          {{ editingNpc ? $t('npcs.edit') : $t('npcs.create') }}
        </v-card-title>

        <v-tabs v-if="editingNpc" v-model="npcDialogTab" class="mb-4">
          <v-tab value="details">
            <v-icon start> mdi-account-details </v-icon>
            {{ $t('npcs.details') }}
          </v-tab>
          <v-tab value="npcRelations">
            <v-icon start> mdi-account-multiple </v-icon>
            {{ $t('npcs.npcRelations') }}
            ({{ npcRelations.filter((r) => r.to_entity_type === 'NPC').length }})
          </v-tab>
          <v-tab value="locations">
            <v-icon start> mdi-map-marker </v-icon>
            {{ $t('npcs.linkedLocations') }}
            ({{ npcRelations.filter((r) => r.to_entity_type === 'Location').length }})
          </v-tab>
          <v-tab value="memberships">
            <v-icon start> mdi-shield-account </v-icon>
            {{ $t('npcs.memberships') }} ({{ factionMemberships.length }})
          </v-tab>
          <v-tab value="items">
            <v-icon start> mdi-sword </v-icon>
            {{ $t('npcs.items') }} ({{ npcItems.length }})
          </v-tab>
          <v-tab value="notes">
            <v-icon start> mdi-note-text </v-icon>
            {{ $t('npcs.notes') }} ({{ npcNotes.length }})
          </v-tab>
          <v-tab value="documents">
            <v-icon start> mdi-file-document </v-icon>
            {{ $t('documents.title') }} ({{ editingNpc?._counts?.documents || 0 }})
          </v-tab>
          <v-tab value="lore">
            <v-icon start> mdi-book-open-variant </v-icon>
            {{ $t('lore.title') }} ({{ linkedLore.length }})
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
                    <!-- Image Preview -->
                    <div style="position: relative">
                      <v-avatar
                        size="160"
                        rounded="lg"
                        :color="editingNpc?.image_url ? undefined : 'grey-lighten-2'"
                        :style="editingNpc?.image_url ? 'cursor: pointer;' : ''"
                        @click="
                          editingNpc?.image_url
                            ? openImagePreview(`/uploads/${editingNpc.image_url}`, npcForm.name)
                            : null
                        "
                      >
                        <v-img
                          v-if="editingNpc?.image_url"
                          :src="`/uploads/${editingNpc.image_url}`"
                          cover
                          :class="{ 'blur-image': uploadingImage || generatingImage }"
                        />
                        <v-icon
                          v-else-if="!uploadingImage && !generatingImage"
                          icon="mdi-account"
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
                          editingNpc?.image_url ? $t('npcs.changeImage') : $t('npcs.uploadImage')
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
                        {{ $t('npcs.generateImage') }}
                      </v-btn>

                      <!-- Download Button (only if image exists) -->
                      <v-btn
                        v-if="editingNpc?.image_url"
                        prepend-icon="mdi-download"
                        variant="outlined"
                        block
                        class="mb-2"
                        :disabled="uploadingImage || generatingImage"
                        @click="downloadImage(`/uploads/${editingNpc.image_url}`, npcForm.name)"
                      >
                        Download
                      </v-btn>

                      <!-- Delete Button (only if image exists) -->
                      <v-btn
                        v-if="editingNpc?.image_url"
                        prepend-icon="mdi-delete"
                        color="error"
                        variant="outlined"
                        block
                        :loading="deletingImage"
                        :disabled="uploadingImage || generatingImage"
                        @click="deleteImage"
                      >
                        {{ $t('npcs.deleteImage') }}
                      </v-btn>

                      <!-- AI Hint -->
                      <div v-if="!hasApiKey" class="text-caption text-medium-emphasis mt-3">
                        <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
                        KI-Generierung: OpenAI API-Key in Einstellungen hinterlegen
                      </div>
                      <div v-else-if="!npcForm.name" class="text-caption text-medium-emphasis mt-3">
                        <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
                        KI-Generierung: Bitte zuerst einen Namen eingeben
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>

              <v-text-field
                v-model="npcForm.name"
                :label="$t('npcs.name')"
                :rules="[(v: string) => !!v || $t('npcs.nameRequired')]"
                variant="outlined"
                class="mb-4"
              >
                <template #append-inner>
                  <v-btn
                    :loading="generatingName"
                    icon="mdi-auto-fix"
                    variant="text"
                    size="small"
                    color="primary"
                    @click="generateName"
                  />
                </template>
              </v-text-field>

              <v-textarea
                v-model="npcForm.description"
                :label="$t('npcs.description')"
                variant="outlined"
                rows="4"
                class="mb-4"
              />

              <!-- Race & Class -->
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

              <!-- Age & Gender -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="npcForm.metadata.age"
                    :label="$t('npcs.age')"
                    variant="outlined"
                    type="number"
                    min="0"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="npcForm.metadata.gender"
                    :label="$t('npcs.gender')"
                    :items="genderItems"
                    variant="outlined"
                    clearable
                  />
                </v-col>
              </v-row>

              <!-- Type & Status -->
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
                          <v-icon
                            :icon="getNpcStatusIcon(item.value)"
                            :color="getNpcStatusColor(item.value)"
                          />
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
            </v-tabs-window-item>

            <!-- NPC Relations Tab -->
            <v-tabs-window-item value="npcRelations">
              <v-list
                v-if="
                  editingNpc &&
                  npcRelations.filter((r: (typeof npcRelations)[0]) => r.to_entity_type === 'NPC').length >
                    0
                "
                class="mb-3"
              >
                <v-list-item
                  v-for="relation in npcRelations.filter(
                    (r: (typeof npcRelations)[0]) => r.to_entity_type === 'NPC',
                  )"
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
                    <v-chip size="small" class="mr-1" color="primary" variant="tonal">
                      {{ $t(`npcs.npcRelationTypes.${relation.relation_type}`, relation.relation_type) }}
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
                    <v-icon start> mdi-plus </v-icon>
                    {{ $t('npcs.addNpcRelation') }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-select
                      v-model="newNpcRelation.npcId"
                      :items="npcsForSelect || []"
                      item-title="name"
                      item-value="id"
                      :label="$t('npcs.selectNpc')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-combobox
                      v-model="newNpcRelation.relationType"
                      :items="npcRelationTypeSuggestions"
                      :label="$t('npcs.npcRelationType')"
                      :placeholder="$t('npcs.npcRelationTypePlaceholder')"
                      variant="outlined"
                      class="mb-3"
                    />

                    <v-textarea
                      v-model="newNpcRelation.notes"
                      :label="$t('npcs.relationNotes')"
                      :placeholder="$t('npcs.relationNotesPlaceholder')"
                      variant="outlined"
                      rows="2"
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

            <!-- Locations Tab -->
            <v-tabs-window-item value="locations">
              <v-list
                v-if="
                  editingNpc &&
                  npcRelations.filter(
                    (r: (typeof npcRelations)[0]) => r.to_entity_type === 'Location',
                  ).length > 0
                "
                class="mb-3"
              >
                <v-list-item
                  v-for="relation in npcRelations.filter(
                    (r: (typeof npcRelations)[0]) => r.to_entity_type === 'Location',
                  )"
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
                    <v-icon start> mdi-plus </v-icon>
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
                    <v-icon start> mdi-plus </v-icon>
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
            </v-tabs-window-item>

            <!-- Items Tab -->
            <v-tabs-window-item value="items">
              <div class="text-h6 mb-4">
                {{ $t('npcs.itemsList') }}
              </div>

              <v-list v-if="npcItems.length > 0" class="mb-3">
                <v-list-item v-for="item in npcItems" :key="item.id" class="mb-2" border>
                  <template #prepend>
                    <v-icon icon="mdi-sword" color="primary" />
                  </template>
                  <v-list-item-title>
                    {{ item.name }}
                    <v-chip v-if="item.equipped" size="x-small" color="success" class="ml-2">
                      {{ $t('npcs.equipped') }}
                    </v-chip>
                    <v-chip v-if="item.rarity" size="x-small" :color="getRarityColor(item.rarity)" class="ml-2">
                      {{ $t(`items.rarities.${item.rarity}`) }}
                    </v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip size="small" class="mr-1" color="primary" variant="tonal">
                      {{ $t(`npcs.itemRelationTypes.${item.relation_type}`, item.relation_type) }}
                    </v-chip>
                    <span v-if="item.quantity && item.quantity > 1" class="text-caption mr-2">
                      {{ item.quantity }}x
                    </span>
                    <span v-if="item.description" class="text-caption text-medium-emphasis">
                      {{ item.description }}
                    </span>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeItem(item.relation_id)"
                    />
                  </template>
                </v-list-item>
              </v-list>

              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon start> mdi-plus </v-icon>
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
                <v-btn color="primary" prepend-icon="mdi-plus" @click="showNoteDialog = true">
                  {{ $t('npcs.newNote') }}
                </v-btn>
              </div>

              <v-progress-linear v-if="loadingNotes" indeterminate />

              <v-list v-else-if="filteredNotes.length > 0">
                <v-list-item v-for="note in filteredNotes" :key="note.id" class="mb-2" border>
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
                    <v-btn icon="mdi-pencil" variant="text" size="small" @click="editNote(note)" />
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

            <!-- Lore Tab -->
            <v-tabs-window-item value="lore">
              <div v-if="editingNpc">
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
          </v-tabs-window>

          <!-- Create Form (no tabs) -->
          <div v-if="!editingNpc">
            <v-text-field
              v-model="npcForm.name"
              :label="$t('npcs.name')"
              :rules="[(v: string) => !!v || $t('npcs.nameRequired')]"
              variant="outlined"
              class="mb-4"
            >
              <template #append-inner>
                <v-btn
                  :loading="generatingName"
                  icon="mdi-auto-fix"
                  variant="text"
                  size="small"
                  color="primary"
                  @click="generateName"
                />
              </template>
            </v-text-field>

            <v-textarea
              v-model="npcForm.description"
              :label="$t('npcs.description')"
              variant="outlined"
              rows="4"
              class="mb-4"
            />

            <!-- Race & Class -->
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

            <!-- Age & Gender -->
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="npcForm.metadata.age"
                  :label="$t('npcs.age')"
                  variant="outlined"
                  type="number"
                  min="0"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="npcForm.metadata.gender"
                  :label="$t('npcs.gender')"
                  :items="genderItems"
                  variant="outlined"
                  clearable
                />
              </v-col>
            </v-row>

            <!-- Type & Status -->
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
                        <v-icon
                          :icon="getNpcStatusIcon(item.value)"
                          :color="getNpcStatusColor(item.value)"
                        />
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
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="saving || uploadingImage || deletingImage || generatingImage"
            @click="closeDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!npcForm.name || uploadingImage || deletingImage || generatingImage"
            :loading="saving"
            @click="saveNpc"
          >
            {{ editingNpc ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Note Create/Edit Dialog -->
    <v-dialog v-model="showNoteDialog" max-width="700">
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
            :rules="[(v: string) => !!v || $t('npcs.noteContentRequired')]"
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
          <v-btn variant="text" @click="closeNoteDialog">
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
    <v-dialog v-model="showDeleteNoteDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('npcs.deleteNoteTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('npcs.deleteNoteConfirm') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteNoteDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" :loading="deletingNoteLoading" @click="confirmDeleteNote">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Relation Dialog -->
    <v-dialog v-model="showEditRelationDialog" max-width="600">
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
          <v-btn variant="text" @click="closeEditRelationDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="savingRelation" @click="saveRelation">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Membership Dialog -->
    <v-dialog v-model="showEditMembershipDialog" max-width="600">
      <v-card v-if="editingMembership">
        <v-card-title>{{ $t('npcs.editMembership') }}</v-card-title>
        <v-card-text>
          <v-text-field
            :model-value="editingMembership.to_entity_name"
            :label="$t('npcs.faction')"
            variant="outlined"
            readonly
            disabled
            class="mb-3"
          />

          <v-combobox
            v-model="membershipEditForm.relationType"
            :items="membershipTypeSuggestions"
            :label="$t('npcs.membershipType')"
            variant="outlined"
            class="mb-3"
          />

          <v-text-field
            v-model="membershipEditForm.rank"
            :label="$t('npcs.rank')"
            :placeholder="$t('npcs.rankPlaceholder')"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeEditMembershipDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="savingMembership" @click="saveMembership">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <ImagePreviewDialog
      v-model="showImagePreview"
      :image-url="previewImageUrl"
      :title="previewImageTitle"
      :download-file-name="previewImageTitle"
    />

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
import NpcCard from '~/components/npcs/NpcCard.vue'
import NpcViewDialog from '~/components/npcs/NpcViewDialog.vue'
import EntityDocuments from '~/components/shared/EntityDocuments.vue'
import ImagePreviewDialog from '~/components/shared/ImagePreviewDialog.vue'

const { t, locale } = useI18n()
const router = useRouter()

// Use image download composable
const { downloadImage } = useImageDownload()

// Use NPC counts composable
const { loadNpcCountsBatch, reloadNpcCounts } = useNpcCounts()

// Image Preview
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

function openImagePreview(imageUrl: string, title: string) {
  previewImageUrl.value = imageUrl
  previewImageTitle.value = title
  showImagePreview.value = true
}

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
    entitiesStore.fetchLore(activeCampaignId.value),
  ])

  // Load races and classes for dropdowns
  await loadReferenceData()

  // Load counts for all NPCs asynchronously (in background)
  if (entitiesStore.npcs) {
    loadNpcCountsBatch(entitiesStore.npcs)
  }
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
watch(
  () => route.query,
  () => {
    // Clear previous highlight
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

// Get data from stores
const npcs = computed(() => entitiesStore.npcs)
const locations = computed(() => entitiesStore.locationsForSelect)
const factions = computed(() => entitiesStore.factionsForSelect)
const items = computed(() => entitiesStore.itemsForSelect)

// Reference data for dropdowns
const races = ref<
  Array<{
    id: number
    name: string
    name_de?: string | null
    name_en?: string | null
    key: string
    description: string
  }>
>([])
const classes = ref<
  Array<{
    id: number
    name: string
    name_de?: string | null
    name_en?: string | null
    key: string
    description: string
  }>
>([])

// Load reference data
async function loadReferenceData() {
  const [racesData, classesData] = await Promise.all([
    $fetch<
      Array<{
        id: number
        name: string
        name_de?: string | null
        name_en?: string | null
        key: string
        description: string
      }>
    >('/api/races'),
    $fetch<
      Array<{
        id: number
        name: string
        name_de?: string | null
        name_en?: string | null
        key: string
        description: string
      }>
    >('/api/classes'),
  ])
  races.value = racesData
  classes.value = classesData
}

// Helper functions to get race/class display name from string key
function getRaceDisplayName(raceName: string | undefined): string {
  if (!raceName) return ''
  const race = races.value.find((r) => r.name === raceName)
  return race ? useRaceName(race) : raceName
}

function getClassDisplayName(className: string | undefined): string {
  if (!className) return ''
  const classData = classes.value.find((c) => c.name === className)
  return classData ? useClassName(classData) : className
}

// Translated race/class items for dropdowns (uses DB translations or i18n fallback)
// IMPORTANT: We read locale.value to make this computed reactive to language changes
const raceItems = computed(() => {
  const _lang = locale.value // Track locale dependency
  return races.value.map((r: (typeof races.value)[0]) => ({
    title: useRaceName(r),
    value: r.name,
  }))
})
const classItems = computed(() => {
  const _lang = locale.value // Track locale dependency
  return classes.value.map((c: (typeof classes.value)[0]) => ({
    title: useClassName(c),
    value: c.name,
  }))
})

const genderItems = computed(() => {
  return [
    { title: t('npcs.genders.male'), value: 'male' },
    { title: t('npcs.genders.female'), value: 'female' },
    { title: t('npcs.genders.nonbinary'), value: 'nonbinary' },
    { title: t('npcs.genders.other'), value: 'other' },
    { title: t('npcs.genders.unknown'), value: 'unknown' },
  ]
})

// Debounced search with abort controller
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

// Search execution function (extracted for reuse)
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

    // Load counts for search results in background
    if (results.length > 0) {
      loadNpcCountsBatch(results)
    }
  } catch (error: unknown) {
    // Ignore abort errors (expected when user types fast)
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      console.log('Search aborted (new search started)')
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

// Show search results OR cached NPCs
const filteredNpcs = computed(() => {
  // If user is actively searching, show search results
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return searchResults.value
  }

  // Otherwise show all cached NPCs
  return npcs.value || []
})

// Form state
const showViewDialog = ref(false)
const viewingNpc = ref<NPC | null>(null)
// Stack for nested NPC views (when clicking relations in view dialog)
const npcViewStack = ref<NPC[]>([])
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const editingNpc = ref<NPC | null>(null)
const deletingNpc = ref<NPC | null>(null)
const saving = ref(false)
const deleting = ref(false)
const npcDialogTab = ref('details')

// Lore linking
const linkedLore = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const selectedLoreId = ref<number | null>(null)
const loadingLore = ref(false)

const npcForm = ref({
  name: '',
  description: '',
  metadata: {
    race: '',
    class: '',
    type: undefined as NpcType | undefined,
    status: undefined as NpcStatus | undefined,
    age: undefined as number | undefined,
    gender: undefined as string | undefined,
  },
})

// Note: Unsaved changes tracking removed for simplicity
// User can generate images anytime as long as they have a name and API key

// Check if API key is configured
const hasApiKey = ref(false)

// Check API key on mount
onMounted(async () => {
  try {
    const response = await $fetch<{ hasKey: boolean }>('/api/settings/check-api-key')
    hasApiKey.value = response.hasKey
    console.log('[NPC] API Key check result:', response.hasKey)
  } catch (error) {
    console.error('[NPC] API Key check failed:', error)
    hasApiKey.value = false
  }
})

// Computed for generate button disabled state
const generateButtonDisabled = computed(() => {
  const isDisabled =
    uploadingImage.value || deletingImage.value || !npcForm.value.name || !hasApiKey.value
  return isDisabled
})

// Image upload state
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const deletingImage = ref(false)
const generatingImage = ref(false)

// Trigger native file input
function triggerImageUpload() {
  fileInputRef.value?.click()
}

// Handle image upload
async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || !target.files.length || !editingNpc.value) return

  const file = target.files[0]
  if (!file) return

  uploadingImage.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ success: boolean; imageUrl: string }>(
      `/api/entities/${editingNpc.value.id}/upload-image`,
      {
        method: 'POST',
        body: formData,
      },
    )

    if (response.success) {
      // Update the editing NPC with new image URL
      editingNpc.value.image_url = response.imageUrl

      // Update store reactively (no fetch needed!)
      const npcInStore = entitiesStore.npcs.find((n) => n.id === editingNpc.value!.id)
      if (npcInStore) {
        npcInStore.image_url = response.imageUrl
      }

      // Reset input
      target.value = ''
    }
  } catch (error) {
    console.error('Failed to upload image:', error)
    alert(t('npcs.uploadImageError'))
  } finally {
    uploadingImage.value = false
  }
}

// Delete image function
// AI Image Generation
async function generateImage() {
  if (!editingNpc.value || !npcForm.value.name) return

  generatingImage.value = true

  try {
    // Build detailed prompt from all available NPC data
    const details = []

    // Race and Class (most important for visual appearance)
    if (npcForm.value.metadata.race) {
      details.push(npcForm.value.metadata.race)
    }
    if (npcForm.value.metadata.class) {
      details.push(npcForm.value.metadata.class)
    }

    // Name (required)
    details.push(npcForm.value.name)

    // Description (free-form details)
    if (npcForm.value.description) {
      details.push(npcForm.value.description)
    }

    // Type (ally, enemy, neutral, etc.) - adds context
    if (npcForm.value.metadata.type) {
      const typeTranslations: Record<string, string> = {
        ally: 'friendly ally',
        enemy: 'menacing enemy',
        neutral: 'neutral character',
        questgiver: 'wise quest giver',
        merchant: 'merchant',
        guard: 'guard',
        noble: 'noble',
        commoner: 'commoner',
        villain: 'villainous',
        mentor: 'wise mentor',
        companion: 'loyal companion',
        informant: 'secretive informant',
      }
      const typeDesc = typeTranslations[npcForm.value.metadata.type] || npcForm.value.metadata.type
      details.push(typeDesc)
    }

    // Status (alive, undead, etc.) - affects appearance
    if (npcForm.value.metadata.status) {
      const statusTranslations: Record<string, string> = {
        alive: '',
        dead: '',
        missing: '',
        imprisoned: 'wearing chains',
        unknown: '',
        undead: 'undead, pale skin, glowing eyes',
      }
      const statusDesc = statusTranslations[npcForm.value.metadata.status]
      if (statusDesc) {
        details.push(statusDesc)
      }
    }

    const prompt = details.filter((d) => d).join(', ')

    const result = await $fetch<{ imageUrl: string; revisedPrompt?: string }>(
      '/api/ai/generate-image',
      {
        method: 'POST',
        body: {
          prompt,
          entityName: npcForm.value.name,
          entityType: 'NPC',
          style: 'fantasy-art',
        },
      },
    )

    if (result.imageUrl && editingNpc.value) {
      // Update the NPC with the generated image
      const response = await $fetch<{ success: boolean }>(
        `/api/entities/${editingNpc.value.id}/set-image`,
        {
          method: 'POST',
          body: {
            imageUrl: result.imageUrl.replace('/uploads/', ''), // Remove /uploads/ prefix
          },
        },
      )

      if (response.success) {
        // Update local NPC
        const imageUrl = result.imageUrl.replace('/uploads/', '')
        editingNpc.value.image_url = imageUrl

        // Update store reactively (no fetch needed!)
        const npcInStore = entitiesStore.npcs.find((n) => n.id === editingNpc.value!.id)
        if (npcInStore) {
          npcInStore.image_url = imageUrl
        }
      }
    }
  } catch (error: unknown) {
    console.error('[NPC] Failed to generate image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image'
    alert(errorMessage)
  } finally {
    generatingImage.value = false
  }
}

async function deleteImage() {
  if (!editingNpc.value?.image_url) return

  deletingImage.value = true

  try {
    await $fetch<{ success: boolean }>(`/api/entities/${editingNpc.value.id}/delete-image`, {
      method: 'DELETE' as const,
    })

    // Update the editing NPC
    editingNpc.value.image_url = null

    // Update store reactively (no fetch needed!)
    const npcInStore = entitiesStore.npcs.find((n) => n.id === editingNpc.value!.id)
    if (npcInStore) {
      npcInStore.image_url = null
    }
  } catch (error) {
    console.error('Failed to delete image:', error)
    alert(t('npcs.deleteImageError'))
  } finally {
    deletingImage.value = false
  }
}

// NPC Types for select
const npcTypes = computed(() =>
  NPC_TYPES.map((type: (typeof NPC_TYPES)[number]) => ({
    value: type,
    title: t(`npcs.types.${type}`),
  })),
)

// NPC Statuses for select
const npcStatuses = computed(() =>
  NPC_STATUSES.map((status: (typeof NPC_STATUSES)[number]) => ({
    value: status,
    title: t(`npcs.statuses.${status}`),
  })),
)

// Get icon for NPC type
// NPC Relations state
const npcRelations = ref<
  Array<{
    id: number
    to_entity_id: number
    to_entity_name: string
    to_entity_type: string
    relation_type: string
    notes: string | null
  }>
>([])

const newRelation = ref({
  locationId: null as number | null,
  relationType: '',
  notes: '',
})

const addingRelation = ref(false)

// NPC-to-NPC relation state
const newNpcRelation = ref({
  npcId: null as number | null,
  relationType: '',
  notes: '',
})

const addingNpcRelation = ref(false)

// Relation editing state
const showEditRelationDialog = ref(false)
const editingRelation = ref<(typeof npcRelations.value)[0] | null>(null)
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

const npcsForSelect = computed(() => {
  // Filter out the current NPC from the list
  return entitiesStore.npcs.filter((npc) => npc.id !== editingNpc.value?.id)
})

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
  allRelations.value.filter((rel) => rel.to_entity_type === 'Faction'),
)

// Computed: Filter NPC relations
const npcRelationsList = computed(() =>
  allRelations.value.filter((rel) => rel.to_entity_type === 'NPC'),
)

// Computed: Other NPCs (excluding current one)
const otherNpcs = computed(() => {
  if (!npcs.value || !editingNpc.value) return []
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

// Membership editing state
const showEditMembershipDialog = ref(false)
const editingMembership = ref<Relation | null>(null)
const savingMembership = ref(false)
const membershipEditForm = ref({
  relationType: '',
  rank: '',
})

// Items state
const npcItems = ref<
  Array<{
    id: number
    relation_id: number
    name: string
    description: string | null
    relation_type: string
    quantity: number | null
    equipped: boolean
    image_url: string | null
    rarity: string | null
  }>
>([])

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
const npcNotes = ref<
  Array<{
    id: number
    title: string | null
    summary: string
    date: string | null
    notes: string | null
    created_at: string
    updated_at: string
  }>
>([])

const loadingNotes = ref(false)
const notesSearch = ref('')
const showNoteDialog = ref(false)
const showDeleteNoteDialog = ref(false)
const editingNote = ref<(typeof npcNotes.value)[0] | null>(null)
const deletingNote = ref<(typeof npcNotes.value)[0] | null>(null)
const savingNote = ref(false)
const deletingNoteLoading = ref(false)

const noteForm = ref({
  title: '',
  summary: '',
  date: '',
  notes: '',
})

const filteredNotes = computed(() => {
  if (!notesSearch.value) return npcNotes.value

  const query = notesSearch.value.toLowerCase()
  return npcNotes.value.filter(
    (note) =>
      note.title?.toLowerCase().includes(query) ||
      note.summary?.toLowerCase().includes(query) ||
      note.notes?.toLowerCase().includes(query),
  )
})

function truncateText(text: string, length: number) {
  if (text.length <= length) return text
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
  if (!editingNpc.value) return

  loadingNotes.value = true
  try {
    const notes = await $fetch<typeof npcNotes.value>(`/api/npcs/${editingNpc.value.id}/notes`, {
      query: notesSearch.value ? { search: notesSearch.value } : {},
    })
    npcNotes.value = notes
  } catch (error) {
    console.error('Failed to load notes:', error)
    npcNotes.value = []
  } finally {
    loadingNotes.value = false
  }
}

function editNote(note: (typeof npcNotes.value)[0]) {
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
  if (!editingNpc.value || !activeCampaignId.value) return

  savingNote.value = true

  try {
    if (editingNote.value) {
      // Update existing note
      await $fetch<{ success: boolean }>(
        `/api/npcs/${editingNpc.value.id}/notes/${editingNote.value.id}`,
        {
          method: 'PATCH',
          body: {
            title: noteForm.value.title || null,
            summary: noteForm.value.summary,
            date: noteForm.value.date ? new Date(noteForm.value.date).toISOString() : null,
            notes: noteForm.value.notes || null,
          },
        },
      )
    } else {
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
  } catch (error) {
    console.error('Failed to save note:', error)
  } finally {
    savingNote.value = false
  }
}

function deleteNote(note: (typeof npcNotes.value)[0]) {
  deletingNote.value = note
  showDeleteNoteDialog.value = true
}

async function confirmDeleteNote() {
  if (!deletingNote.value) return

  deletingNoteLoading.value = true

  try {
    await $fetch<{ success: boolean }>(
      `/api/npcs/${editingNpc.value!.id}/notes/${deletingNote.value.id}`,
      {
        method: 'DELETE' as const,
      },
    )

    await loadNotes()
    showDeleteNoteDialog.value = false
    deletingNote.value = null
  } catch (error) {
    console.error('Failed to delete note:', error)
  } finally {
    deletingNoteLoading.value = false
  }
}

// Memberships functions
async function loadAllRelations() {
  if (!editingNpc.value) return

  loadingRelations.value = true

  try {
    const relations = await $fetch<Relation[]>(`/api/npcs/${editingNpc.value.id}/all-relations`)
    allRelations.value = relations
  } catch (error) {
    console.error('Failed to load relations:', error)
    allRelations.value = []
  } finally {
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
  } catch (error) {
    console.error('Failed to add faction membership:', error)
  } finally {
    addingMembership.value = false
  }
}

function editMembership(membership: Relation) {
  editingMembership.value = membership
  membershipEditForm.value = {
    relationType: membership.relation_type,
    rank: (membership.notes as { rank?: string })?.rank || '',
  }
  showEditMembershipDialog.value = true
}

async function saveMembership() {
  if (!editingMembership.value) return

  savingMembership.value = true

  try {
    const updated = await $fetch<Relation>(`/api/entity-relations/${editingMembership.value.id}`, {
      method: 'PATCH' as const,
      body: {
        relationType: membershipEditForm.value.relationType,
        notes: JSON.stringify({ rank: membershipEditForm.value.rank }),
      },
    })

    // Update in local array
    const index = allRelations.value.findIndex((r) => r.id === editingMembership.value!.id)
    if (index !== -1) {
      allRelations.value[index] = updated
    }

    closeEditMembershipDialog()
  } catch (error) {
    console.error('Failed to update membership:', error)
  } finally {
    savingMembership.value = false
  }
}

function closeEditMembershipDialog() {
  showEditMembershipDialog.value = false
  editingMembership.value = null
  membershipEditForm.value = {
    relationType: '',
    rank: '',
  }
}

async function removeMembership(relationId: number) {
  try {
    await $fetch<{ success: boolean }>(`/api/relations/${relationId}`, {
      method: 'DELETE' as const,
    })
    await loadAllRelations()
  } catch (error) {
    console.error('Failed to remove membership:', error)
  }
}

async function removeNpcRelation(relationId: number) {
  if (!editingNpc.value) return

  try {
    await $fetch<{ success: boolean }>(`/api/relations/${relationId}`, {
      method: 'DELETE' as const,
    })
    await loadAllRelations()

    // Reload counts for this NPC (relation count changed)
    await reloadNpcCounts(editingNpc.value)
  } catch (error) {
    console.error('Failed to remove NPC relation:', error)
  }
}

// Items functions
async function loadNpcItems() {
  if (!editingNpc.value) return

  try {
    const items = await $fetch<typeof npcItems.value>(`/api/npcs/${editingNpc.value.id}/items`)
    npcItems.value = items
  } catch (error) {
    console.error('Failed to load NPC items:', error)
    npcItems.value = []
  }
}

async function addItemToNpc() {
  if (!editingNpc.value || !newItem.value.itemId || !newItem.value.relationType) return

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

    // Reload counts for this NPC (item count changed)
    await reloadNpcCounts(editingNpc.value)

    // Reset form
    newItem.value = {
      itemId: null,
      relationType: '',
      quantity: 1,
      equipped: false,
    }
  } catch (error) {
    console.error('Failed to add item to NPC:', error)
  } finally {
    addingItem.value = false
  }
}

async function removeItem(relationId: number) {
  if (!editingNpc.value) return

  try {
    await $fetch<{ success: boolean }>(`/api/relations/${relationId}`, {
      method: 'DELETE' as const,
    })
    await loadNpcItems()

    // Reload counts for this NPC (item count changed)
    await reloadNpcCounts(editingNpc.value)
  } catch (error) {
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
      type: npc.metadata?.type || undefined,
      status: npc.metadata?.status || undefined,
      age: npc.metadata?.age || undefined,
      gender: npc.metadata?.gender || undefined,
    },
  }

  // Load existing NPC relations
  try {
    const relations = await $fetch<typeof npcRelations.value>(`/api/npcs/${npc.id}/relations`)
    npcRelations.value = relations
  } catch (error) {
    console.error('Failed to load NPC relations:', error)
    npcRelations.value = []
  }

  // Load existing Location relations and add to npcRelations
  try {
    const locationRelations = await $fetch<
      Array<{
        id: number
        relation_id: number
        name: string
        description?: string
        relation_type?: string
        notes?: string | null
        image_url?: string
        type?: string
        region?: string
      }>
    >(`/api/npcs/${npc.id}/locations`)

    // Map locations to the same structure as npcRelations
    const mappedLocationRelations = locationRelations.map((loc) => ({
      id: loc.relation_id, // Use relation_id for deleting
      to_entity_id: loc.id, // The actual location ID
      to_entity_name: loc.name,
      to_entity_type: 'Location',
      relation_type: loc.relation_type || '',
      notes: loc.notes || null,
    }))

    // Append location relations to npcRelations
    npcRelations.value.push(...mappedLocationRelations)
  } catch (error) {
    console.error('Failed to load location relations:', error)
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

// View NPC (read-only mode)
async function viewNpc(npc: NPC) {
  // If dialog is already open, push current NPC to stack
  if (showViewDialog.value && viewingNpc.value) {
    npcViewStack.value.push(viewingNpc.value)
  }

  viewingNpc.value = npc
  showViewDialog.value = true
}

async function handleEditFromView(npc: NPC) {
  // Close view dialog
  showViewDialog.value = false
  viewingNpc.value = null

  // Open edit dialog
  await editNpc(npc)
}

// View NPC by ID (from relations in view dialog)
async function viewNpcById(npcId: number) {
  console.log('viewNpcById called with:', npcId)
  const npc = entitiesStore.npcs?.find((n) => n.id === npcId)
  console.log('Found NPC:', npc)
  if (npc) {
    viewNpc(npc)
  } else {
    console.error('NPC not found in store:', npcId)
  }
}

// View Item by ID (from items in view dialog)
async function viewItemById(itemId: number) {
  console.log('viewItemById called with:', itemId)
  // TODO: Implement ItemViewDialog
  // For now, just log. We'll implement this when ItemViewDialog is created
}

// View Location by ID (from locations in view dialog)
async function viewLocationById(locationId: number) {
  // Navigate to locations page with highlight
  await navigateTo(`/locations?highlight=${locationId}`)
}

// Go back to previous NPC in view stack
function goBackInNpcView() {
  const previousNpc = npcViewStack.value.pop()
  if (previousNpc) {
    viewingNpc.value = previousNpc
  }
}

// When closing dialog, clear the stack
watch(showViewDialog, (isOpen) => {
  if (!isOpen) {
    npcViewStack.value = []
    viewingNpc.value = null
  }
})

function deleteNpc(npc: NPC) {
  deletingNpc.value = npc
  showDeleteDialog.value = true
}

// AI Name Generation
const generatingName = ref(false)

async function generateName() {
  generatingName.value = true

  try {
    // Build context from current form data
    const context = []
    if (npcForm.value.metadata.race) {
      context.push(npcForm.value.metadata.race)
    }
    if (npcForm.value.metadata.class) {
      context.push(npcForm.value.metadata.class)
    }

    const contextString = context.length > 0 ? context.join(', ') : undefined

    const result = await $fetch<{ name: string }>('/api/ai/generate-name', {
      method: 'POST',
      body: {
        entityType: 'NPC',
        context: contextString,
        language: locale.value as 'de' | 'en',
      },
    })

    if (result.name) {
      npcForm.value.name = result.name
    }
  } catch (error: unknown) {
    console.error('[NPC] Failed to generate name:', error)
    const errorMessage =
      error &&
      typeof error === 'object' &&
      'data' in error &&
      error.data &&
      typeof error.data === 'object' &&
      'message' in error.data
        ? String(error.data.message)
        : 'Failed to generate name'
    alert(errorMessage)
  } finally {
    generatingName.value = false
  }
}

async function saveNpc() {
  if (!activeCampaignId.value) return

  saving.value = true

  try {
    let savedNpcId: number

    if (editingNpc.value) {
      // Store updates this.npcs[index] reactively
      await entitiesStore.updateNPC(editingNpc.value.id, {
        name: npcForm.value.name,
        description: npcForm.value.description,
        metadata: npcForm.value.metadata,
      })
      savedNpcId = editingNpc.value.id
    } else {
      // Store pushes to this.npcs reactively
      const newNpc = await entitiesStore.createNPC(activeCampaignId.value, npcForm.value)
      savedNpcId = newNpc.id
    }

    // If user is searching, re-execute search to update FTS5 results
    // (metadata changed, need fresh FTS5 index)
    if (searchQuery.value && searchQuery.value.trim().length > 0) {
      await executeSearch(searchQuery.value)
    }
    // else: Store already updated reactively, no fetch needed!

    // Reload counts for the saved NPC (get NPC from store, not API response!)
    const npcFromStore = entitiesStore.npcs.find((n) => n.id === savedNpcId)
    if (npcFromStore) {
      await reloadNpcCounts(npcFromStore)
    }

    closeDialog()
  } catch (error) {
    console.error('Failed to save NPC:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingNpc.value) return

  deleting.value = true

  try {
    await entitiesStore.deleteNPC(deletingNpc.value.id)

    // If user is searching, remove from search results
    if (searchQuery.value && searchQuery.value.trim().length > 0) {
      const deleteIndex = searchResults.value.findIndex((n) => n.id === deletingNpc.value?.id)
      if (deleteIndex !== -1) {
        searchResults.value.splice(deleteIndex, 1)
      }
    }

    showDeleteDialog.value = false
    deletingNpc.value = null
  } catch (error) {
    console.error('Failed to delete NPC:', error)
  } finally {
    deleting.value = false
  }
}

async function addNpcRelation() {
  if (!editingNpc.value || !newNpcRelation.value.npcId) return

  addingNpcRelation.value = true

  try {
    const relation = await $fetch<Relation>(`/api/npcs/${editingNpc.value.id}/relations`, {
      method: 'POST',
      body: {
        toEntityId: newNpcRelation.value.npcId,
        relationType: newNpcRelation.value.relationType || t('npcs.npcRelationTypes.ally'),
        notes: newNpcRelation.value.notes || null,
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

    // Reload counts to update NPC relations count badge
    if (editingNpc.value) {
      await reloadNpcCounts(editingNpc.value)
    }

    newNpcRelation.value = {
      npcId: null,
      relationType: '',
      notes: '',
    }
  } catch (error) {
    console.error('Failed to add NPC relation:', error)
  } finally {
    addingNpcRelation.value = false
  }
}

async function addLocationRelation() {
  if (!editingNpc.value || !newRelation.value.locationId) return

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

    // Reload counts to update location count badge
    if (editingNpc.value) {
      await reloadNpcCounts(editingNpc.value)
    }

    newRelation.value = {
      locationId: null,
      relationType: '',
      notes: '',
    }
  } catch (error) {
    console.error('Failed to add relation:', error)
  } finally {
    addingRelation.value = false
  }
}

function editRelation(relation: (typeof npcRelations.value)[0]) {
  editingRelation.value = relation
  relationEditForm.value = {
    relationType: relation.relation_type,
    notes: relation.notes || '',
  }
  showEditRelationDialog.value = true
}

async function saveRelation() {
  if (!editingRelation.value) return

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
    const index = npcRelations.value.findIndex((r) => r.id === editingRelation.value!.id)
    if (index !== -1) {
      npcRelations.value[index] = updated as (typeof npcRelations.value)[0]
    }

    closeEditRelationDialog()
  } catch (error) {
    console.error('Failed to update relation:', error)
  } finally {
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

    npcRelations.value = npcRelations.value.filter((r) => r.id !== relationId)
  } catch (error) {
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
      type: undefined,
      status: undefined,
      age: undefined,
      gender: undefined,
    },
  }
}

// Lore items for autocomplete
const loreItems = computed(() => {
  return entitiesStore.loreForSelect.map((lore: { id: number; name: string }) => ({
    title: lore.name,
    value: lore.id,
  }))
})

// Load linked lore when editing NPC
watch(
  () => editingNpc.value?.id,
  async (npcId) => {
    if (npcId) {
      await loadLinkedLore(npcId)
    } else {
      linkedLore.value = []
    }
  },
)

// Load linked lore entries
async function loadLinkedLore(npcId: number) {
  loadingLore.value = true
  try {
    const relations = await $fetch<
      Array<{ id: number; name: string; description: string | null; image_url: string | null }>
    >(`/api/npcs/${npcId}/lore`)
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
  if (!editingNpc.value || !selectedLoreId.value) return

  try {
    await $fetch('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: editingNpc.value.id,
        toEntityId: selectedLoreId.value,
        relationType: 'kennt',
      },
    })

    await loadLinkedLore(editingNpc.value.id)
    selectedLoreId.value = null
  } catch (error) {
    console.error('Failed to add lore relation:', error)
  }
}

// Remove lore relation
async function removeLoreRelation(loreId: number) {
  if (!editingNpc.value) return

  try {
    // Find the relation ID
    const relation = await $fetch<{ id: number } | null>('/api/entity-relations/find', {
      query: {
        from_entity_id: editingNpc.value.id,
        to_entity_id: loreId,
      },
    })

    if (relation?.id) {
      await $fetch(`/api/entity-relations/${relation.id}`, {
        method: 'DELETE',
      })

      await loadLinkedLore(editingNpc.value.id)
    }
  } catch (error) {
    console.error('Failed to remove lore relation:', error)
  }
}

// Icon helper functions for NPC types and statuses
function getNpcTypeIcon(type: string): string {
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

function getNpcStatusIcon(status: string): string {
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

function getNpcStatusColor(status: string): string {
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
    uncommon: 'success',
    rare: 'info',
    'very rare': 'warning',
    legendary: 'error',
    artifact: 'purple',
  }
  return colors[rarity] || 'grey'
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

/* Highlighted card animation */
.highlighted-card {
  animation: highlight-pulse 2s ease-in-out;
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary)) !important;
}

/* NPC Card Hover Effect */
.npc-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.npc-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

/* NPC Description - Fixed 3 lines */
.npc-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
  min-height: calc(1.5em * 3); /* 3 lines */
  max-height: calc(1.5em * 3);
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
