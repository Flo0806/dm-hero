<template>
  <v-container>
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h1 class="text-h3 mb-2">
          {{ $t('npcs.title') }}
        </h1>
        <p class="text-body-1 text-medium-emphasis">
          {{ $t('npcs.subtitle') }}
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        size="large"
        @click="showCreateDialog = true"
      >
        {{ $t('npcs.create') }}
      </v-btn>
    </div>

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

    <v-row v-else-if="filteredNpcs && filteredNpcs.length > 0">
      <v-col
        v-for="npc in filteredNpcs"
        :key="npc.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card hover class="h-100">
          <v-card-title>
            <v-icon icon="mdi-account" class="mr-2" color="primary" />
            {{ npc.name }}
          </v-card-title>
          <v-card-text>
            <div v-if="npc.description" class="text-body-2 mb-3">
              {{ truncateText(npc.description, 100) }}
            </div>
            <div v-if="npc.metadata" class="text-caption">
              <div v-if="npc.metadata.race" class="mb-1">
                <strong>{{ $t('npcs.race') }}:</strong> {{ npc.metadata.race }}
              </div>
              <div v-if="npc.metadata.class" class="mb-1">
                <strong>{{ $t('npcs.class') }}:</strong> {{ npc.metadata.class }}
              </div>
              <div v-if="npc.metadata.location">
                <strong>{{ $t('npcs.location') }}:</strong> {{ npc.metadata.location }}
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              variant="text"
              prepend-icon="mdi-pencil"
              @click="editNpc(npc)"
            >
              {{ $t('common.edit') }}
            </v-btn>
            <v-spacer />
            <v-btn
              variant="text"
              color="error"
              prepend-icon="mdi-delete"
              @click="deleteNpc(npc)"
            >
              {{ $t('common.delete') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-empty-state
      v-else
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
          <v-tab value="notes">
            <v-icon start>
              mdi-note-text
            </v-icon>
            {{ $t('npcs.notes') }} ({{ npcNotes.length }})
          </v-tab>
        </v-tabs>

        <v-card-text style="max-height: 600px">
          <v-tabs-window v-if="editingNpc" v-model="npcDialogTab">
            <!-- Details Tab -->
            <v-tabs-window-item value="details">
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
                  <v-combobox
                    v-model="npcForm.metadata.race"
                    :items="races?.map(r => r.name) || []"
                    :label="$t('npcs.race')"
                    variant="outlined"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-combobox
                    v-model="npcForm.metadata.class"
                    :items="classes?.map(c => c.name) || []"
                    :label="$t('npcs.class')"
                    variant="outlined"
                    clearable
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
                <v-combobox
                  v-model="npcForm.metadata.race"
                  :items="races?.map(r => r.name) || []"
                  :label="$t('npcs.race')"
                  variant="outlined"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-combobox
                  v-model="npcForm.metadata.class"
                  :items="classes?.map(c => c.name) || []"
                  :label="$t('npcs.class')"
                  variant="outlined"
                  clearable
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
            :loading="deletingNote"
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
    <v-dialog
      v-model="showDeleteDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ $t('npcs.deleteTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('npcs.deleteConfirm', { name: deletingNpc?.name }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeleteDialog = false"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="confirmDelete"
          >
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
interface NPC {
  id: number
  name: string
  description: string | null
  metadata: {
    race?: string
    class?: string
    location?: string
    faction?: string
    relationship?: string
  } | null
  created_at: string
  updated_at: string
}

const { t } = useI18n()
const router = useRouter()

// Get active campaign
const activeCampaignId = ref<string | null>(null)

onMounted(() => {
  activeCampaignId.value = localStorage.getItem('activeCampaignId')

  if (!activeCampaignId.value) {
    router.push('/campaigns')
  }
})

// Fetch NPCs
const { data: npcs, pending, refresh } = await useFetch<NPC[]>('/api/npcs', {
  query: computed(() => ({ campaignId: activeCampaignId.value })),
  watch: [activeCampaignId],
})

// Fetch races and classes for autocomplete
const { data: races } = await useFetch<Array<{ id: number, name: string, description: string }>>('/api/races')
const { data: classes } = await useFetch<Array<{ id: number, name: string, description: string }>>('/api/classes')

// Fetch locations for linking
const { data: locations } = await useFetch<Array<{ id: number, name: string }>>('/api/locations', {
  query: computed(() => ({ campaignId: activeCampaignId.value })),
  watch: [activeCampaignId],
})

// Search
const searchQuery = ref('')
const filteredNpcs = computed(() => {
  if (!npcs.value)
    return []

  if (!searchQuery.value)
    return npcs.value

  const query = searchQuery.value.toLowerCase()
  return npcs.value.filter(npc =>
    npc.name.toLowerCase().includes(query)
    || npc.description?.toLowerCase().includes(query)
    || npc.metadata?.race?.toLowerCase().includes(query)
    || npc.metadata?.class?.toLowerCase().includes(query)
    || npc.metadata?.location?.toLowerCase().includes(query),
  )
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
  },
})

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
      await $fetch(`/api/sessions/${editingNote.value.id}`, {
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
    await $fetch(`/api/sessions/${deletingNote.value.id}`, {
      method: 'DELETE',
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
      await $fetch(`/api/npcs/${editingNpc.value.id}`, {
        method: 'PATCH',
        body: {
          name: npcForm.value.name,
          description: npcForm.value.description,
          metadata: npcForm.value.metadata,
        },
      })
    }
    else {
      await $fetch('/api/npcs', {
        method: 'POST',
        body: {
          ...npcForm.value,
          campaignId: activeCampaignId.value,
        },
      })
    }

    await refresh()
    closeDialog()
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
    await $fetch(`/api/npcs/${deletingNpc.value.id}`, {
      method: 'DELETE',
    })

    await refresh()
    showDeleteDialog.value = false
    deletingNpc.value = null
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
    const relation = await $fetch(`/api/npcs/${editingNpc.value.id}/relations`, {
      method: 'POST',
      body: {
        toEntityId: newRelation.value.locationId,
        relationType: newRelation.value.relationType || t('npcs.relationTypes.livesIn'),
        notes: newRelation.value.notes || null,
      },
    })

    npcRelations.value.push(relation as any)
    newRelation.value = {
      locationId: null,
      relationType: '',
      notes: '',
    }
  }
  catch (error: any) {
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
    const updated = await $fetch(`/api/entity-relations/${editingRelation.value.id}`, {
      method: 'PATCH',
      body: {
        relationType: relationEditForm.value.relationType,
        notes: relationEditForm.value.notes || null,
      },
    })

    // Update in local array
    const index = npcRelations.value.findIndex(r => r.id === editingRelation.value!.id)
    if (index !== -1) {
      npcRelations.value[index] = updated as any
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
    await $fetch(`/api/entity-relations/${relationId}`, {
      method: 'DELETE',
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
  newRelation.value = {
    locationId: null,
    relationType: '',
    notes: '',
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
    },
  }
}
</script>
