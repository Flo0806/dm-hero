<template>
  <div>
    <div class="text-h6 mb-4">{{ $t('locations.linkedNpcs') }}</div>

    <!-- Add NPC -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-autocomplete
          v-model="selectedNpc"
          :items="availableNpcs"
          item-title="name"
          item-value="id"
          :label="$t('locations.selectNpc')"
          :placeholder="$t('locations.selectNpcPlaceholder')"
          variant="outlined"
          clearable
          class="mb-2"
        />
        <v-btn color="primary" block :disabled="!selectedNpc" @click="handleAdd">
          {{ $t('locations.linkNpc') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Linked NPCs List -->
    <v-list v-if="linkedNpcs.length > 0" class="pa-0">
      <v-list-item v-for="npc in linkedNpcs" :key="npc.id" class="mb-2 px-0">
        <template #prepend>
          <v-avatar size="30" class="mr-2">
            <v-img v-if="npc.image_url" :src="`/uploads/${npc.image_url}`" />
            <v-icon v-else>mdi-account</v-icon>
          </v-avatar>
        </template>
        <v-list-item-title>{{ npc.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="npc.description">
          {{ npc.description.substring(0, 100) }}{{ npc.description.length > 100 ? '...' : '' }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', npc.id)"
          />
        </template>
      </v-list-item>
    </v-list>
    <v-empty-state
      v-else
      icon="mdi-account-off"
      :title="$t('locations.noLinkedNpcs')"
      :text="$t('locations.noLinkedNpcsText')"
    />
  </div>
</template>

<script setup lang="ts">
interface NPC {
  id: number
  name: string
  description: string | null
  image_url: string | null
}

interface Props {
  linkedNpcs: NPC[]
  availableNpcs: { id: number; name: string }[]
}

defineProps<Props>()

const emit = defineEmits<{
  add: [npcId: number]
  remove: [npcId: number]
}>()

const selectedNpc = ref<number | null>(null)

function handleAdd() {
  if (selectedNpc.value) {
    emit('add', selectedNpc.value)
    selectedNpc.value = null
  }
}
</script>

<style scoped>
/* Remove excessive left padding from lists */
:deep(.v-list) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

:deep(.v-list-item) {
  padding-left: 0 !important;
  padding-inline-start: 0 !important;
}

:deep(.v-list-item__prepend) {
  margin-inline-end: 8px !important;
  width: auto !important;
}

:deep(.v-list-item__prepend > .v-avatar) {
  margin-inline-end: 0 !important;
}
</style>
