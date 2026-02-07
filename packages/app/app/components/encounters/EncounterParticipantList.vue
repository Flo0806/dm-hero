<template>
  <div>
    <v-list v-if="participants.length > 0" lines="two">
      <v-list-item
        v-for="participant in participants"
        :key="participant.id"
      >
        <template #prepend>
          <v-avatar :color="getAvatarColor(participant.entity_type)" size="40" class="mr-3">
            <v-img v-if="participant.entity_image" :src="`/uploads/${participant.entity_image}`" />
            <v-icon v-else>{{ getEntityIcon(participant.entity_type) }}</v-icon>
          </v-avatar>
        </template>

        <v-list-item-title>
          {{ participant.display_name }}
          <span v-if="participant.duplicate_index > 0" class="text-medium-emphasis">
            ({{ participant.duplicate_index + 1 }})
          </span>
        </v-list-item-title>

        <v-list-item-subtitle>
          <div class="d-flex align-center ga-2">
            <v-chip size="x-small" variant="tonal">
              {{ participant.entity_type || '?' }}
            </v-chip>
            <span v-if="participant.max_hp > 0" class="text-caption">
              {{ $t('encounters.hp') }}: {{ participant.current_hp }}/{{ participant.max_hp }}
            </span>
          </div>
        </v-list-item-subtitle>

        <template #append>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            :aria-label="$t('encounters.removeParticipant')"
            @click="emit('remove', participant.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <!-- Empty state -->
    <div v-else class="text-center py-8 text-medium-emphasis">
      <v-icon icon="mdi-account-group-outline" size="48" class="mb-2" />
      <div class="text-body-1">{{ $t('encounters.noParticipants') }}</div>
      <div class="text-body-2">{{ $t('encounters.noParticipantsHint') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EncounterParticipant } from '~~/types/encounter'

defineProps<{
  participants: EncounterParticipant[]
}>()

const emit = defineEmits<{
  remove: [participantId: number]
}>()

function getEntityIcon(type?: string): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Player: 'mdi-account-star',
    Location: 'mdi-map-marker',
    Item: 'mdi-sword',
    Faction: 'mdi-shield-account',
    Lore: 'mdi-book-open-variant',
  }
  return icons[type || ''] || 'mdi-help'
}

function getAvatarColor(type?: string): string {
  const colors: Record<string, string> = {
    NPC: 'blue-lighten-4',
    Player: 'cyan-lighten-4',
    Location: 'green-lighten-4',
    Item: 'orange-lighten-4',
    Faction: 'purple-lighten-4',
    Lore: 'brown-lighten-4',
  }
  return colors[type || ''] || 'grey-lighten-3'
}
</script>
