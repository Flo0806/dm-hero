<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-btn icon="mdi-arrow-left" variant="text" class="mr-2" @click="encounterStore.closeEncounter()" />
      <span>{{ encounterStore.activeEncounter?.name }}</span>
      <v-chip
        v-if="encounterStore.activeEncounter"
        size="small"
        :color="statusColor(encounterStore.activeEncounter.status)"
        variant="tonal"
        class="ml-3"
      >
        {{ $t(`encounters.statuses.${encounterStore.activeEncounter.status}`) }}
      </v-chip>
    </v-card-title>

    <v-divider />

    <v-card-text>
      <EncountersEncounterParticipantList
        :participants="encounterStore.participants"
        @remove="onRemoveParticipant"
      />
    </v-card-text>

    <v-divider />

    <v-card-actions>
      <v-btn
        color="primary"
        prepend-icon="mdi-account-plus"
        @click="showAddDialog = true"
      >
        {{ $t('encounters.addParticipants') }}
      </v-btn>
    </v-card-actions>

    <ClientOnly>
      <EncountersEncounterAddParticipantDialog
        v-model="showAddDialog"
        :encounter-id="encounterStore.activeEncounter?.id ?? 0"
        :existing-participants="encounterStore.participants"
      />
    </ClientOnly>
  </v-card>
</template>

<script setup lang="ts">
const { t } = useI18n()
const encounterStore = useEncounterStore()
const snackbarStore = useSnackbarStore()

const showAddDialog = ref(false)

async function onRemoveParticipant(participantId: number) {
  if (!encounterStore.activeEncounter) return

  const success = await encounterStore.removeParticipant(
    encounterStore.activeEncounter.id,
    participantId,
  )
  if (success) {
    snackbarStore.success(t('encounters.participantRemoved'))
  }
  else {
    snackbarStore.error(t('common.error'))
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'setup': return 'grey'
    case 'initiative': return 'info'
    case 'active': return 'success'
    case 'paused': return 'warning'
    case 'finished': return 'default'
    default: return 'grey'
  }
}
</script>
