<template>
  <v-container>
    <!-- Redirect to campaigns if no campaign selected -->
    <div v-if="!campaignId" class="text-center py-16">
      <v-icon icon="mdi-notebook" size="64" class="mb-4" color="primary" />
      <h2 class="text-h4 mb-4">
        {{ $t('notes.noCampaign.title') }}
      </h2>
      <p class="text-body-1 text-medium-emphasis mb-6">
        {{ $t('notes.noCampaign.description') }}
      </p>
      <v-btn color="primary" size="large" to="/campaigns" prepend-icon="mdi-arrow-right">
        {{ $t('notes.noCampaign.button') }}
      </v-btn>
    </div>

    <div v-else>
      <!-- Header -->
      <v-row>
        <v-col cols="12">
          <div class="d-flex align-center justify-space-between mb-4">
            <div>
              <div class="text-h4 mb-2">
                <v-icon icon="mdi-notebook-outline" size="36" class="mr-2" />
                {{ $t('notes.title') }}
              </div>
              <p class="text-body-1 text-medium-emphasis">
                {{ $t('notes.subtitle') }}
              </p>
            </div>
            <v-chip color="primary" variant="tonal">
              {{ notesStore.noteCount }} {{ $t('notes.count') }}
            </v-chip>
          </div>
        </v-col>
      </v-row>

      <!-- Add new note -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-text class="pa-4">
              <v-text-field
                v-model="newNoteContent"
                :label="$t('notes.addPlaceholder')"
                variant="outlined"
                density="comfortable"
                hide-details
                prepend-inner-icon="mdi-plus"
                @keyup.enter="addNote"
              >
                <template #append>
                  <v-btn
                    color="primary"
                    variant="flat"
                    :disabled="!newNoteContent.trim()"
                    :loading="isAdding"
                    @click="addNote"
                  >
                    {{ $t('notes.add') }}
                  </v-btn>
                </template>
              </v-text-field>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Notes list -->
      <v-row class="mt-4">
        <v-col cols="12">
          <v-card>
            <v-card-text v-if="notesStore.loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
            </v-card-text>

            <v-card-text v-else-if="notesStore.noteCount === 0" class="text-center py-8">
              <v-icon icon="mdi-notebook-check-outline" size="64" class="mb-4" color="grey" />
              <div class="text-h6 text-medium-emphasis mb-2">
                {{ $t('notes.empty') }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ $t('notes.emptyHint') }}
              </div>
            </v-card-text>

            <div v-else class="notes-list">
              <draggable
                v-model="localNotes"
                item-key="id"
                handle=".drag-handle"
                :animation="200"
                ghost-class="note-ghost"
                tag="div"
                @end="onDragEnd"
              >
                <template #item="{ element: note }">
                  <div class="note-wrapper">
                    <div
                      :class="{ 'note-completed': note.completed }"
                      class="note-item d-flex align-center pa-3"
                    >
                      <v-icon class="drag-handle mr-3" size="small">
                        mdi-drag-vertical
                      </v-icon>
                      <v-checkbox
                        :model-value="note.completed"
                        hide-details
                        density="compact"
                        color="primary"
                        class="mr-3 flex-shrink-0"
                        @update:model-value="toggleCompleted(note)"
                      />

                      <div
                        v-if="editingNoteId !== note.id"
                        :class="{ 'text-decoration-line-through text-medium-emphasis': note.completed }"
                        class="note-content flex-grow-1"
                        @dblclick="startEditing(note)"
                      >
                        {{ note.content }}
                      </div>

                      <v-text-field
                        v-else
                        v-model="editingContent"
                        variant="outlined"
                        density="compact"
                        hide-details
                        autofocus
                        class="flex-grow-1"
                        @keyup.enter="saveEdit(note)"
                        @keyup.escape="cancelEdit"
                        @blur="saveEdit(note)"
                      />

                      <div class="note-actions ml-2 flex-shrink-0">
                        <v-btn
                          v-if="editingNoteId !== note.id"
                          icon="mdi-pencil"
                          size="small"
                          variant="text"
                          @click="startEditing(note)"
                        />
                        <v-btn
                          icon="mdi-delete"
                          size="small"
                          variant="text"
                          color="error"
                          @click="deleteNote(note)"
                        />
                      </div>
                    </div>
                    <v-divider />
                  </div>
                </template>
              </draggable>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Completed notes summary -->
      <v-row v-if="notesStore.completedCount > 0" class="mt-4">
        <v-col cols="12">
          <div class="d-flex align-center justify-space-between">
            <span class="text-body-2 text-medium-emphasis">
              {{ notesStore.completedCount }} {{ $t('notes.completed') }}
            </span>
            <v-btn
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-delete-sweep"
              @click="clearCompleted"
            >
              {{ $t('notes.clearCompleted') }}
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import type { CampaignNote } from '~~/types/note'
import draggable from 'vuedraggable'

const campaignStore = useCampaignStore()
const notesStore = useNotesStore()

const campaignId = computed(() => campaignStore.activeCampaignId)

// Local state for UI
const newNoteContent = ref('')
const isAdding = ref(false)
const editingNoteId = ref<number | null>(null)
const editingContent = ref('')

// Local copy of notes for draggable
const localNotes = ref<CampaignNote[]>([])

// Sync store notes to local array for draggable
watch(
  () => notesStore.notes,
  (newNotes) => {
    localNotes.value = [...newNotes]
  },
  { immediate: true, deep: true },
)

// Add note
async function addNote() {
  if (!newNoteContent.value.trim() || !campaignId.value) return

  isAdding.value = true
  await notesStore.addNote(Number(campaignId.value), newNoteContent.value.trim())
  newNoteContent.value = ''
  isAdding.value = false
}

// Toggle completed
async function toggleCompleted(note: CampaignNote) {
  await notesStore.toggleCompleted(note.id)
}

// Start editing
function startEditing(note: CampaignNote) {
  editingNoteId.value = note.id
  editingContent.value = note.content
}

// Cancel edit
function cancelEdit() {
  editingNoteId.value = null
  editingContent.value = ''
}

// Save edit
async function saveEdit(note: CampaignNote) {
  if (!editingContent.value.trim() || editingContent.value.trim() === note.content) {
    cancelEdit()
    return
  }

  await notesStore.updateNote(note.id, { content: editingContent.value.trim() })
  cancelEdit()
}

// Delete note
async function deleteNote(note: CampaignNote) {
  await notesStore.deleteNote(note.id)
}

// Clear completed
async function clearCompleted() {
  await notesStore.clearCompleted()
}

// Drag end - save new order
async function onDragEnd() {
  const noteIds = localNotes.value.map((n) => n.id)
  await notesStore.reorderNotes(noteIds)
}

// Watch campaign changes
watch(
  campaignId,
  (newId) => {
    if (newId) {
      notesStore.fetchNotes(Number(newId))
    } else {
      notesStore.clearNotes()
    }
  },
  { immediate: true },
)

// Initialize campaign from cookie on mount
onMounted(() => {
  campaignStore.initFromCookie()
})
</script>

<style scoped>
.note-item {
  transition: background-color 0.2s ease;
}

.note-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.note-completed {
  opacity: 0.7;
}

.note-content {
  cursor: text;
}

.drag-handle {
  cursor: grab;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.drag-handle:hover {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.note-ghost {
  opacity: 0.4;
  background: rgba(var(--v-theme-primary), 0.1);
}
</style>
