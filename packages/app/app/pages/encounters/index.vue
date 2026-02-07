<template>
  <v-container>
    <UiPageHeader :title="$t('encounters.title')" :subtitle="$t('encounters.subtitle')">
      <template #actions>
        <v-btn
          v-show="!encounterStore.isEncounterOpen"
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('encounters.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <!-- Global Campaign Pinboard -->
    <div class="sticky-pinboard mb-4">
      <SharedPinboard ref="pinboardRef" />
    </div>

    <!-- Inline Encounter Detail -->
    <EncountersEncounterDetail v-if="encounterStore.isEncounterOpen" class="mb-4" />

    <!-- Loading State -->
    <v-row v-if="!encounterStore.isEncounterOpen && encounterStore.loading">
      <v-col v-for="i in 3" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <!-- Encounter Cards -->
    <v-row v-if="!encounterStore.isEncounterOpen && !encounterStore.loading && encounterStore.encounters.length > 0">
      <v-col v-for="encounter in encounterStore.encounters" :key="encounter.id" cols="12" md="6" lg="4">
        <v-card hover @click="encounterStore.openEncounter(encounter.id)">
          <v-card-title class="d-flex align-center pb-1">
            <v-icon icon="mdi-sword-cross" class="mr-2" color="primary" />
            {{ encounter.name }}
          </v-card-title>

          <v-card-text class="pt-2">
            <div class="d-flex flex-wrap ga-2">
              <v-chip
                size="small"
                :color="statusColor(encounter.status)"
                variant="tonal"
              >
                {{ $t(`encounters.statuses.${encounter.status}`) }}
              </v-chip>

              <v-chip
                v-if="encounter._participantCount"
                size="small"
                variant="tonal"
                prepend-icon="mdi-account-group"
              >
                {{ encounter._participantCount }} {{ $t('encounters.participants') }}
              </v-chip>

              <v-chip
                v-if="encounter.status === 'active'"
                size="small"
                variant="tonal"
                prepend-icon="mdi-refresh"
              >
                {{ $t('encounters.round') }} {{ encounter.round }}
              </v-chip>
            </div>

            <div class="text-caption text-medium-emphasis mt-2">
              {{ formatDate(encounter.created_at) }}
            </div>
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn icon="mdi-delete" size="small" @click.stop="startDelete(encounter)" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <ClientOnly v-if="!encounterStore.isEncounterOpen && !encounterStore.loading && encounterStore.encounters.length === 0 && encounterStore.loaded">
      <v-empty-state
        icon="mdi-sword-cross"
        :title="$t('encounters.empty')"
        :text="$t('encounters.emptyText')"
      >
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('encounters.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-sword-cross" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('encounters.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('encounters.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('encounters.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- Create Dialog -->
    <ClientOnly>
      <v-dialog v-model="showCreateDialog" max-width="500" persistent>
        <v-card>
          <v-card-title>{{ $t('encounters.create') }}</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="newEncounterName"
              :label="$t('encounters.name')"
              autofocus
              @keyup.enter="createEncounter"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn @click="showCreateDialog = false">{{ $t('common.cancel') }}</v-btn>
            <v-btn color="primary" :loading="creating" :disabled="!newEncounterName.trim()" @click="createEncounter">
              {{ $t('common.create') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </ClientOnly>

    <!-- Delete Confirmation -->
    <ClientOnly>
      <UiDeleteConfirmDialog
        v-model="showDeleteDialog"
        :title="$t('encounters.deleteTitle')"
        :message="$t('encounters.deleteConfirm', { name: deletingEncounter?.name })"
        :loading="deleting"
        @confirm="confirmDelete"
        @cancel="showDeleteDialog = false"
      />
    </ClientOnly>

    <!-- FAB -->
    <v-btn
      v-show="!encounterStore.isEncounterOpen"
      color="primary"
      icon="mdi-plus"
      size="large"
      class="fab-create"
      @click="showCreateDialog = true"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { Encounter } from '~~/types/encounter'

const { t } = useI18n()
const campaignStore = useCampaignStore()
const encounterStore = useEncounterStore()
const snackbarStore = useSnackbarStore()

const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Fetch encounters via store
if (import.meta.client) {
  watch(activeCampaignId, (id) => {
    if (id) encounterStore.fetchEncounters(id, true)
  }, { immediate: true })
}

// Create
const showCreateDialog = ref(false)
const newEncounterName = ref('')
const creating = ref(false)

async function createEncounter() {
  if (!newEncounterName.value.trim() || !activeCampaignId.value) return

  creating.value = true
  try {
    const encounter = await encounterStore.createEncounter(activeCampaignId.value, newEncounterName.value.trim())
    if (encounter) {
      showCreateDialog.value = false
      newEncounterName.value = ''
    }
    else {
      snackbarStore.error(t('common.error'))
    }
  }
  finally {
    creating.value = false
  }
}

// Delete
const showDeleteDialog = ref(false)
const deletingEncounter = ref<Encounter | null>(null)
const deleting = ref(false)

function startDelete(encounter: Encounter) {
  deletingEncounter.value = encounter
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingEncounter.value) return

  deleting.value = true
  try {
    const success = await encounterStore.deleteEncounter(deletingEncounter.value.id)
    if (success) {
      showDeleteDialog.value = false
      deletingEncounter.value = null
    }
    else {
      snackbarStore.error(t('common.error'))
    }
  }
  finally {
    deleting.value = false
  }
}

// Helpers
function statusColor(status: string) {
  switch (status) {
    case 'setup': return 'grey'
    case 'initiative': return 'info'
    case 'active': return 'success'
    case 'finished': return 'default'
    default: return 'grey'
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString()
}
</script>

<style scoped>
/* Floating Action Button */
.fab-create {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}
</style>
