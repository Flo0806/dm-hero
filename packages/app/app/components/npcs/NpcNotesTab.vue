<template>
  <div>
    <!-- Search & Add Button -->
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

    <!-- Loading State -->
    <v-progress-linear v-if="loadingNotes" indeterminate />

    <!-- Notes List -->
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

    <!-- Empty State -->
    <v-empty-state
      v-else
      icon="mdi-note-text-outline"
      :title="$t('npcs.noNotes')"
      :text="$t('npcs.noNotesText')"
    />

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
            persistent-placeholder
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
            persistent-placeholder
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
  </div>
</template>

<script setup lang="ts">
const campaignStore = useCampaignStore()
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

interface Note {
  id: number
  title: string | null
  summary: string
  date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface Props {
  npcId: number
}

const props = defineProps<Props>()

// State
const npcNotes = ref<Note[]>([])
const loadingNotes = ref(false)
const notesSearch = ref('')
const showNoteDialog = ref(false)
const showDeleteNoteDialog = ref(false)
const editingNote = ref<Note | null>(null)
const deletingNote = ref<Note | null>(null)
const savingNote = ref(false)
const deletingNoteLoading = ref(false)

const noteForm = ref({
  title: '',
  summary: '',
  date: '',
  notes: '',
})

// Computed
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

// Load notes on mount and when npcId changes
watch(
  () => props.npcId,
  async () => {
    await loadNotes()
  },
  { immediate: true },
)

// Functions
async function loadNotes() {
  if (!props.npcId) return

  loadingNotes.value = true
  try {
    const notes = await $fetch<Note[]>(`/api/npcs/${props.npcId}/notes`, {
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

function editNote(note: Note) {
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
  if (!props.npcId || !activeCampaignId.value) return

  savingNote.value = true

  try {
    if (editingNote.value) {
      // Update existing note
      await $fetch<{ success: boolean }>(`/api/npcs/${props.npcId}/notes/${editingNote.value.id}`, {
        method: 'PATCH',
        body: {
          title: noteForm.value.title || null,
          summary: noteForm.value.summary,
          date: noteForm.value.date ? new Date(noteForm.value.date).toISOString() : null,
          notes: noteForm.value.notes || null,
        },
      })
    } else {
      // Create new note
      await $fetch(`/api/npcs/${props.npcId}/notes`, {
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

function deleteNote(note: Note) {
  deletingNote.value = note
  showDeleteNoteDialog.value = true
}

async function confirmDeleteNote() {
  if (!deletingNote.value) return

  deletingNoteLoading.value = true

  try {
    await $fetch<{ success: boolean }>(`/api/npcs/${props.npcId}/notes/${deletingNote.value.id}`, {
      method: 'DELETE' as const,
    })

    await loadNotes()
    showDeleteNoteDialog.value = false
    deletingNote.value = null
  } catch (error) {
    console.error('Failed to delete note:', error)
  } finally {
    deletingNoteLoading.value = false
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

// Helper functions
function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
</script>
