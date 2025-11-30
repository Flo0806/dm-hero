<template>
  <div>
    <!-- Image Upload Card (only in edit mode) -->
    <v-card v-if="isEditMode" class="mb-4" variant="outlined">
      <v-card-text>
        <div class="d-flex align-start gap-4">
          <!-- Image Preview -->
          <div style="position: relative">
            <v-avatar
              size="160"
              rounded="lg"
              :color="imageUrl ? undefined : 'grey-lighten-2'"
              :style="imageUrl ? 'cursor: pointer;' : ''"
              @click="imageUrl ? $emit('preview-image', imageUrl) : null"
            >
              <v-img
                v-if="imageUrl"
                :src="`/uploads/${imageUrl}`"
                cover
                :class="{ 'blur-image': uploadingImage || generatingImage }"
              />
              <v-icon
                v-else-if="!uploadingImage && !generatingImage"
                icon="mdi-shield-account"
                size="80"
                color="grey"
              />
            </v-avatar>
            <v-progress-circular
              v-if="uploadingImage || generatingImage"
              indeterminate
              color="primary"
              size="64"
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
              :disabled="uploadingImage || deletingImage || generatingImage"
              @click="$emit('upload-click')"
            >
              {{ imageUrl ? $t('factions.changeImage') : $t('factions.uploadImage') }}
            </v-btn>

            <!-- AI Generate Button -->
            <v-btn
              prepend-icon="mdi-creation"
              color="primary"
              variant="tonal"
              block
              class="mb-2"
              :loading="generatingImage"
              :disabled="!modelValue.name || uploadingImage || generatingImage"
              @click="$emit('generate-image')"
            >
              {{ $t('factions.generateImage') }}
            </v-btn>

            <!-- Download Button (only if image exists) -->
            <v-btn
              v-if="imageUrl"
              prepend-icon="mdi-download"
              variant="outlined"
              block
              class="mb-2"
              :disabled="uploadingImage || generatingImage"
              @click="$emit('download-image')"
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
              :loading="deletingImage"
              :disabled="uploadingImage || generatingImage"
              @click="$emit('delete-image')"
            >
              {{ $t('factions.deleteImage') }}
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

    <!-- Form Fields -->
    <v-text-field
      :model-value="modelValue.name"
      :label="$t('factions.name')"
      :rules="[(v: string) => !!v || $t('factions.nameRequired')]"
      variant="outlined"
      class="mb-4"
      @update:model-value="$emit('update:modelValue', { ...modelValue, name: $event })"
    />

    <v-textarea
      :model-value="modelValue.description"
      :label="$t('factions.description')"
      variant="outlined"
      rows="4"
      class="mb-4"
      @update:model-value="$emit('update:modelValue', { ...modelValue, description: $event })"
    />

    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="modelValue.metadata.type"
          :label="$t('factions.type')"
          variant="outlined"
          :placeholder="$t('factions.typePlaceholder')"
          @update:model-value="
            $emit('update:modelValue', {
              ...modelValue,
              metadata: { ...modelValue.metadata, type: $event },
            })
          "
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          :model-value="modelValue.leaderId"
          :items="npcs"
          item-title="name"
          item-value="id"
          :label="$t('factions.leader')"
          variant="outlined"
          clearable
          :placeholder="$t('factions.leaderPlaceholder')"
          @update:model-value="$emit('update:modelValue', { ...modelValue, leaderId: $event })"
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="modelValue.metadata.alignment"
          :label="$t('factions.alignment')"
          variant="outlined"
          :placeholder="$t('factions.alignmentPlaceholder')"
          @update:model-value="
            $emit('update:modelValue', {
              ...modelValue,
              metadata: { ...modelValue.metadata, alignment: $event },
            })
          "
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="modelValue.metadata.headquarters"
          :label="$t('factions.headquarters')"
          variant="outlined"
          @update:model-value="
            $emit('update:modelValue', {
              ...modelValue,
              metadata: { ...modelValue.metadata, headquarters: $event },
            })
          "
        />
      </v-col>
    </v-row>

    <v-textarea
      :model-value="modelValue.metadata.goals"
      :label="$t('factions.goals')"
      :placeholder="$t('factions.goalsPlaceholder')"
      variant="outlined"
      rows="3"
      class="mb-4"
      @update:model-value="
        $emit('update:modelValue', {
          ...modelValue,
          metadata: { ...modelValue.metadata, goals: $event },
        })
      "
    />

    <v-textarea
      :model-value="modelValue.metadata.notes"
      :label="$t('factions.notes')"
      variant="outlined"
      rows="3"
      @update:model-value="
        $emit('update:modelValue', {
          ...modelValue,
          metadata: { ...modelValue.metadata, notes: $event },
        })
      "
    />
  </div>
</template>

<script setup lang="ts">
interface FactionFormData {
  name: string
  description: string
  leaderId: number | null
  metadata: {
    type?: string
    alignment?: string
    headquarters?: string
    goals?: string
    notes?: string
  }
}

interface NPC {
  id: number
  name: string
}

interface Props {
  modelValue: FactionFormData
  npcs: NPC[]
  isEditMode: boolean
  imageUrl?: string | null
  uploadingImage?: boolean
  generatingImage?: boolean
  deletingImage?: boolean
  hasApiKey?: boolean
}

defineProps<Props>()

defineEmits<{
  'update:modelValue': [value: FactionFormData]
  'preview-image': [url: string]
  'upload-click': []
  'generate-image': []
  'download-image': []
  'delete-image': []
}>()
</script>

<style scoped>
.blur-image {
  filter: blur(4px);
  opacity: 0.6;
}
</style>
