<!-- eslint-disable vue/no-v-html -->
<template>
  <v-container>
    <PageHeader
      :title="$t('sessions.title')"
      :subtitle="$t('sessions.subtitle')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('sessions.create') }}
        </v-btn>
      </template>
    </PageHeader>

    <v-row v-if="pending">
      <v-col
        v-for="i in 3"
        :key="i"
        cols="12"
      >
        <v-skeleton-loader type="article" />
      </v-col>
    </v-row>

    <v-timeline
      v-else-if="sessions && sessions.length > 0"
      side="end"
      align="start"
    >
      <v-timeline-item
        v-for="session in sessions"
        :key="session.id"
        dot-color="primary"
        size="small"
      >
        <template #opposite>
          <div class="text-caption text-medium-emphasis">
            {{ formatDate(session.date) }}
          </div>
        </template>

        <v-card hover>
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-book-open-page-variant" class="mr-2" color="primary" />
            <span v-if="session.session_number" class="text-medium-emphasis mr-2">
              #{{ session.session_number }}
            </span>
            {{ session.title }}
          </v-card-title>
          <v-card-text>
            <div v-if="session.summary" class="text-body-2 mb-3">
              {{ truncateText(session.summary, 150) }}
            </div>
            <div v-else class="text-body-2 text-disabled mb-3">
              {{ $t('sessions.noSummary') }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              icon="mdi-eye"
              variant="text"
              @click="viewSession(session)"
            />
            <v-btn
              icon="mdi-pencil"
              variant="text"
              @click="editSession(session)"
            />
            <v-spacer />
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              @click="deleteSession(session)"
            />
          </v-card-actions>
        </v-card>
      </v-timeline-item>
    </v-timeline>

    <v-empty-state
      v-else
      icon="mdi-book-open-page-variant"
      :title="$t('sessions.empty')"
      :text="$t('sessions.emptyText')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          {{ $t('sessions.create') }}
        </v-btn>
      </template>
    </v-empty-state>

    <!-- Create/Edit Session Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="1000"
      scrollable
    >
      <v-card>
        <v-card-title>
          {{ editingSession ? $t('sessions.edit') : $t('sessions.create') }}
        </v-card-title>

        <v-tabs v-if="editingSession" v-model="sessionDialogTab" class="px-4">
          <v-tab value="details">
            <v-icon start>
              mdi-information
            </v-icon>
            {{ $t('sessions.details') }}
          </v-tab>
          <v-tab value="mentions">
            <v-icon start>
              mdi-link-variant
            </v-icon>
            {{ $t('sessions.mentions') }}
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 70vh; overflow-y: auto;">
          <v-tabs-window v-if="editingSession" v-model="sessionDialogTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
              <v-row>
                <v-col cols="12" md="8">
                  <v-text-field
                    v-model="sessionForm.title"
                    :label="$t('sessions.title')"
                    :rules="[v => !!v || $t('sessions.titleRequired')]"
                    variant="outlined"
                    class="mb-4"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="sessionForm.session_number"
                    :label="$t('sessions.sessionNumber')"
                    type="number"
                    variant="outlined"
                    class="mb-4"
                  />
                </v-col>
              </v-row>

              <v-text-field
                v-model="sessionForm.date"
                :label="$t('sessions.date')"
                type="date"
                variant="outlined"
                class="mb-4"
              />

              <v-textarea
                v-model="sessionForm.summary"
                :label="$t('sessions.summary')"
                :placeholder="$t('sessions.summaryPlaceholder')"
                variant="outlined"
                rows="3"
                class="mb-4"
              />

              <div class="text-h6 mb-4">
                {{ $t('sessions.notes') }}
              </div>

              <ClientOnly>
                <MdEditor
                  ref="editorRef"
                  v-model="sessionForm.notes"
                  :language="currentLocale"
                  :theme="editorTheme"
                  :placeholder="$t('sessions.notesPlaceholder')"
                  :toolbars="toolbars"
                  :sanitize="sanitizeHtml"
                  style="height: 500px;"
                  class="mb-4"
                  @click="handleEditorClick"
                >
                  <!-- Custom Entity Link Buttons -->
                  <template #defToolbars>
                    <NormalToolbar
                      :title="$t('sessions.linkNpc')"
                      @on-click="showLinkEntityDialog('npc')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkLocation')"
                      @on-click="showLinkEntityDialog('location')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z" />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkItem')"
                      @on-click="showLinkEntityDialog('item')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M6.92,5H5L14,14L15,13.06M19.96,19.12L19.12,19.96C18.73,20.35 18.1,20.35 17.71,19.96L14.59,16.84L11.91,19.5L10.5,18.09L13.16,15.43L11.06,13.33L8.85,15.54L7.44,14.13L9.65,11.92L6.5,8.77L7.91,7.36L11.06,10.5L13.27,8.29L9.12,4.12C8.73,3.73 8.73,3.1 9.12,2.71L9.96,1.87C10.35,1.5 10.98,1.5 11.37,1.87L19.96,10.46C20.35,10.85 20.35,11.5 19.96,11.87L19.12,12.71C18.73,13.1 18.1,13.1 17.71,12.71L15.92,10.92L13.71,13.13L15.81,15.23L18.5,12.54L19.91,13.95L17.22,16.64L19.96,19.38C20.35,19.77 20.35,20.4 19.96,20.79Z" />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkFaction')"
                      @on-click="showLinkEntityDialog('faction')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z" />
                        </svg>
                      </template>
                    </NormalToolbar>
                  </template>
                </MdEditor>
              </ClientOnly>
            </v-tabs-window-item>

            <!-- Mentions Tab -->
            <v-tabs-window-item value="mentions">
              <div class="text-h6 mb-4">
                {{ $t('sessions.linkedEntities') }}
              </div>

              <div v-if="extractedMentions.length > 0">
                <v-chip
                  v-for="mention in extractedMentions"
                  :key="`${mention.type}-${mention.id}`"
                  class="ma-1"
                  :color="getEntityColor(mention.type)"
                  closable
                  @click="navigateToEntity(mention)"
                  @click:close="removeMention(mention)"
                >
                  <v-icon start>{{ getEntityIcon(mention.type) }}</v-icon>
                  {{ mention.name }}
                </v-chip>
              </div>
              <div v-else class="text-body-2 text-disabled">
                {{ $t('sessions.noMentions') }}
              </div>
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Form when creating (no tabs) -->
          <template v-if="!editingSession">
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="sessionForm.title"
                  :label="$t('sessions.title')"
                  :rules="[v => !!v || $t('sessions.titleRequired')]"
                  variant="outlined"
                  class="mb-4"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="sessionForm.session_number"
                  :label="$t('sessions.sessionNumber')"
                  type="number"
                  variant="outlined"
                  class="mb-4"
                />
              </v-col>
            </v-row>

            <v-text-field
              v-model="sessionForm.date"
              :label="$t('sessions.date')"
              type="date"
              variant="outlined"
              class="mb-4"
            />

            <v-textarea
              v-model="sessionForm.summary"
              :label="$t('sessions.summary')"
              :placeholder="$t('sessions.summaryPlaceholder')"
              variant="outlined"
              rows="3"
              class="mb-4"
            />

            <div class="text-h6 mb-4">
              {{ $t('sessions.notes') }}
            </div>

            <ClientOnly>
              <MdEditor
                ref="editorRef"
                v-model="sessionForm.notes"
                :language="currentLocale"
                :theme="editorTheme"
                :placeholder="$t('sessions.notesPlaceholder')"
                :toolbars="toolbars"
                :sanitize="sanitizeHtml"
                style="height: 500px;"
                class="mb-4"
                @click="handleEditorClick"
              >
                <!-- Custom Entity Link Buttons -->
                <template #defToolbars>
                  <NormalToolbar
                    :title="$t('sessions.linkNpc')"
                    @on-click="showLinkEntityDialog('npc')"
                  >
                    <template #trigger>
                      <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
                      </svg>
                    </template>
                  </NormalToolbar>
                  <NormalToolbar
                    :title="$t('sessions.linkLocation')"
                    @on-click="showLinkEntityDialog('location')"
                  >
                    <template #trigger>
                      <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z" />
                      </svg>
                    </template>
                  </NormalToolbar>
                  <NormalToolbar
                    :title="$t('sessions.linkItem')"
                    @on-click="showLinkEntityDialog('item')"
                  >
                    <template #trigger>
                      <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M6.92,5H5L14,14L15,13.06M19.96,19.12L19.12,19.96C18.73,20.35 18.1,20.35 17.71,19.96L14.59,16.84L11.91,19.5L10.5,18.09L13.16,15.43L11.06,13.33L8.85,15.54L7.44,14.13L9.65,11.92L6.5,8.77L7.91,7.36L11.06,10.5L13.27,8.29L9.12,4.12C8.73,3.73 8.73,3.1 9.12,2.71L9.96,1.87C10.35,1.5 10.98,1.5 11.37,1.87L19.96,10.46C20.35,10.85 20.35,11.5 19.96,11.87L19.12,12.71C18.73,13.1 18.1,13.1 17.71,12.71L15.92,10.92L13.71,13.13L15.81,15.23L18.5,12.54L19.91,13.95L17.22,16.64L19.96,19.38C20.35,19.77 20.35,20.4 19.96,20.79Z" />
                      </svg>
                    </template>
                  </NormalToolbar>
                  <NormalToolbar
                    :title="$t('sessions.linkFaction')"
                    @on-click="showLinkEntityDialog('faction')"
                  >
                    <template #trigger>
                      <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z" />
                      </svg>
                    </template>
                  </NormalToolbar>
                </template>
              </MdEditor>
            </ClientOnly>
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
            :disabled="!sessionForm.title"
            :loading="saving"
            @click="saveSession"
          >
            {{ editingSession ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Entity Link Dialog -->
    <v-dialog
      v-model="showEntityLinkDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>
          {{ $t(`sessions.link${linkEntityType.charAt(0).toUpperCase() + linkEntityType.slice(1)}`) }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="entitySearch"
            :label="$t('common.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            autofocus
            clearable
            class="mb-4"
          />

          <v-list>
            <v-list-item
              v-for="entity in filteredEntities"
              :key="entity.id"
              @click="insertEntityLink(entity)"
            >
              <template #prepend>
                <v-icon :icon="getEntityIcon(linkEntityType)" color="primary" />
              </template>
              <v-list-item-title>{{ entity.name }}</v-list-item-title>
            </v-list-item>
          </v-list>

          <div v-if="filteredEntities.length === 0" class="text-center text-disabled py-4">
            {{ $t('common.noResults') }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEntityLinkDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- View Session Dialog -->
    <v-dialog
      v-model="showViewDialog"
      max-width="900"
      scrollable
    >
      <v-card v-if="viewingSession">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-book-open-page-variant" class="mr-2" color="primary" />
          <span v-if="viewingSession.session_number" class="text-medium-emphasis mr-2">
            #{{ viewingSession.session_number }}
          </span>
          {{ viewingSession.title }}
        </v-card-title>

        <v-card-subtitle v-if="viewingSession.date">
          {{ formatDate(viewingSession.date) }}
        </v-card-subtitle>

        <v-card-text style="max-height: 70vh;">
          <div v-if="viewingSession.summary" class="text-body-1 mb-4">
            {{ viewingSession.summary }}
          </div>

          <v-divider v-if="viewingSession.notes" class="my-4" />

          <ClientOnly v-if="viewingSession.notes">
            <MdPreview
              :model-value="viewingSession.notes"
              :language="currentLocale"
              :theme="editorTheme"
              :sanitize="sanitizeHtml"
              preview-only
              editor-id="session-view-preview"
              style="height: auto;"
              @click="handleEditorClick"
            />
          </ClientOnly>
        </v-card-text>

        <v-card-actions>
          <v-btn
            variant="text"
            prepend-icon="mdi-pencil"
            @click="editSession(viewingSession); showViewDialog = false"
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

    <!-- Delete Confirmation Dialog -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('sessions.deleteTitle')"
      :message="$t('sessions.deleteConfirm', { title: deletingSession?.title })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Entity Quick View Dialog -->
    <v-dialog
      v-model="showEntityDialog"
      max-width="700"
      scrollable
    >
      <v-card v-if="viewingEntity">
        <v-card-title class="d-flex align-center">
          <v-icon :icon="getEntityIcon(viewingEntityType)" :color="getEntityColor(viewingEntityType)" class="mr-2" />
          {{ viewingEntity.name }}
        </v-card-title>

        <v-card-text style="max-height: 60vh;">
          <!-- NPC Details -->
          <template v-if="viewingEntityType === 'npc'">
            <v-img
              v-if="viewingEntity.image_url"
              :src="`/pictures/${viewingEntity.image_url}`"
              :alt="viewingEntity.name"
              max-height="300"
              class="mb-4"
              cover
            />
            <div v-if="viewingEntity.description" class="text-body-1 mb-4">
              {{ viewingEntity.description }}
            </div>
            <v-divider class="my-4" />
            <div class="text-body-2">
              <div v-if="viewingEntity.race" class="mb-2">
                <strong>{{ $t('npcs.race') }}:</strong> {{ viewingEntity.race }}
              </div>
              <div v-if="viewingEntity.class" class="mb-2">
                <strong>{{ $t('npcs.class') }}:</strong> {{ viewingEntity.class }}
              </div>
              <div v-if="viewingEntity.faction" class="mb-2">
                <strong>{{ $t('npcs.faction') }}:</strong> {{ viewingEntity.faction }}
              </div>
            </div>
            <div v-if="viewingEntity.notes" class="mt-4">
              <strong>{{ $t('common.notes') }}:</strong>
              <div class="text-body-2 mt-2">
                {{ viewingEntity.notes }}
              </div>
            </div>
          </template>

          <!-- Location Details -->
          <template v-if="viewingEntityType === 'location'">
            <v-img
              v-if="viewingEntity.image_url"
              :src="`/pictures/${viewingEntity.image_url}`"
              :alt="viewingEntity.name"
              max-height="300"
              class="mb-4"
              cover
            />
            <div v-if="viewingEntity.description" class="text-body-1 mb-4">
              {{ viewingEntity.description }}
            </div>
            <v-divider class="my-4" />
            <div class="text-body-2">
              <div v-if="viewingEntity.type" class="mb-2">
                <strong>{{ $t('locations.type') }}:</strong> {{ viewingEntity.type }}
              </div>
              <div v-if="viewingEntity.parent_location" class="mb-2">
                <strong>{{ $t('locations.parentLocation') }}:</strong> {{ viewingEntity.parent_location }}
              </div>
            </div>
            <div v-if="viewingEntity.notes" class="mt-4">
              <strong>{{ $t('common.notes') }}:</strong>
              <div class="text-body-2 mt-2">
                {{ viewingEntity.notes }}
              </div>
            </div>
          </template>

          <!-- Item Details -->
          <template v-if="viewingEntityType === 'item'">
            <div class="position-relative">
              <v-img
                v-if="viewingEntity.image_url"
                :src="`/pictures/${viewingEntity.image_url}`"
                :alt="viewingEntity.name"
                max-height="300"
                class="mb-4"
                cover
              />
              <v-chip
                v-if="viewingEntity.rarity"
                :color="getRarityColor(viewingEntity.rarity)"
                class="position-absolute"
                style="top: 8px; right: 8px;"
              >
                {{ $t(`items.rarities.${viewingEntity.rarity}`) }}
              </v-chip>
            </div>
            <div v-if="viewingEntity.description" class="text-body-1 mb-4">
              {{ viewingEntity.description }}
            </div>
            <v-divider class="my-4" />

            <div class="d-flex flex-wrap gap-2 mb-3">
              <v-chip v-if="viewingEntity.type" variant="tonal">
                <v-icon start>mdi-tag</v-icon>
                {{ $t(`items.types.${viewingEntity.type}`) }}
              </v-chip>
              <v-chip v-if="viewingEntity.attunement" color="purple" variant="tonal">
                <v-icon start>mdi-auto-fix</v-icon>
                {{ $t('items.requiresAttunement') }}
              </v-chip>
            </div>

            <div v-if="viewingEntity.notes" class="mt-4">
              <strong>{{ $t('common.notes') }}:</strong>
              <div class="text-body-2 mt-2">
                {{ viewingEntity.notes }}
              </div>
            </div>
          </template>

          <!-- Faction Details -->
          <template v-if="viewingEntityType === 'faction'">
            <v-img
              v-if="viewingEntity.image_url"
              :src="`/pictures/${viewingEntity.image_url}`"
              :alt="viewingEntity.name"
              max-height="300"
              class="mb-4"
              cover
            />
            <div v-if="viewingEntity.description" class="text-body-1 mb-4">
              {{ viewingEntity.description }}
            </div>
            <v-divider class="my-4" />
            <div class="text-body-2">
              <div v-if="viewingEntity.leader" class="mb-2">
                <strong>{{ $t('factions.leader') }}:</strong> {{ viewingEntity.leader }}
              </div>
              <div v-if="viewingEntity.alignment" class="mb-2">
                <strong>{{ $t('factions.alignment') }}:</strong> {{ viewingEntity.alignment }}
              </div>
            </div>
            <div v-if="viewingEntity.goals" class="mt-4">
              <strong>{{ $t('factions.goals') }}:</strong>
              <div class="text-body-2 mt-2">
                {{ viewingEntity.goals }}
              </div>
            </div>
            <div v-if="viewingEntity.notes" class="mt-4">
              <strong>{{ $t('common.notes') }}:</strong>
              <div class="text-body-2 mt-2">
                {{ viewingEntity.notes }}
              </div>
            </div>
          </template>
        </v-card-text>

        <v-card-actions>
          <v-btn
            variant="text"
            prepend-icon="mdi-open-in-new"
            @click="goToEntityPage"
          >
            {{ $t('sessions.goToPage') }}
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="showEntityDialog = false">
            {{ $t('common.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { MdEditor, NormalToolbar, MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTheme } from 'vuetify'

interface Session {
  id: number
  session_number: number | null
  title: string
  date: string | null
  summary: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface EntityMention {
  type: 'npc' | 'location' | 'item' | 'faction'
  id: number
  name: string
}

const router = useRouter()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const theme = useTheme()
const { locale } = useI18n()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)
const currentLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))
const editorTheme = computed<'light' | 'dark'>(() =>
  theme.global.current.value.dark ? 'dark' : 'light'
)

onMounted(async () => {
  if (!activeCampaignId.value) {
    router.push('/campaigns')
    return
  }

  await Promise.all([
    loadSessions(),
    entitiesStore.fetchNPCs(activeCampaignId.value),
    entitiesStore.fetchLocations(activeCampaignId.value),
    entitiesStore.fetchItems(activeCampaignId.value),
    entitiesStore.fetchFactions(activeCampaignId.value),
  ])
})

const sessions = ref<Session[]>([])
const pending = ref(false)

// Form state
// Entity types for the quick-view dialog
interface EntityBase {
  id: number
  name: string
  description?: string
  image_url?: string | null
  notes?: string
}

interface NPCEntity extends EntityBase {
  race?: string
  class?: string
  faction?: string
}

interface LocationEntity extends EntityBase {
  type?: string
  parent_location?: string
}

interface ItemEntity extends EntityBase {
  type?: string
  rarity?: string
  attunement?: boolean
}

interface FactionEntity extends EntityBase {
  leader?: string
  alignment?: string
  goals?: string
}

type ViewingEntity = NPCEntity | LocationEntity | ItemEntity | FactionEntity

const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const showEntityLinkDialog = ref(false)
const showEntityDialog = ref(false)
const editingSession = ref<Session | null>(null)
const viewingSession = ref<Session | null>(null)
const deletingSession = ref<Session | null>(null)
const viewingEntity = ref<ViewingEntity | null>(null)
const viewingEntityType = ref<'npc' | 'location' | 'item' | 'faction'>('npc')
const saving = ref(false)
const deleting = ref(false)
const sessionDialogTab = ref('details')

const sessionForm = ref({
  title: '',
  session_number: null as number | null,
  date: '',
  summary: '',
  notes: '',
})

// Entity linking
const linkEntityType = ref<'npc' | 'location' | 'item' | 'faction'>('npc')
const entitySearch = ref('')
const notesTextarea = ref<HTMLTextAreaElement | null>(null)
const editorRef = ref<InstanceType<typeof MdEditor> | null>(null)

// md-editor Toolbars: 0-3 = Placeholders for custom entity buttons
const toolbars = [
  'bold',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'code',
  'link',
  0, // NPC
  1, // Location
  2, // Item
  3, // Faction
  'table',
  '-',
  'revoke',
  'next',
  '=',
  'pageFullscreen',
  'preview',
  'catalog',
] as const

const filteredEntities = computed(() => {
  const query = entitySearch.value?.toLowerCase() || ''
  let entities: Array<{ id: number, name: string }> = []

  switch (linkEntityType.value) {
    case 'npc':
      entities = entitiesStore.npcsForSelect || []
      break
    case 'location':
      entities = entitiesStore.locationsForSelect || []
      break
    case 'item':
      entities = entitiesStore.items || []
      break
    case 'faction':
      entities = entitiesStore.factions || []
      break
  }

  if (!query)
    return entities

  return entities.filter(e => e.name.toLowerCase().includes(query))
})

const extractedMentions = computed(() => {
  const mentions: EntityMention[] = []
  const text = sessionForm.value.notes || ''

  // Parse markdown links like [Entity Name](type:id)
  const linkRegex = /\[([^\]]+)\]\((\w+):(\d+)\)/g
  let match

  while ((match = linkRegex.exec(text)) !== null) {
    const [, name, type, id] = match
    mentions.push({
      type: type as 'npc' | 'location' | 'item' | 'faction',
      id: Number.parseInt(id),
      name,
    })
  }

  return mentions
})

async function loadSessions() {
  if (!activeCampaignId.value)
    return

  pending.value = true
  try {
    const data = await $fetch<Session[]>('/api/sessions', {
      query: { campaignId: activeCampaignId.value },
    })
    sessions.value = data.sort((a, b) => {
      // Sort by session number descending, then by date descending
      if (a.session_number && b.session_number)
        return b.session_number - a.session_number

      if (a.date && b.date)
        return new Date(b.date).getTime() - new Date(a.date).getTime()

      return 0
    })
  }
  catch (error) {
    console.error('Failed to load sessions:', error)
    sessions.value = []
  }
  finally {
    pending.value = false
  }
}

function formatDate(dateString: string | null) {
  if (!dateString)
    return '-'

  return new Date(dateString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength)
    return text
  return `${text.substring(0, maxLength)}...`
}

function renderMarkdown(text: string): string {
  // Replace entity links with styled badges before rendering
  const processedText = text.replace(/\[([^\]]+)\]\((\w+):(\d+)\)/g, (match, name, type, id) => {
    const icon = getEntityIcon(type)
    const color = getEntityColor(type)
    return `<span class="entity-badge" data-type="${type}" data-id="${id}" style="background-color: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"><i class="mdi ${icon}"></i>${name}</span>`
  })

  return marked(processedText) as string
}

function sanitizeHtml(html: string): string {
  // This is called by md-editor-v3 to sanitize/transform the HTML
  // Replace entity link <a> tags with styled badges
  return html.replace(/<a[^>]*href="(\w+):(\d+)"[^>]*>([^<]+)<\/a>/g, (match, type, id, name) => {
    const icon = getEntityIcon(type)
    const color = getEntityColor(type)
    return `<span class="entity-badge" data-type="${type}" data-id="${id}" style="background-color: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"><i class="mdi ${icon}"></i>${name}</span>`
  })
}

function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    npc: 'mdi-account',
    location: 'mdi-map-marker',
    item: 'mdi-sword',
    faction: 'mdi-shield',
  }
  return icons[type] || 'mdi-link'
}

function getEntityColor(type: string): string {
  const colors: Record<string, string> = {
    npc: '#D4A574',
    location: '#8B7355',
    item: '#CC8844',
    faction: '#7B92AB',
  }
  return colors[type] || '#888888'
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

function showLinkEntityDialog(type: 'npc' | 'location' | 'item' | 'faction') {
  linkEntityType.value = type
  entitySearch.value = ''
  showEntityLinkDialog.value = true
}

function insertEntityLink(entity: { id: number, name: string }) {
  const link = `[${entity.name}](${linkEntityType.value}:${entity.id})`

  // Use md-editor's insert API if available, fallback to textarea method
  if (editorRef.value) {
    editorRef.value.insert(() => ({
      targetValue: link,
      select: false,
      deviationStart: 0,
      deviationEnd: 0,
    }))
  } else {
    insertMarkdown(link, '')
  }

  showEntityLinkDialog.value = false
}

function insertMarkdown(before: string, after: string) {
  const textarea = notesTextarea.value?.$el?.querySelector('textarea')
  if (!textarea)
    return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = sessionForm.value.notes || ''
  const selectedText = text.substring(start, end)

  sessionForm.value.notes = text.substring(0, start) + before + selectedText + after + text.substring(end)

  // Restore cursor position
  nextTick(() => {
    textarea.focus()
    textarea.selectionStart = start + before.length
    textarea.selectionEnd = start + before.length + selectedText.length
  })
}

function removeMention(mention: EntityMention) {
  const linkText = `[${mention.name}](${mention.type}:${mention.id})`
  sessionForm.value.notes = sessionForm.value.notes?.replace(linkText, mention.name) || ''
}

function navigateToEntity(mention: EntityMention) {
  const paths: Record<string, string> = {
    npc: '/npcs',
    location: '/locations',
    item: '/items',
    faction: '/factions',
  }
  router.push(`${paths[mention.type]}?id=${mention.id}`)
}

async function handleBadgeClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const badge = target.closest('.entity-badge')

  if (badge) {
    const type = badge.getAttribute('data-type') as 'npc' | 'location' | 'item' | 'faction'
    const id = badge.getAttribute('data-id')

    if (type && id) {
      await loadEntityDetails(type, Number.parseInt(id))
    }
  }
}

async function handleEditorClick(event: MouseEvent) {
  // Handle clicks on entity badges in the editor preview
  const target = event.target as HTMLElement
  const badge = target.closest('.entity-badge')

  if (badge) {
    event.preventDefault()
    event.stopPropagation()

    const type = badge.getAttribute('data-type') as 'npc' | 'location' | 'item' | 'faction'
    const id = badge.getAttribute('data-id')

    if (type && id) {
      await loadEntityDetails(type, Number.parseInt(id))
    }
  }
}

async function loadEntityDetails(type: 'npc' | 'location' | 'item' | 'faction', id: number) {
  try {
    viewingEntityType.value = type

    // Fetch entity details from API
    const endpoints: Record<string, string> = {
      npc: '/api/npcs',
      location: '/api/locations',
      item: '/api/items',
      faction: '/api/factions',
    }

    viewingEntity.value = await $fetch(`${endpoints[type]}/${id}`)
    showEntityDialog.value = true
  }
  catch (error) {
    console.error('Failed to load entity details:', error)
  }
}

function goToEntityPage() {
  if (!viewingEntity.value)
    return

  navigateToEntity({
    type: viewingEntityType.value,
    id: viewingEntity.value.id,
    name: viewingEntity.value.name,
  })
  showEntityDialog.value = false
}

function viewSession(session: Session) {
  viewingSession.value = session
  showViewDialog.value = true
}

function editSession(session: Session) {
  editingSession.value = session
  sessionForm.value = {
    title: session.title,
    session_number: session.session_number,
    date: session.date || '',
    summary: session.summary || '',
    notes: session.notes || '',
  }
  showCreateDialog.value = true
  sessionDialogTab.value = 'details'
}

function deleteSession(session: Session) {
  deletingSession.value = session
  showDeleteDialog.value = true
}

async function saveSession() {
  if (!sessionForm.value.title || !activeCampaignId.value)
    return

  saving.value = true

  try {
    if (editingSession.value) {
      await $fetch(`/api/sessions/${editingSession.value.id}`, {
        method: 'PATCH',
        body: sessionForm.value,
      })
    }
    else {
      await $fetch('/api/sessions', {
        method: 'POST',
        body: {
          ...sessionForm.value,
          campaignId: activeCampaignId.value,
        },
      })
    }

    await loadSessions()
    closeDialog()
  }
  catch (error) {
    console.error('Failed to save session:', error)
  }
  finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingSession.value)
    return

  deleting.value = true

  try {
    await $fetch(`/api/sessions/${deletingSession.value.id}`, {
      method: 'DELETE',
    })
    await loadSessions()
    showDeleteDialog.value = false
    deletingSession.value = null
  }
  catch (error) {
    console.error('Failed to delete session:', error)
  }
  finally {
    deleting.value = false
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingSession.value = null
  sessionForm.value = {
    title: '',
    session_number: null,
    date: '',
    summary: '',
    notes: '',
  }
  sessionDialogTab.value = 'details'
}
</script>

<style scoped>
.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.markdown-content :deep(p) {
  margin-bottom: 1em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-left: 1.5em;
  margin-bottom: 1em;
}

.markdown-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.markdown-content :deep(.entity-badge) {
  cursor: pointer;
  transition: opacity 0.2s;
}

.markdown-content :deep(.entity-badge:hover) {
  opacity: 0.8;
}

.font-monospace {
  font-family: 'Courier New', Courier, monospace;
}
</style>
