<!-- eslint-disable vue/no-v-html -->
<template>
  <v-container>
    <UiPageHeader :title="$t('sessions.title')" :subtitle="$t('sessions.subtitle')">
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
    </UiPageHeader>

    <v-row v-if="pending">
      <v-col v-for="i in 3" :key="i" cols="12">
        <v-skeleton-loader type="article" />
      </v-col>
    </v-row>

    <v-timeline v-else-if="sessions && sessions.length > 0" side="end" align="start" class="sessions-timeline">
      <v-timeline-item
        v-for="session in sessions"
        :key="session.id"
        dot-color="primary"
        size="small"
      >
        <template #opposite>
          <div class="timeline-date-section text-right">
            <!-- Real Date -->
            <div class="text-body-2 font-weight-medium">
              {{ formatDate(session.date) }}
            </div>
            <!-- In-Game Date -->
            <div v-if="session.in_game_day_start" class="text-caption text-primary mt-1">
              <v-icon size="x-small" class="mr-1">mdi-sword-cross</v-icon>
              {{ formatAbsoluteDay(session.in_game_day_start) }}
              <span v-if="session.in_game_day_end && session.in_game_day_end !== session.in_game_day_start">
                <br/>→ {{ formatAbsoluteDay(session.in_game_day_end) }}
              </span>
            </div>
          </div>
        </template>

        <v-card hover class="session-card">
          <!-- Cover Image (if available) -->
          <v-img
            v-if="session.cover_image_url"
            :src="`/uploads/${session.cover_image_url}`"
            height="160"
            cover
            class="session-cover"
            style="cursor: pointer"
            @click="openImagePreview(`/uploads/${session.cover_image_url}`, session.title)"
          >
            <template #placeholder>
              <div class="d-flex align-center justify-center fill-height">
                <v-progress-circular indeterminate color="primary" />
              </div>
            </template>
          </v-img>

          <v-card-title class="d-flex align-center pb-1">
            <v-icon icon="mdi-book-open-page-variant" class="mr-2" color="primary" />
            <span v-if="session.session_number" class="text-medium-emphasis mr-2">
              #{{ session.session_number }}
            </span>
            {{ session.title }}
          </v-card-title>

          <v-card-text class="pt-2">
            <!-- Summary -->
            <div v-if="session.summary" class="text-body-2 mb-3">
              {{ truncateText(session.summary, 200) }}
            </div>
            <div v-else class="text-body-2 text-disabled mb-3">
              {{ $t('sessions.noSummary') }}
            </div>

            <!-- Info Chips -->
            <div class="d-flex flex-wrap gap-2">
              <!-- Duration -->
              <v-chip
                v-if="session.duration_minutes"
                size="small"
                variant="tonal"
                prepend-icon="mdi-timer-outline"
              >
                {{ session.duration_minutes }} min
              </v-chip>

              <!-- Mentions Count (from notes) -->
              <v-chip
                v-if="countMentionsInNotes(session.notes)"
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-link-variant"
              >
                {{ countMentionsInNotes(session.notes) }} {{ $t('sessions.mentions') }}
              </v-chip>
            </div>
          </v-card-text>

          <v-card-actions>
            <v-btn icon="mdi-eye" variant="text" @click="viewSession(session)" />
            <v-btn icon="mdi-pencil" variant="text" @click="editSession(session)" />
            <v-spacer />
            <v-btn icon="mdi-delete" variant="text" color="error" @click="deleteSession(session)" />
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
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
          {{ $t('sessions.create') }}
        </v-btn>
      </template>
    </v-empty-state>

    <!-- Create/Edit Session Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="1000" scrollable :persistent="saving || uploadingAudio">
      <v-card>
        <v-card-title>
          {{ editingSession ? $t('sessions.edit') : $t('sessions.create') }}
        </v-card-title>

        <v-tabs v-if="editingSession" v-model="sessionDialogTab" class="px-4">
          <v-tab value="details">
            <v-icon start> mdi-information </v-icon>
            {{ $t('sessions.details') }}
          </v-tab>
          <v-tab value="cover">
            <v-icon start> mdi-image </v-icon>
            {{ $t('sessions.cover') }}
          </v-tab>
          <v-tab value="audio">
            <v-icon start> mdi-microphone </v-icon>
            {{ $t('audio.audio') }}
          </v-tab>
          <v-tab value="attendance">
            <v-icon start> mdi-account-check </v-icon>
            {{ $t('sessions.attendance') }} ({{ attendanceCount }})
          </v-tab>
          <v-tab value="mentions">
            <v-icon start> mdi-link-variant </v-icon>
            {{ $t('sessions.mentions') }} ({{ extractedMentions.length }})
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 70vh; overflow-y: auto">
          <v-tabs-window v-if="editingSession" v-model="sessionDialogTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
              <v-row class="mt-2">
                <v-col cols="12" md="8">
                  <v-text-field
                    v-model="sessionForm.title"
                    :label="$t('sessions.title')"
                    :rules="[(v: string) => !!v || $t('sessions.titleRequired')]"
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

              <!-- In-Game Timeline Section -->
              <v-expansion-panels variant="accordion" class="mb-4">
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    <v-icon start>mdi-clock-outline</v-icon>
                    {{ $t('sessions.inGameTimeline') }}
                    <template v-if="sessionForm.in_game_day_start">
                      <v-chip size="small" class="ml-2" color="primary" variant="tonal">
                        {{ formatAbsoluteDay(sessionForm.in_game_day_start) }}
                        <span v-if="sessionForm.in_game_day_end && sessionForm.in_game_day_end !== sessionForm.in_game_day_start">
                          → {{ formatAbsoluteDay(sessionForm.in_game_day_end) }}
                        </span>
                      </v-chip>
                    </template>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-row>
                      <v-col cols="12" md="5">
                        <v-label class="text-subtitle-2 mb-2">{{ $t('sessions.inGameDateStart') }}</v-label>
                        <CalendarInGameDatePicker
                          v-model="sessionForm.in_game_day_start"
                          :calendar-data="calendarData"
                        />
                      </v-col>
                      <v-col cols="12" md="5">
                        <v-label class="text-subtitle-2 mb-2">{{ $t('sessions.inGameDateEnd') }}</v-label>
                        <CalendarInGameDatePicker
                          v-model="sessionForm.in_game_day_end"
                          :calendar-data="calendarData"
                        />
                        <p class="text-caption text-medium-emphasis mt-1">
                          {{ $t('sessions.inGameDateEndHint') }}
                        </p>
                      </v-col>
                      <v-col cols="12" md="2">
                        <v-text-field
                          v-model.number="sessionForm.duration_minutes"
                          :label="$t('sessions.durationMinutes')"
                          type="number"
                          variant="outlined"
                          prepend-inner-icon="mdi-timer-outline"
                        />
                      </v-col>
                    </v-row>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

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

              <div class="position-relative">
                <v-overlay
                  :model-value="uploadingImage"
                  contained
                  persistent
                  class="align-center justify-center"
                  scrim="surface"
                  opacity="0.9"
                >
                  <div class="text-center">
                    <v-progress-circular indeterminate size="64" color="primary" />
                    <div class="text-h6 mt-4">{{ $t('common.uploading') }}</div>
                  </div>
                </v-overlay>

                <ClientOnly>
                  <MdEditor
                    ref="editorRef"
                    v-model="sessionForm.notes"
                    :language="currentLocale"
                    :theme="editorTheme"
                    :placeholder="$t('sessions.notesPlaceholder')"
                    :on-upload-img="handleImageUpload"
                    :toolbars="toolbars"
                    :sanitize="sanitizeHtml"
                    style="height: 500px"
                    class="mb-4"
                    @click="handleEditorClick"
                    @cancel.stop.prevent
                  >
                    <!-- Custom Entity Link Buttons -->
                    <template #defToolbars>
                      <NormalToolbar
                        :title="$t('sessions.linkNpc')"
                        @on-click="showLinkEntityDialog('npc')"
                      >
                        <template #trigger>
                          <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"
                            />
                          </svg>
                        </template>
                      </NormalToolbar>
                      <NormalToolbar
                        :title="$t('sessions.linkLocation')"
                        @on-click="showLinkEntityDialog('location')"
                      >
                        <template #trigger>
                          <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z"
                            />
                          </svg>
                        </template>
                      </NormalToolbar>
                      <NormalToolbar
                        :title="$t('sessions.linkItem')"
                        @on-click="showLinkEntityDialog('item')"
                      >
                        <template #trigger>
                          <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M6.92,5H5L14,14L15,13.06M19.96,19.12L19.12,19.96C18.73,20.35 18.1,20.35 17.71,19.96L14.59,16.84L11.91,19.5L10.5,18.09L13.16,15.43L11.06,13.33L8.85,15.54L7.44,14.13L9.65,11.92L6.5,8.77L7.91,7.36L11.06,10.5L13.27,8.29L9.12,4.12C8.73,3.73 8.73,3.1 9.12,2.71L9.96,1.87C10.35,1.5 10.98,1.5 11.37,1.87L19.96,10.46C20.35,10.85 20.35,11.5 19.96,11.87L19.12,12.71C18.73,13.1 18.1,13.1 17.71,12.71L15.92,10.92L13.71,13.13L15.81,15.23L18.5,12.54L19.91,13.95L17.22,16.64L19.96,19.38C20.35,19.77 20.35,20.4 19.96,20.79Z"
                            />
                          </svg>
                        </template>
                      </NormalToolbar>
                      <NormalToolbar
                        :title="$t('sessions.linkFaction')"
                        @on-click="showLinkEntityDialog('faction')"
                      >
                        <template #trigger>
                          <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z"
                            />
                          </svg>
                        </template>
                      </NormalToolbar>
                      <NormalToolbar
                        :title="$t('sessions.linkLore')"
                        @on-click="showLinkEntityDialog('lore')"
                      >
                        <template #trigger>
                          <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M21,4H7A2,2 0 0,0 5,6V17H21V16L23,14V6C23,4.89 22.1,4 21,4M21,14H7V6H21M3,19V8H1V19A2,2 0 0,0 3,21H19V19"
                            />
                          </svg>
                        </template>
                      </NormalToolbar>
                      <NormalToolbar
                        :title="$t('sessions.linkPlayer')"
                        @on-click="showLinkEntityDialog('player')"
                      >
                        <template #trigger>
                          <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17V18.1H18.1V17C18.1,16.36 14.97,14.9 12,14.9M18,9V12H15V13H18V16H19V13H22V12H19V9H18Z"
                            />
                          </svg>
                        </template>
                      </NormalToolbar>
                      <NormalToolbar
                        :title="$t('documents.imageGallery')"
                        @on-click="openImageGallery"
                      >
                        <template #trigger>
                          <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M22,16V4A2,2 0 0,0 20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16M11,12L13.03,14.71L16,11L20,16H8M2,6V20A2,2 0 0,0 4,22H18V20H4V6"
                            />
                          </svg>
                        </template>
                      </NormalToolbar>
                    </template>
                  </MdEditor>
                </ClientOnly>
              </div>
            </v-tabs-window-item>

            <!-- Cover Tab -->
            <v-tabs-window-item value="cover">
              <SessionsSessionImageGallery
                v-if="editingSession"
                :session-id="editingSession.id"
                :session-title="sessionForm.title"
                :session-summary="sessionForm.summary"
                @preview-image="openImagePreview"
                @images-updated="reloadSessions"
              />
            </v-tabs-window-item>

            <!-- Audio Tab -->
            <v-tabs-window-item value="audio">
              <SessionsSessionAudioGallery
                v-if="editingSession"
                :session-id="editingSession.id"
                @audio-updated="reloadSessions"
                @uploading="(v) => (uploadingAudio = v)"
              />
            </v-tabs-window-item>

            <!-- Attendance Tab -->
            <v-tabs-window-item value="attendance">
              <div class="text-h6 mb-4">
                {{ $t('sessions.playerAttendance') }}
              </div>

              <div v-if="loadingAttendance" class="text-center py-4">
                <v-progress-circular indeterminate />
              </div>

              <div v-else-if="allPlayers.length === 0" class="text-body-2 text-disabled">
                {{ $t('sessions.noPlayers') }}
              </div>

              <v-list v-else>
                <v-list-item v-for="player in allPlayers" :key="player.id">
                  <template #prepend>
                    <v-checkbox
                      v-model="sessionAttendance[player.id]"
                      hide-details
                      density="compact"
                      color="success"
                    />
                  </template>
                  <template #default>
                    <div class="d-flex align-center">
                      <v-avatar size="40" class="mr-3">
                        <v-img
                          v-if="player.image_url"
                          :src="`/uploads/${player.image_url}`"
                        />
                        <v-icon v-else>mdi-account</v-icon>
                      </v-avatar>
                      <div>
                        <!-- Spielername (echter Mensch) im Vordergrund -->
                        <v-list-item-title class="font-weight-medium">
                          {{ player.metadata?.player_name || player.name }}
                        </v-list-item-title>
                        <!-- Charaktername als Zusatzinfo wenn Spielername vorhanden -->
                        <v-list-item-subtitle v-if="player.metadata?.player_name" class="text-medium-emphasis">
                          <v-icon size="x-small" class="mr-1">mdi-sword-cross</v-icon>
                          {{ player.name }}
                        </v-list-item-subtitle>
                      </div>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
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
                  :rules="[(v: string) => !!v || $t('sessions.titleRequired')]"
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

            <div class="position-relative">
              <v-overlay
                :model-value="uploadingImage"
                contained
                persistent
                class="align-center justify-center"
                scrim="surface"
                opacity="0.9"
              >
                <div class="text-center">
                  <v-progress-circular indeterminate size="64" color="primary" />
                  <div class="text-h6 mt-4">{{ $t('common.uploading') }}</div>
                </div>
              </v-overlay>

              <ClientOnly>
                <MdEditor
                  ref="editorRef"
                  v-model="sessionForm.notes"
                  :language="currentLocale"
                  :theme="editorTheme"
                  :placeholder="$t('sessions.notesPlaceholder')"
                  :on-upload-img="handleImageUpload"
                  :toolbars="toolbars"
                  :sanitize="sanitizeHtml"
                  style="height: 500px"
                  class="mb-4"
                  @click="handleEditorClick"
                  @cancel.stop.prevent
                >
                  <!-- Custom Entity Link Buttons -->
                  <template #defToolbars>
                    <NormalToolbar
                      :title="$t('sessions.linkNpc')"
                      @on-click="showLinkEntityDialog('npc')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"
                          />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkLocation')"
                      @on-click="showLinkEntityDialog('location')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z"
                          />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkItem')"
                      @on-click="showLinkEntityDialog('item')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M6.92,5H5L14,14L15,13.06M19.96,19.12L19.12,19.96C18.73,20.35 18.1,20.35 17.71,19.96L14.59,16.84L11.91,19.5L10.5,18.09L13.16,15.43L11.06,13.33L8.85,15.54L7.44,14.13L9.65,11.92L6.5,8.77L7.91,7.36L11.06,10.5L13.27,8.29L9.12,4.12C8.73,3.73 8.73,3.1 9.12,2.71L9.96,1.87C10.35,1.5 10.98,1.5 11.37,1.87L19.96,10.46C20.35,10.85 20.35,11.5 19.96,11.87L19.12,12.71C18.73,13.1 18.1,13.1 17.71,12.71L15.92,10.92L13.71,13.13L15.81,15.23L18.5,12.54L19.91,13.95L17.22,16.64L19.96,19.38C20.35,19.77 20.35,20.4 19.96,20.79Z"
                          />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkFaction')"
                      @on-click="showLinkEntityDialog('faction')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z"
                          />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkLore')"
                      @on-click="showLinkEntityDialog('lore')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M21,4H7A2,2 0 0,0 5,6V17H21V16L23,14V6C23,4.89 22.1,4 21,4M21,14H7V6H21M3,19V8H1V19A2,2 0 0,0 3,21H19V19"
                          />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('sessions.linkPlayer')"
                      @on-click="showLinkEntityDialog('player')"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17V18.1H18.1V17C18.1,16.36 14.97,14.9 12,14.9M18,9V12H15V13H18V16H19V13H22V12H19V9H18Z"
                          />
                        </svg>
                      </template>
                    </NormalToolbar>
                    <NormalToolbar
                      :title="$t('documents.imageGallery')"
                      @on-click="openImageGallery"
                    >
                      <template #trigger>
                        <svg class="md-editor-icon" aria-hidden="true" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22,16V4A2,2 0 0,0 20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16M11,12L13.03,14.71L16,11L20,16H8M2,6V20A2,2 0 0,0 4,22H18V20H4V6"
                          />
                        </svg>
                      </template>
                    </NormalToolbar>
                  </template>
                </MdEditor>
              </ClientOnly>
            </div>
          </template>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving || uploadingAudio" @click="closeDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!sessionForm.title || uploadingAudio"
            :loading="saving"
            @click="saveSession"
          >
            {{ editingSession ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Entity Link Dialog -->
    <v-dialog v-model="showEntityLinkDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{
            $t(`sessions.link${linkEntityType.charAt(0).toUpperCase() + linkEntityType.slice(1)}`)
          }}
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
              <v-list-item-title>
                {{ entity.displayName || entity.name }}
                <span v-if="entity.subtitle" class="text-caption text-medium-emphasis ml-2">
                  ({{ entity.subtitle }})
                </span>
              </v-list-item-title>
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
    <v-dialog v-model="showViewDialog" max-width="900" scrollable>
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

        <v-card-text style="max-height: 70vh">
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
              style="height: auto"
              @click="handleEditorClick"
            />
          </ClientOnly>
        </v-card-text>

        <v-card-actions>
          <v-btn
            variant="text"
            prepend-icon="mdi-pencil"
            @click="editSessionAndCloseView(viewingSession)"
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
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('sessions.deleteTitle')"
      :message="$t('sessions.deleteConfirm', { title: deletingSession?.title })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Image Gallery Dialog -->
    <v-dialog v-model="showImageGallery" max-width="1200" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-image-multiple" class="mr-2" />
          {{ $t('documents.imageGallery') }}
        </v-card-title>
        <v-card-text style="max-height: 600px">
          <v-row v-if="galleryImages.length > 0">
            <v-col v-for="image in galleryImages" :key="image" cols="6" sm="4" md="3">
              <v-card hover class="image-card" @click="insertImageFromGallery(image)">
                <v-img :src="`/pictures/${image}`" aspect-ratio="1" cover class="cursor-pointer" />
              </v-card>
            </v-col>
          </v-row>
          <v-empty-state
            v-else
            icon="mdi-image-off"
            :title="$t('documents.noImages')"
            :text="$t('documents.noImagesText')"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showImageGallery = false">{{ $t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Entity Quick View Dialog -->
    <SharedEntityPreviewDialog
      v-model="showEntityDialog"
      :entity-type="viewingEntityType"
      :entity-id="previewEntityId"
    />

    <!-- Image Preview Dialog -->
    <SharedImagePreviewDialog
      v-model="showImagePreview"
      :image-url="previewImageUrl"
      :title="previewImageTitle"
    />
  </v-container>
</template>

<script setup lang="ts">
import { MdEditor, NormalToolbar, MdPreview } from 'md-editor-v3'
import type { ToolbarNames } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { useTheme } from 'vuetify'

interface Session {
  id: number
  session_number: number | null
  title: string
  date: string | null
  summary: string | null
  notes: string | null
  in_game_date_start: string | null
  in_game_date_end: string | null
  in_game_day_start: number | null
  in_game_day_end: number | null
  duration_minutes: number | null
  created_at: string
  updated_at: string
  cover_image_url: string | null
}

interface EntityMention {
  type: 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player'
  id: number
  name: string
}

const router = useRouter()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()
const theme = useTheme()
const { locale } = useI18n()

// Calendar integration
const {
  calendarData,
  loadCalendar,
  formatAbsoluteDay,
} = useInGameCalendar()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)
const currentLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))
const editorTheme = computed<'light' | 'dark'>(() =>
  theme.global.current.value.dark ? 'dark' : 'light',
)

onMounted(async () => {
  await Promise.all([
    loadSessions(),
    loadCalendar(),
    entitiesStore.fetchNPCs(activeCampaignId.value!),
    entitiesStore.fetchLocations(activeCampaignId.value!),
    entitiesStore.fetchItems(activeCampaignId.value!),
    entitiesStore.fetchFactions(activeCampaignId.value!),
    entitiesStore.fetchLore(activeCampaignId.value!),
    entitiesStore.fetchPlayers(activeCampaignId.value!),
  ])
})

const sessions = ref<Session[]>([])
const pending = ref(false)

// Form state
const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
const showEntityLinkDialog = ref(false)
const showEntityDialog = ref(false)
const showImageGallery = ref(false)
const galleryImages = ref<string[]>([])
const editingSession = ref<Session | null>(null)
const viewingSession = ref<Session | null>(null)
const deletingSession = ref<Session | null>(null)
const viewingEntityType = ref<'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player'>('npc')
const previewEntityId = ref<number | null>(null)
const saving = ref(false)
const deleting = ref(false)
const uploadingImage = ref(false)
const uploadingAudio = ref(false)
const sessionDialogTab = ref('details')

// Image preview state
const showImagePreview = ref(false)
const previewImageUrl = ref('')
const previewImageTitle = ref('')

// Image preview function
function openImagePreview(url: string, title: string) {
  previewImageUrl.value = url
  previewImageTitle.value = title
  showImagePreview.value = true
}

// Reload sessions when images are updated
async function reloadSessions() {
  await loadSessions()
}

// Attendance tracking
interface PlayerEntity {
  id: number
  name: string
  image_url?: string | null
  metadata?: { player_name?: string | null } | null
}
const sessionAttendance = ref<Record<number, boolean>>({})
const loadingAttendance = ref(false)
const allPlayers = computed<PlayerEntity[]>(() => entitiesStore.players || [])
const attendanceCount = computed(() => Object.values(sessionAttendance.value).filter(Boolean).length)

const sessionForm = ref({
  title: '',
  session_number: null as number | null,
  date: '',
  summary: '',
  notes: '',
  in_game_date_start: '',
  in_game_date_end: '',
  in_game_day_start: null as number | null,
  in_game_day_end: null as number | null,
  duration_minutes: null as number | null,
})

// Validate in-game dates: start should never be after end
watch(
  () => sessionForm.value.in_game_day_start,
  (newStart) => {
    if (
      newStart !== null &&
      sessionForm.value.in_game_day_end !== null &&
      newStart > sessionForm.value.in_game_day_end
    ) {
      // Start is after end - adjust end to match start
      sessionForm.value.in_game_day_end = newStart
    }
  },
)

watch(
  () => sessionForm.value.in_game_day_end,
  (newEnd) => {
    if (
      newEnd !== null &&
      sessionForm.value.in_game_day_start !== null &&
      newEnd < sessionForm.value.in_game_day_start
    ) {
      // End is before start - adjust start to match end
      sessionForm.value.in_game_day_start = newEnd
    }
  },
)

// Entity linking
const linkEntityType = ref<'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player'>('npc')
const entitySearch = ref('')
const notesTextarea = ref<{ $el: HTMLElement } | null>(null)

type EditorInsertBlock = {
  targetValue: string
  select?: boolean
  deviationStart?: number
  deviationEnd?: number
}
interface MdEditorExpose {
  insert: (gen: () => EditorInsertBlock) => void
}
const editorRef = ref<MdEditorExpose | null>(null)

// md-editor Toolbars: 0-6 = Placeholders for custom buttons
type ToolbarOrSlot = ToolbarNames | 0 | 1 | 2 | 3 | 4 | 5 | 6
const toolbars: ToolbarOrSlot[] = [
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
  'image',
  0, // NPC
  1, // Location
  2, // Item
  3, // Faction
  4, // Lore
  5, // Player
  6, // Gallery
  'table',
  '-',
  'revoke',
  'next',
  '=',
  // 'pageFullscreen',
  'preview',
  // 'catalog',
]

const filteredEntities = computed(() => {
  const query = entitySearch.value?.toLowerCase() || ''
  let entities: Array<{ id: number; name: string; displayName?: string; subtitle?: string }> = []

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
  case 'lore':
    entities = entitiesStore.loreForSelect || []
    break
  case 'player':
    // For players: displayName = human name (Spielername), subtitle = character name
    entities = (entitiesStore.players || []).map((p) => ({
      id: p.id,
      name: p.name, // Character name (used for linking)
      displayName: p.metadata?.player_name || p.name, // Human player name shown first
      subtitle: p.metadata?.player_name ? p.name : undefined, // Character name as subtitle if player_name exists
    }))
    break
  }

  if (!query) return entities

  // For players, also search in displayName
  return entities.filter((e) => {
    const nameMatch = e.name.toLowerCase().includes(query)
    const displayMatch = e.displayName?.toLowerCase().includes(query)
    return nameMatch || displayMatch
  })
})

// Helper to resolve entity name from stores
function resolveEntityName(type: string, id: number): string {
  switch (type) {
  case 'npc':
    return entitiesStore.npcs?.find((e) => e.id === id)?.name || `NPC #${id}`
  case 'location':
    return entitiesStore.locations?.find((e) => e.id === id)?.name || `Location #${id}`
  case 'item':
    return entitiesStore.items?.find((e) => e.id === id)?.name || `Item #${id}`
  case 'faction':
    return entitiesStore.factions?.find((e) => e.id === id)?.name || `Faction #${id}`
  case 'lore':
    return entitiesStore.lore?.find((e) => e.id === id)?.name || `Lore #${id}`
  case 'player': {
    const player = entitiesStore.players?.find((e) => e.id === id)
    // Return character name (name field), human name is shown separately
    return player?.name || `Player #${id}`
  }
  default:
    return `Entity #${id}`
  }
}

// Helper to get player's human name (for display alongside character name)
function resolvePlayerHumanName(id: number): string | null {
  const player = entitiesStore.players?.find((e) => e.id === id)
  return player?.metadata?.player_name || null
}

const extractedMentions = computed(() => {
  const mentions: EntityMention[] = []
  const text = sessionForm.value.notes || ''
  const seen = new Set<number>()

  // Parse new format {{type:id}}
  const newFormatRegex = /\{\{(\w+):(\d+)\}\}/g
  let match

  while ((match = newFormatRegex.exec(text)) !== null) {
    const type = match[1] as EntityMention['type']
    const id = Number.parseInt(match[2]!, 10)

    if (!seen.has(id)) {
      seen.add(id)
      mentions.push({
        type,
        id,
        name: resolveEntityName(type, id),
      })
    }
  }

  // Also parse legacy format [Name](type:id) for backwards compatibility
  const legacyRegex = /\[([^\]]+)\]\((\w+):(\d+)\)/g
  while ((match = legacyRegex.exec(text)) !== null) {
    const type = match[2] as EntityMention['type']
    const id = Number.parseInt(match[3]!, 10)

    if (!seen.has(id)) {
      seen.add(id)
      // For legacy format, still resolve dynamically (ignore stored name)
      mentions.push({
        type,
        id,
        name: resolveEntityName(type, id),
      })
    }
  }

  return mentions
})

async function loadSessions() {
  if (!activeCampaignId.value!) return

  pending.value = true
  try {
    const data = await $fetch<Session[]>('/api/sessions', {
      query: { campaignId: activeCampaignId.value },
    })
    sessions.value = data.sort((a, b) => {
      // Sort by session number descending, then by date descending
      if (a.session_number && b.session_number) return b.session_number - a.session_number

      if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime()

      return 0
    })
  } catch (error) {
    console.error('Failed to load sessions:', error)
    sessions.value = []
  } finally {
    pending.value = false
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return '-'

  return new Date(dateString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

function countMentionsInNotes(notes: string | null): number {
  if (!notes) return 0
  // Count {{type:id}} format
  const newFormat = (notes.match(/\{\{(\w+):(\d+)\}\}/g) || []).length
  // Count legacy [Name](type:id) format
  const legacyFormat = (notes.match(/\[([^\]]+)\]\((\w+):(\d+)\)/g) || []).length
  return newFormat + legacyFormat
}

function sanitizeHtml(html: string): string {
  // This is called by md-editor-v3 to sanitize/transform the HTML

  // Helper to build entity badge HTML
  const buildBadge = (type: string, id: string, entityId: number) => {
    const name = resolveEntityName(type, entityId)
    const icon = getEntityIcon(type)
    const color = getEntityColor(type)

    // For players: Show Spielername (human name) big, character name small
    // If no Spielername set, show character name in italics
    let displayHtml = name
    if (type === 'player') {
      const humanName = resolvePlayerHumanName(entityId)
      if (humanName) {
        // Spielername groß, Character-Name klein in Klammern
        displayHtml = `${humanName} <span style="font-size: 0.75rem; opacity: 0.8;">(${name})</span>`
      } else {
        // Kein Spielername - Character name kursiv
        displayHtml = `<em>${name}</em>`
      }
    }

    return `<span class="entity-badge" data-type="${type}" data-id="${id}" style="background-color: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"><i class="mdi ${icon}"></i>${displayHtml}</span>`
  }

  // First: Handle new format {{type:id}} - resolve name dynamically
  let result = html.replace(/\{\{(\w+):(\d+)\}\}/g, (_match, type, id) => {
    const entityId = parseInt(id, 10)
    return buildBadge(type, id, entityId)
  })

  // Second: Handle legacy format [Name](type:id) - keep for backwards compatibility
  result = result.replace(/<a[^>]*href="(\w+):(\d+)"[^>]*>([^<]+)<\/a>/g, (_match, type, id, _name) => {
    const entityId = parseInt(id, 10)
    return buildBadge(type, id, entityId)
  })

  return result
}

function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    npc: 'mdi-account',
    location: 'mdi-map-marker',
    item: 'mdi-sword',
    faction: 'mdi-shield',
    lore: 'mdi-book-open-variant',
    player: 'mdi-account-star',
  }
  return icons[type] || 'mdi-link'
}

function getEntityColor(type: string): string {
  const colors: Record<string, string> = {
    npc: '#D4A574',
    location: '#8B7355',
    item: '#CC8844',
    faction: '#7B92AB',
    lore: '#9C6B98',
    player: '#4CAF50',
  }
  return colors[type] || '#888888'
}

function showLinkEntityDialog(type: 'npc' | 'location' | 'item' | 'faction' | 'lore' | 'player') {
  linkEntityType.value = type
  entitySearch.value = ''
  showEntityLinkDialog.value = true
}

function insertEntityLink(entity: { id: number; name: string }) {
  // New format: {{type:id}} - name is resolved dynamically when rendering
  const link = `{{${linkEntityType.value}:${entity.id}}}`

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
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = sessionForm.value.notes || ''
  const selectedText = text.substring(start, end)

  sessionForm.value.notes =
    text.substring(0, start) + before + selectedText + after + text.substring(end)

  // Restore cursor position
  nextTick(() => {
    textarea.focus()
    textarea.selectionStart = start + before.length
    textarea.selectionEnd = start + before.length + selectedText.length
  })
}

function removeMention(mention: EntityMention) {
  // Try new format first {{type:id}}
  const newFormatLink = `{{${mention.type}:${mention.id}}}`
  if (sessionForm.value.notes?.includes(newFormatLink)) {
    sessionForm.value.notes = sessionForm.value.notes.replace(newFormatLink, mention.name)
    return
  }

  // Fallback to legacy format [Name](type:id)
  const legacyPattern = new RegExp(`\\[([^\\]]+)\\]\\(${mention.type}:${mention.id}\\)`, 'g')
  sessionForm.value.notes = sessionForm.value.notes?.replace(legacyPattern, mention.name) || ''
}

function navigateToEntity(mention: EntityMention) {
  const paths: Record<string, string> = {
    npc: '/npcs',
    location: '/locations',
    item: '/items',
    faction: '/factions',
    lore: '/lore',
    player: '/players',
  }
  router.push(`${paths[mention.type]}?id=${mention.id}`)
}

async function handleEditorClick(event: MouseEvent) {
  // Handle clicks on entity badges in the editor preview
  const target = event.target as HTMLElement
  const badge = target.closest('.entity-badge')

  if (badge) {
    event.preventDefault()
    event.stopPropagation()

    const type = badge.getAttribute('data-type') as
      | 'npc'
      | 'location'
      | 'item'
      | 'faction'
      | 'lore'
      | 'player'
    const id = badge.getAttribute('data-id')

    if (type && id) {
      previewEntityId.value = Number.parseInt(id)
      viewingEntityType.value = type
      showEntityDialog.value = true
    }
  }
}

function viewSession(session: Session) {
  viewingSession.value = session
  showViewDialog.value = true
}

async function editSession(session: Session) {
  editingSession.value = session
  sessionForm.value = {
    title: session.title,
    session_number: session.session_number,
    date: session.date || '',
    summary: session.summary || '',
    notes: session.notes || '',
    in_game_date_start: session.in_game_date_start || '',
    in_game_date_end: session.in_game_date_end || '',
    in_game_day_start: session.in_game_day_start,
    in_game_day_end: session.in_game_day_end,
    duration_minutes: session.duration_minutes,
  }
  showCreateDialog.value = true
  sessionDialogTab.value = 'details'

  // Load attendance data
  loadingAttendance.value = true
  sessionAttendance.value = {}
  try {
    interface AttendanceRecord {
      player_id: number
      attended: number
    }
    const attendance = await $fetch<AttendanceRecord[]>(`/api/sessions/${session.id}/attendance`)
    for (const record of attendance) {
      sessionAttendance.value[record.player_id] = record.attended === 1
    }
  } catch (error) {
    console.error('Failed to load attendance:', error)
  } finally {
    loadingAttendance.value = false
  }
}

function editSessionAndCloseView(session: Session) {
  editSession(session)
  showViewDialog.value = false
}

function deleteSession(session: Session) {
  deletingSession.value = session
  showDeleteDialog.value = true
}

async function saveSession() {
  if (!sessionForm.value.title || !activeCampaignId.value!) return

  saving.value = true

  try {
    if (editingSession.value) {
      await $fetch(`/api/sessions/${editingSession.value.id}`, {
        method: 'PATCH',
        body: sessionForm.value,
      })

      // Save attendance
      const attendanceData = Object.entries(sessionAttendance.value).map(([playerId, attended]) => ({
        player_id: Number(playerId),
        attended,
      }))
      await $fetch(`/api/sessions/${editingSession.value.id}/attendance`, {
        method: 'POST',
        body: { attendance: attendanceData },
      })
    } else {
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
  } catch (error) {
    console.error('Failed to save session:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingSession.value) return

  deleting.value = true

  try {
    await $fetch(`/api/sessions/${deletingSession.value.id}`, {
      method: 'DELETE',
    })
    await loadSessions()
    showDeleteDialog.value = false
    deletingSession.value = null
  } catch (error) {
    console.error('Failed to delete session:', error)
  } finally {
    deleting.value = false
  }
}

async function handleImageUpload(files: File[], callback: (urls: string[]) => void) {
  uploadingImage.value = true
  const uploaded: string[] = []
  try {
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('image', file)
        const res = await $fetch<{ image_url: string }>('/api/documents/upload-image', {
          method: 'POST',
          body: formData,
        })
        uploaded.push(res.image_url)
      } catch (e) {
        console.error('Failed to upload image:', e)
      }
    }
    // md-editor expects final URLs
    callback(uploaded.map((u) => (u.startsWith('/pictures/') ? u : `/pictures/${u}`)))
  } finally {
    uploadingImage.value = false
  }
}

async function openImageGallery() {
  showImageGallery.value = true
  try {
    const images = await $fetch<string[]>('/api/documents/images')
    galleryImages.value = images ?? []
  } catch (e) {
    console.error('Failed to load images:', e)
    galleryImages.value = []
  }
}

function insertImageFromGallery(image: string) {
  const src = image.startsWith('/pictures/') ? image : `/pictures/${image}`
  const markdown = `![](${src})`

  // Use md-editor's insert API to insert at cursor position
  if (editorRef.value) {
    editorRef.value.insert(() => ({
      targetValue: markdown,
      select: false,
      deviationStart: 0,
      deviationEnd: 0,
    }))
  } else {
    // Fallback: append at end
    sessionForm.value.notes += `\n${markdown}\n`
  }

  showImageGallery.value = false
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
    in_game_date_start: '',
    in_game_date_end: '',
    in_game_day_start: null,
    in_game_day_end: null,
    duration_minutes: null,
  }
  sessionAttendance.value = {}
  sessionDialogTab.value = 'details'
}
</script>

<style scoped>
/* Sessions Timeline Layout - give more space to cards */
.sessions-timeline {
  padding-left: 0;
}

.sessions-timeline :deep(.v-timeline-item__opposite) {
  flex: 0 0 180px;
  max-width: 180px;
  min-width: 180px;
}

.sessions-timeline :deep(.v-timeline-item__body) {
  flex: 1;
  max-width: calc(100% - 220px);
}

.timeline-date-section {
  padding-right: 8px;
}

.session-card {
  width: 100%;
}

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

.image-card {
  cursor: pointer;
}
</style>
>