<template>
  <div class="pa-4">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="members.length === 0" class="text-center py-8 text-medium-emphasis">
      {{ $t('groups.noMembers') }}
    </div>

    <!-- Member List -->
    <v-list v-else lines="two">
      <v-list-item
        v-for="member in members"
        :key="member.entity_id"
        class="mb-2"
        style="cursor: pointer"
        @click="$emit('click', member.entity_id, member.entity_type)"
      >
        <!-- Avatar -->
        <template #prepend>
          <v-avatar :color="getAvatarColor(member.entity_type)" size="48">
            <v-img v-if="member.entity_image_url" :src="`/uploads/${member.entity_image_url}`" />
            <v-icon v-else>{{ getEntityIcon(member.entity_type) }}</v-icon>
          </v-avatar>
        </template>

        <!-- Title -->
        <v-list-item-title class="font-weight-medium">
          {{ member.entity_name }}
        </v-list-item-title>

        <!-- Subtitle with Type -->
        <v-list-item-subtitle>
          <v-chip size="x-small" variant="tonal" :color="getTypeColor(member.entity_type)">
            {{ $t(`entityTypes.${member.entity_type}`) }}
          </v-chip>
        </v-list-item-subtitle>

        <!-- Remove Action -->
        <template #append>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            color="error"
            @click.stop="$emit('remove', member.entity_id)"
          >
            <v-icon>mdi-close</v-icon>
            <v-tooltip activator="parent" location="left">{{ $t('groups.removeFromGroup') }}</v-tooltip>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import type { GroupMember } from '~~/types/group'

interface Props {
  members: GroupMember[]
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

defineEmits<{
  remove: [entityId: number]
  click: [entityId: number, entityType: string]
}>()

// Entity type icons
function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Location: 'mdi-map-marker',
    Item: 'mdi-sword',
    Faction: 'mdi-shield-account',
    Lore: 'mdi-book-open-variant',
    Player: 'mdi-account-star',
  }
  return icons[type] || 'mdi-help'
}

// Avatar color by type
function getAvatarColor(type: string): string {
  const colors: Record<string, string> = {
    NPC: 'blue-lighten-4',
    Location: 'green-lighten-4',
    Item: 'orange-lighten-4',
    Faction: 'purple-lighten-4',
    Lore: 'brown-lighten-4',
    Player: 'cyan-lighten-4',
  }
  return colors[type] || 'grey-lighten-3'
}

// Chip color by type
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    NPC: 'blue',
    Location: 'green',
    Item: 'orange',
    Faction: 'purple',
    Lore: 'brown',
    Player: 'cyan',
  }
  return colors[type] || 'grey'
}
</script>
