<template>
  <v-container>
    <PageHeader
      :title="$t('referenceData.title')"
      :subtitle="$t('referenceData.subtitle')"
    />

    <v-tabs v-model="tab" class="mb-6">
      <v-tab value="races">
        <v-icon start>
          mdi-human
        </v-icon>
        {{ $t('referenceData.races') }}
      </v-tab>
      <v-tab value="classes">
        <v-icon start>
          mdi-sword-cross
        </v-icon>
        {{ $t('referenceData.classes') }}
      </v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <!-- Races Tab -->
      <v-tabs-window-item value="races">
        <div class="d-flex justify-end mb-4">
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            @click="openRaceDialog()"
          >
            {{ $t('referenceData.createRace') }}
          </v-btn>
        </div>

        <v-data-table
          :headers="raceHeaders"
          :items="races || []"
          :loading="racesPending"
        >
          <template #[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              @click="openRaceDialog(item)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              @click="deleteRace(item)"
            />
          </template>
        </v-data-table>
      </v-tabs-window-item>

      <!-- Classes Tab -->
      <v-tabs-window-item value="classes">
        <div class="d-flex justify-end mb-4">
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            @click="openClassDialog()"
          >
            {{ $t('referenceData.createClass') }}
          </v-btn>
        </div>

        <v-data-table
          :headers="classHeaders"
          :items="classes || []"
          :loading="classesPending"
        >
          <template #[`item.actions`]="{ item }">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              @click="openClassDialog(item)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              @click="deleteClass(item)"
            />
          </template>
        </v-data-table>
      </v-tabs-window-item>
    </v-tabs-window>

    <!-- Race Dialog -->
    <v-dialog
      v-model="showRaceDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>
          {{ editingRace ? $t('referenceData.editRace') : $t('referenceData.createRace') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="raceForm.name"
            :label="$t('referenceData.name')"
            :rules="[v => !!v || $t('referenceData.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />
          <v-textarea
            v-model="raceForm.description"
            :label="$t('referenceData.description')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="closeRaceDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!raceForm.name"
            :loading="saving"
            @click="saveRace"
          >
            {{ editingRace ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Class Dialog -->
    <v-dialog
      v-model="showClassDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>
          {{ editingClass ? $t('referenceData.editClass') : $t('referenceData.createClass') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="classForm.name"
            :label="$t('referenceData.name')"
            :rules="[v => !!v || $t('referenceData.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />
          <v-textarea
            v-model="classForm.description"
            :label="$t('referenceData.description')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="closeClassDialog"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!classForm.name"
            :loading="saving"
            @click="saveClass"
          >
            {{ editingClass ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Error Snackbar -->
    <v-snackbar
      v-model="showError"
      color="error"
      :timeout="5000"
    >
      {{ errorMessage }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
interface ReferenceData {
  id: number
  name: string
  description: string | null
  created_at: string
}

const { t } = useI18n()
const tab = ref('races')

// Fetch data with caching (not campaign-specific, can be cached globally)
const { data: races, pending: racesPending, refresh: refreshRaces } = await useFetch<ReferenceData[]>('/api/races', {
  key: 'races',
  getCachedData: key => useNuxtApp().static.data[key],
})
const { data: classes, pending: classesPending, refresh: refreshClasses } = await useFetch<ReferenceData[]>('/api/classes', {
  key: 'classes',
  getCachedData: key => useNuxtApp().static.data[key],
})

// Table headers
const raceHeaders = [
  { title: t('referenceData.name'), key: 'name', sortable: true },
  { title: t('referenceData.description'), key: 'description', sortable: false },
  { title: t('common.actions'), key: 'actions', sortable: false, align: 'end' },
]

const classHeaders = [
  { title: t('referenceData.name'), key: 'name', sortable: true },
  { title: t('referenceData.description'), key: 'description', sortable: false },
  { title: t('common.actions'), key: 'actions', sortable: false, align: 'end' },
]

// Race form state
const showRaceDialog = ref(false)
const editingRace = ref<ReferenceData | null>(null)
const saving = ref(false)
const raceForm = ref({
  name: '',
  description: '',
})

// Class form state
const showClassDialog = ref(false)
const editingClass = ref<ReferenceData | null>(null)
const classForm = ref({
  name: '',
  description: '',
})

// Delete state
const showDeleteDialog = ref(false)
const deleting = ref(false)
const deleteDialogTitle = ref('')
const deleteDialogMessage = ref('')
const deleteType = ref<'race' | 'class'>('race')
const deletingId = ref<number | null>(null)

// Error handling
const showError = ref(false)
const errorMessage = ref('')

function openRaceDialog(race?: ReferenceData) {
  if (race) {
    editingRace.value = race
    raceForm.value = {
      name: race.name,
      description: race.description || '',
    }
  }
  else {
    editingRace.value = null
    raceForm.value = {
      name: '',
      description: '',
    }
  }
  showRaceDialog.value = true
}

function closeRaceDialog() {
  showRaceDialog.value = false
  editingRace.value = null
  raceForm.value = {
    name: '',
    description: '',
  }
}

function openClassDialog(classData?: ReferenceData) {
  if (classData) {
    editingClass.value = classData
    classForm.value = {
      name: classData.name,
      description: classData.description || '',
    }
  }
  else {
    editingClass.value = null
    classForm.value = {
      name: '',
      description: '',
    }
  }
  showClassDialog.value = true
}

function closeClassDialog() {
  showClassDialog.value = false
  editingClass.value = null
  classForm.value = {
    name: '',
    description: '',
  }
}

async function saveRace() {
  saving.value = true

  try {
    if (editingRace.value) {
      await $fetch(`/api/races/${editingRace.value.id}`, {
        method: 'PATCH',
        body: raceForm.value,
      })
    }
    else {
      await $fetch('/api/races', {
        method: 'POST',
        body: raceForm.value,
      })
    }

    await refreshRaces()
    closeRaceDialog()
  }
  catch (error) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || t('referenceData.saveError')
    showError.value = true
  }
  finally {
    saving.value = false
  }
}

async function saveClass() {
  saving.value = true

  try {
    if (editingClass.value) {
      await $fetch(`/api/classes/${editingClass.value.id}`, {
        method: 'PATCH',
        body: classForm.value,
      })
    }
    else {
      await $fetch('/api/classes', {
        method: 'POST',
        body: classForm.value,
      })
    }

    await refreshClasses()
    closeClassDialog()
  }
  catch (error) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || t('referenceData.saveError')
    showError.value = true
  }
  finally {
    saving.value = false
  }
}

function deleteRace(race: ReferenceData) {
  deleteType.value = 'race'
  deletingId.value = race.id
  deleteDialogTitle.value = t('referenceData.deleteRaceTitle')
  deleteDialogMessage.value = t('referenceData.deleteRaceConfirm', { name: race.name })
  showDeleteDialog.value = true
}

function deleteClass(classData: ReferenceData) {
  deleteType.value = 'class'
  deletingId.value = classData.id
  deleteDialogTitle.value = t('referenceData.deleteClassTitle')
  deleteDialogMessage.value = t('referenceData.deleteClassConfirm', { name: classData.name })
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingId.value)
    return

  deleting.value = true

  try {
    if (deleteType.value === 'race') {
      await $fetch(`/api/races/${deletingId.value}`, {
        method: 'DELETE',
      })
      await refreshRaces()
    }
    else {
      await $fetch(`/api/classes/${deletingId.value}`, {
        method: 'DELETE',
      })
      await refreshClasses()
    }

    showDeleteDialog.value = false
    deletingId.value = null
  }
  catch (error) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || t('referenceData.deleteError')
    showError.value = true
  }
  finally {
    deleting.value = false
  }
}
</script>
