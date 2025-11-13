<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <div class="d-flex flex-column flex-grow-1">
          <span>{{ title }}</span>
          <span v-if="subtitle" class="text-caption text-medium-emphasis">{{ subtitle }}</span>
        </div>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:model-value', false)" />
      </v-card-title>

      <!-- Chips for metadata (rarity, type, race+class, etc.) -->
      <v-card-text v-if="chips && chips.length > 0" class="pt-0 pb-2">
        <div class="d-flex flex-wrap gap-2">
          <v-chip
            v-for="(chip, index) in chips"
            :key="index"
            :color="chip.color"
            :prepend-icon="chip.icon"
            size="small"
            :variant="chip.variant || 'flat'"
          >
            {{ chip.text }}
          </v-chip>
        </div>
      </v-card-text>

      <v-card-text class="pa-0">
        <v-img :src="imageUrl" max-height="700" contain />
      </v-card-text>
      <v-card-actions v-if="showDownload">
        <v-spacer />
        <v-btn prepend-icon="mdi-download" variant="text" @click="handleDownload"> Download </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface ChipData {
  text: string
  color?: string
  icon?: string
  variant?: 'flat' | 'outlined' | 'tonal'
}

interface Props {
  modelValue: boolean
  imageUrl: string
  title: string
  subtitle?: string
  chips?: ChipData[]
  showDownload?: boolean
  downloadFileName?: string
}

const props = withDefaults(defineProps<Props>(), {
  showDownload: true,
  downloadFileName: 'image',
  subtitle: '',
  chips: () => [],
})

defineEmits<{
  'update:model-value': [value: boolean]
}>()

const { downloadImage } = useImageDownload()

function handleDownload() {
  if (props.imageUrl && props.downloadFileName) {
    downloadImage(props.imageUrl, props.downloadFileName)
  }
}
</script>
