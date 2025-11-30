<template>
  <v-card variant="outlined">
    <v-card-text>
      <div class="d-flex align-start gap-4">
        <!-- Image Preview -->
        <div style="position: relative">
          <v-avatar
            :size="avatarSize"
            rounded="lg"
            :color="imageUrl ? undefined : 'grey-lighten-2'"
            :style="imageUrl ? 'cursor: pointer;' : ''"
            @click="imageUrl ? $emit('preview-image', `/uploads/${imageUrl}`, entityName) : null"
          >
            <v-img
              v-if="imageUrl"
              :src="`/uploads/${imageUrl}`"
              cover
              :class="{ 'blur-image': uploading || generating }"
            />
            <v-icon
              v-else-if="!uploading && !generating"
              :icon="defaultIcon"
              :size="iconSize"
              color="grey"
            />
          </v-avatar>
          <v-progress-circular
            v-if="uploading || generating"
            indeterminate
            color="primary"
            :size="progressSize"
            width="6"
            style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            "
          />
        </div>

        <!-- Image Actions -->
        <div class="flex-grow-1" style="max-width: 280px; margin-left: 16px">
          <!-- Upload Button -->
          <v-btn
            prepend-icon="mdi-camera"
            color="primary"
            variant="tonal"
            block
            class="mb-2"
            :disabled="uploading || deleting || generating"
            @click="$emit('upload')"
          >
            {{ imageUrl ? $t(changeImageKey) : $t(uploadImageKey) }}
          </v-btn>

          <!-- AI Generate Button -->
          <v-btn
            prepend-icon="mdi-creation"
            color="primary"
            variant="tonal"
            block
            class="mb-2"
            :loading="generating"
            :disabled="generateDisabled"
            @click="$emit('generate')"
          >
            {{ $t(generateImageKey) }}
          </v-btn>

          <!-- Download Button (only if image exists) -->
          <v-btn
            v-if="imageUrl"
            prepend-icon="mdi-download"
            variant="outlined"
            block
            class="mb-2"
            :disabled="uploading || generating"
            @click="$emit('download')"
          >
            Download
          </v-btn>

          <!-- Delete Button (only if image exists) -->
          <v-btn
            v-if="imageUrl"
            prepend-icon="mdi-delete"
            color="error"
            variant="outlined"
            block
            :loading="deleting"
            :disabled="uploading || generating"
            @click="$emit('delete')"
          >
            {{ $t(deleteImageKey) }}
          </v-btn>

          <!-- AI Hint -->
          <div v-if="!hasApiKey" class="text-caption text-medium-emphasis mt-3">
            <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
            KI-Generierung: OpenAI API-Key in Einstellungen hinterlegen
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  imageUrl?: string | null
  entityName: string
  entityType: 'NPC' | 'Faction' | 'Item' | 'Location' | 'Lore' | 'Player'
  uploading?: boolean
  generating?: boolean
  deleting?: boolean
  hasApiKey?: boolean
  generateDisabled?: boolean
  avatarSize?: number
  defaultIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  imageUrl: null,
  uploading: false,
  generating: false,
  deleting: false,
  hasApiKey: false,
  generateDisabled: false,
  avatarSize: 160,
  defaultIcon: 'mdi-image',
})

defineEmits<{
  'preview-image': [imagePath: string, entityName: string]
  upload: []
  generate: []
  download: []
  delete: []
}>()

// Compute i18n keys based on entity type
const uploadImageKey = computed(() => {
  const typeMap: Record<typeof props.entityType, string> = {
    NPC: 'npcs.uploadImage',
    Faction: 'factions.uploadImage',
    Item: 'items.uploadImage',
    Location: 'locations.uploadImage',
    Lore: 'lore.uploadImage',
    Player: 'players.uploadImage',
  }
  return typeMap[props.entityType]
})

const changeImageKey = computed(() => {
  const typeMap: Record<typeof props.entityType, string> = {
    NPC: 'npcs.changeImage',
    Faction: 'factions.changeImage',
    Item: 'items.changeImage',
    Location: 'locations.changeImage',
    Lore: 'lore.changeImage',
    Player: 'players.changeImage',
  }
  return typeMap[props.entityType]
})

const generateImageKey = computed(() => {
  const typeMap: Record<typeof props.entityType, string> = {
    NPC: 'npcs.generateImage',
    Faction: 'factions.generateImage',
    Item: 'items.generateImage',
    Location: 'locations.generateImage',
    Lore: 'lore.generateImage',
    Player: 'players.generateImage',
  }
  return typeMap[props.entityType]
})

const deleteImageKey = computed(() => {
  const typeMap: Record<typeof props.entityType, string> = {
    NPC: 'npcs.deleteImage',
    Faction: 'factions.deleteImage',
    Item: 'items.deleteImage',
    Location: 'locations.deleteImage',
    Lore: 'lore.deleteImage',
    Player: 'players.deleteImage',
  }
  return typeMap[props.entityType]
})

// Icon size based on avatar size
const iconSize = computed(() => Math.round(props.avatarSize / 2))
const progressSize = computed(() => Math.round(props.avatarSize * 0.4))
</script>

<style scoped>
.blur-image {
  filter: blur(4px);
  opacity: 0.5;
}
</style>
