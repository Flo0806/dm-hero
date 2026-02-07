<template>
  <div>
    <v-list v-if="participants.length > 0" lines="one" density="compact">
      <v-list-item v-for="p in participants" :key="p.id">
        <template #prepend>
          <v-avatar :color="p.entity_type === 'Player' ? 'cyan-lighten-4' : 'blue-lighten-4'" size="36" class="mr-3">
            <v-img v-if="p.entity_image" :src="`/uploads/${p.entity_image}`" />
            <v-icon v-else size="20">{{ p.entity_type === 'Player' ? 'mdi-account-star' : 'mdi-account' }}</v-icon>
          </v-avatar>
        </template>

        <v-list-item-title>
          {{ p.display_name }}
          <span v-if="p.duplicate_index > 0" class="text-medium-emphasis">({{ p.duplicate_index + 1 }})</span>
        </v-list-item-title>

        <template #append>
          <div class="d-flex align-center ga-2">
            <!-- HP display -->
            <v-chip v-if="p.max_hp > 0" size="small" variant="tonal" prepend-icon="mdi-heart">
              {{ p.current_hp }}/{{ p.max_hp }}
            </v-chip>

            <!-- Initiative input -->
            <v-text-field
              v-if="showInitiative"
              :model-value="p.initiative"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              :label="$t('encounters.initiative')"
              style="width: 80px;"
              @keydown.enter="($event.target as HTMLInputElement)?.blur()"
              @blur="onIniBlur(p, $event)"
            />

            <v-btn icon="mdi-close" size="x-small" variant="text" @click="$emit('remove', p.id)" />
          </div>
        </template>
      </v-list-item>
    </v-list>

    <div v-else class="text-center py-8 text-medium-emphasis">
      <v-icon icon="mdi-account-group-outline" size="48" class="mb-2" />
      <div>{{ $t('encounters.noParticipants') }}</div>
      <div class="text-body-2">{{ $t('encounters.noParticipantsHint') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EncounterParticipant } from '~~/types/encounter'

defineProps<{
  participants: EncounterParticipant[]
  showInitiative?: boolean
}>()

const emit = defineEmits<{
  remove: [id: number]
  updateParticipant: [id: number, updates: Partial<EncounterParticipant>]
}>()

function onIniBlur(p: EncounterParticipant, event: FocusEvent) {
  const val = (event.target as HTMLInputElement)?.value
  const ini = val !== '' ? Number(val) : null
  if (ini !== p.initiative) {
    emit('updateParticipant', p.id, { initiative: ini })
  }
}
</script>
