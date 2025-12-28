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

    <!-- Global Campaign Pinboard -->
    <div class="sticky-pinboard mb-4">
      <SharedPinboard ref="pinboardRef" />
    </div>

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
              {{ formatRealDate(session.date) }}
            </div>
            <!-- In-Game Date -->
            <div v-if="session.in_game_year_start" class="text-caption text-primary mt-1">
              <v-icon size="x-small" class="mr-1">mdi-sword-cross</v-icon>
              {{ formatSessionDate(session) }}
              <span v-if="session.in_game_year_end && hasDateRange(session)">
                <br/>→ {{ formatSessionEndDate(session) }}
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

    <template v-else>
      <ClientOnly>
        <v-empty-state
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
      </ClientOnly>
    </template>

    <!-- Create/Edit Session Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="1200" scrollable persistent>
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

              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="sessionForm.date"
                    :label="$t('sessions.date')"
                    type="date"
                    variant="outlined"
                  />
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

              <!-- In-Game Timeline Section -->
              <v-card variant="outlined" class="mb-4">
                <v-card-title class="d-flex align-center py-2">
                  <v-icon start size="small">mdi-sword-cross</v-icon>
                  {{ $t('sessions.inGameTimeline') }}
                  <v-spacer />
                  <v-btn
                    v-if="calendarData"
                    size="small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-calendar-today"
                    @click="setInGameDateToToday"
                  >
                    {{ $t('sessions.setToToday') }}
                  </v-btn>
                </v-card-title>
                <v-card-text class="pt-0">
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-label class="text-subtitle-2 mb-2">{{ $t('sessions.inGameDateStart') }}</v-label>
                      <CalendarInGameDatePicker
                        v-model="inGameDateStart"
                        :calendar-data="calendarData"
                      />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-label class="text-subtitle-2 mb-2">{{ $t('sessions.inGameDateEnd') }}</v-label>
                      <CalendarInGameDatePicker
                        v-model="inGameDateEnd"
                        :calendar-data="calendarData"
                      />
                      <p class="text-caption text-medium-emphasis mt-1">
                        {{ $t('sessions.inGameDateEndHint') }}
                      </p>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>

              <v-textarea
                v-model="sessionForm.summary"
                :label="$t('sessions.summary')"
                :placeholder="$t('sessions.summaryPlaceholder')"
                variant="outlined"
                rows="3"
                class="mb-4"
                persistent-placeholder
              />

              <div class="d-flex align-center mb-4">
                <div class="text-h6">
                  {{ $t('sessions.notes') }}
                </div>
                <v-spacer />
                <v-btn
                  v-if="sessionForm.notes && sessionForm.notes.trim().length > 10"
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="mdi-auto-fix"
                  :loading="smoothingText"
                  :disabled="smoothingText || !hasApiKey"
                  @click="smoothNotesText"
                >
                  {{ $t('sessions.smoothText') }}
                </v-btn>
              </div>

              <div class="position-relative">
                <v-overlay
                  :model-value="uploadingImage || smoothingText"
                  contained
                  persistent
                  class="align-center justify-center"
                  scrim="surface"
                  opacity="0.9"
                >
                  <div class="text-center">
                    <v-progress-circular indeterminate size="64" color="primary" />
                    <div class="text-h6 mt-4">{{ smoothingText ? $t('sessions.smoothingText') : $t('common.uploading') }}</div>
                  </div>
                </v-overlay>

                <SharedEntityMarkdownEditor
                  ref="editorRef"
                  v-model="sessionForm.notes"
                  :placeholder="$t('sessions.notesPlaceholder')"
                  :sessions="sessions"
                  height="500px"
                  show-image-gallery-button
                  @open-image-gallery="openImageGallery"
                  @upload-image="handleImageUpload"
                />
              </div>
            </v-tabs-window-item>

            <!-- Cover Tab -->
            <v-tabs-window-item value="cover">
              <SessionsSessionImageGallery
                v-if="editingSession"
                :session-id="editingSession.id"
                :session-title="sessionForm.title"
                @preview-image="openImagePreview"
                @images-updated="reloadSessions"
                @generating="generatingImage = $event"
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

            <v-row>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="sessionForm.date"
                  :label="$t('sessions.date')"
                  type="date"
                  variant="outlined"
                />
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

            <!-- In-Game Timeline Section -->
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="d-flex align-center py-2">
                <v-icon start size="small">mdi-sword-cross</v-icon>
                {{ $t('sessions.inGameTimeline') }}
                <v-spacer />
                <v-btn
                  v-if="calendarData"
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="mdi-calendar-today"
                  @click="setInGameDateToToday"
                >
                  {{ $t('sessions.setToToday') }}
                </v-btn>
              </v-card-title>
              <v-card-text class="pt-0">
                <v-row>
                  <v-col cols="12" md="6">
                    <v-label class="text-subtitle-2 mb-2">{{ $t('sessions.inGameDateStart') }}</v-label>
                    <CalendarInGameDatePicker
                      v-model="inGameDateStart"
                      :calendar-data="calendarData"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-label class="text-subtitle-2 mb-2">{{ $t('sessions.inGameDateEnd') }}</v-label>
                    <CalendarInGameDatePicker
                      v-model="inGameDateEnd"
                      :calendar-data="calendarData"
                    />
                    <p class="text-caption text-medium-emphasis mt-1">
                      {{ $t('sessions.inGameDateEndHint') }}
                    </p>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <v-textarea
              v-model="sessionForm.summary"
              :label="$t('sessions.summary')"
              :placeholder="$t('sessions.summaryPlaceholder')"
              variant="outlined"
              rows="3"
              class="mb-4"
              persistent-placeholder
            />

            <div class="d-flex align-center mb-4">
              <div class="text-h6">
                {{ $t('sessions.notes') }}
              </div>
              <v-spacer />
              <v-btn
                v-if="sessionForm.notes && sessionForm.notes.trim().length > 10"
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-auto-fix"
                :loading="smoothingText"
                :disabled="smoothingText || !hasApiKey"
                @click="smoothNotesText"
              >
                {{ $t('sessions.smoothText') }}
              </v-btn>
            </div>

            <div class="position-relative">
              <v-overlay
                :model-value="uploadingImage || smoothingText"
                contained
                persistent
                class="align-center justify-center"
                scrim="surface"
                opacity="0.9"
              >
                <div class="text-center">
                  <v-progress-circular indeterminate size="64" color="primary" />
                  <div class="text-h6 mt-4">{{ smoothingText ? $t('sessions.smoothingText') : $t('common.uploading') }}</div>
                </div>
              </v-overlay>

              <SharedEntityMarkdownEditor
                ref="editorRef"
                v-model="sessionForm.notes"
                :placeholder="$t('sessions.notesPlaceholder')"
                :sessions="sessions"
                height="500px"
                show-image-gallery-button
                @open-image-gallery="openImageGallery"
                @upload-image="handleImageUpload"
              />
            </div>
          </template>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="saving || uploadingAudio || generatingImage" @click="closeDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!sessionForm.title || uploadingAudio || generatingImage"
            :loading="saving"
            @click="saveSession"
          >
            {{ editingSession ? $t('common.save') : $t('common.create') }}
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
          {{ formatRealDate(viewingSession.date) }}
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

    <!-- Floating Action Button -->
    <v-btn
      color="primary"
      icon="mdi-plus"
      size="large"
      class="fab-create"
      @click="showCreateDialog = true"
    />
  </v-container>
</template>

<script setup lang="ts">
import { MdPreview } from 'md-editor-v3'
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
  in_game_year_start: number | null
  in_game_month_start: number | null
  in_game_day_start: number | null // Day of month (1-31)
  in_game_year_end: number | null
  in_game_month_end: number | null
  in_game_day_end: number | null // Day of month (1-31)
  duration_minutes: number | null
  created_at: string
  updated_at: string
  cover_image_url: string | null
}

// Date value object for CalendarInGameDatePicker
interface InGameDateValue {
  year: number
  month: number
  day: number
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
  formatDate,
  getCurrentDate,
  dateToAbsoluteDay,
} = useInGameCalendar()

// Format a session's in-game start date for display
function formatSessionDate(session: Session): string {
  if (!session.in_game_year_start || !session.in_game_month_start || !session.in_game_day_start) {
    return ''
  }
  if (!calendarData.value) return ''
  const monthData = calendarData.value.months[session.in_game_month_start - 1]
  return formatDate({
    year: session.in_game_year_start,
    month: session.in_game_month_start,
    day: session.in_game_day_start,
    monthName: monthData?.name || '',
  })
}

// Format a session's in-game end date for display
function formatSessionEndDate(session: Session): string {
  if (!session.in_game_year_end || !session.in_game_month_end || !session.in_game_day_end) {
    return ''
  }
  if (!calendarData.value) return ''
  const monthData = calendarData.value.months[session.in_game_month_end - 1]
  return formatDate({
    year: session.in_game_year_end,
    month: session.in_game_month_end,
    day: session.in_game_day_end,
    monthName: monthData?.name || '',
  })
}

// Check if session has a different end date than start
function hasDateRange(session: Session): boolean {
  return (
    session.in_game_year_start !== session.in_game_year_end ||
    session.in_game_month_start !== session.in_game_month_end ||
    session.in_game_day_start !== session.in_game_day_end
  )
}

// Set both start and end in-game dates to "today" from the calendar
function setInGameDateToToday() {
  const today = getCurrentDate()
  if (today) {
    inGameDateStart.value = { year: today.year, month: today.month, day: today.day }
    inGameDateEnd.value = { year: today.year, month: today.month, day: today.day }
  }
}

const activeCampaignId = computed(() => campaignStore.activeCampaignId)
const currentLocale = computed(() => (locale.value === 'de' ? 'de-DE' : 'en-US'))
const editorTheme = computed<'light' | 'dark'>(() =>
  theme.global.current.value.dark ? 'dark' : 'light',
)

onMounted(async () => {
  // Check API key availability for AI features
  try {
    const result = await $fetch<{ hasKey: boolean }>('/api/settings/openai-key/check')
    hasApiKey.value = result.hasKey
  } catch {
    hasApiKey.value = false
  }

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

// Pinboard ref (exposed methods: refresh, addPin)
const pinboardRef = ref<{ refresh: () => void; addPin: (entityId: number) => Promise<boolean | undefined> } | null>(null)

// Form state
const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const showDeleteDialog = ref(false)
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
const generatingImage = ref(false)
const smoothingText = ref(false)
const hasApiKey = ref(false)
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

// AI text smoothing function
async function smoothNotesText() {
  if (!sessionForm.value.notes || smoothingText.value) return

  smoothingText.value = true
  try {
    const result = await $fetch<{ text: string }>('/api/ai/smooth-text', {
      method: 'POST',
      body: {
        text: sessionForm.value.notes,
        language: locale.value,
      },
    })
    if (result.text) {
      sessionForm.value.notes = result.text
    }
  } catch (error) {
    console.error('Failed to smooth text:', error)
  } finally {
    smoothingText.value = false
  }
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
  duration_minutes: null as number | null,
})

// Separate refs for in-game date objects (used by CalendarInGameDatePicker)
const inGameDateStart = ref<InGameDateValue | null>(null)
const inGameDateEnd = ref<InGameDateValue | null>(null)

// Helper to convert date object to absolute day for comparison
function dateToAbsolute(date: InGameDateValue | null): number {
  if (!date || !calendarData.value) return 0
  return dateToAbsoluteDay(date.year, date.month, date.day, calendarData.value)
}

// Validate in-game dates: start should never be after end
watch(
  inGameDateStart,
  (newStart) => {
    if (newStart && inGameDateEnd.value) {
      const startAbs = dateToAbsolute(newStart)
      const endAbs = dateToAbsolute(inGameDateEnd.value)
      if (startAbs > endAbs) {
        // Start is after end - adjust end to match start
        inGameDateEnd.value = { ...newStart }
      }
    }
  },
  { deep: true },
)

watch(
  inGameDateEnd,
  (newEnd) => {
    if (newEnd) {
      if (!inGameDateStart.value) {
        // End is set but start is not - set start to same as end
        inGameDateStart.value = { ...newEnd }
      } else {
        const startAbs = dateToAbsolute(inGameDateStart.value)
        const endAbs = dateToAbsolute(newEnd)
        if (endAbs < startAbs) {
          // End is before start - adjust start to match end
          inGameDateStart.value = { ...newEnd }
        }
      }
    }
  },
  { deep: true },
)

// Editor ref for image gallery insertion
interface EditorExpose {
  insert: (text: string) => void
}
const editorRef = ref<EditorExpose | null>(null)

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

function formatRealDate(dateString: string | null) {
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

  // First: Remove entity links from heading IDs to prevent broken HTML
  // The markdown parser generates IDs like id="heading-npc123" from "### Heading {{npc:123}}"
  // If we replace {{npc:123}} everywhere, the ID becomes invalid HTML
  let result = html.replace(/(<h[1-6][^>]*id=")([^"]*)(">)/g, (_match, prefix, idContent, suffix) => {
    // Remove any {{type:id}} patterns from the ID
    const cleanedId = idContent.replace(/\{\{\w+:\d+\}\}/g, '').replace(/--+/g, '-').replace(/-$/g, '')
    return prefix + cleanedId + suffix
  })

  // Second: Handle new format {{type:id}} - resolve name dynamically
  result = result.replace(/\{\{(\w+):(\d+)\}\}/g, (_match, type, id) => {
    const entityId = parseInt(id, 10)
    return buildBadge(type, id, entityId)
  })

  // Third: Handle legacy format [Name](type:id) - keep for backwards compatibility
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
    duration_minutes: session.duration_minutes,
  }
  // Set in-game date refs
  inGameDateStart.value =
    session.in_game_year_start && session.in_game_month_start && session.in_game_day_start
      ? { year: session.in_game_year_start, month: session.in_game_month_start, day: session.in_game_day_start }
      : null
  inGameDateEnd.value =
    session.in_game_year_end && session.in_game_month_end && session.in_game_day_end
      ? { year: session.in_game_year_end, month: session.in_game_month_end, day: session.in_game_day_end }
      : null
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

  // Build the session data with year/month/day fields
  const sessionData = {
    ...sessionForm.value,
    in_game_year_start: inGameDateStart.value?.year || null,
    in_game_month_start: inGameDateStart.value?.month || null,
    in_game_day_start: inGameDateStart.value?.day || null,
    in_game_year_end: inGameDateEnd.value?.year || null,
    in_game_month_end: inGameDateEnd.value?.month || null,
    in_game_day_end: inGameDateEnd.value?.day || null,
  }

  try {
    if (editingSession.value) {
      await $fetch(`/api/sessions/${editingSession.value.id}`, {
        method: 'PATCH',
        body: sessionData,
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
          ...sessionData,
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

  // Use the EntityMarkdownEditor's insert API
  if (editorRef.value) {
    editorRef.value.insert(markdown)
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
    duration_minutes: null,
  }
  // Reset in-game date refs
  inGameDateStart.value = null
  inGameDateEnd.value = null
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
  min-width: 350px;
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

/* Floating Action Button */
.fab-create {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}

/* Sticky Pinboard */
.sticky-pinboard {
  position: sticky;
  top: 8px;
  z-index: 10;
}
</style>
>