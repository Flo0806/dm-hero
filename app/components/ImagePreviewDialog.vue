<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>{{ title }}</span>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:model-value', false)" />
      </v-card-title>
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
interface Props {
  modelValue: boolean
  imageUrl: string
  title: string
  showDownload?: boolean
  downloadFileName?: string
}

const props = withDefaults(defineProps<Props>(), {
  showDownload: true,
  downloadFileName: 'image',
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
