<template>
  <div class="pa-4">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="images.length === 0" class="text-center py-8 text-medium-emphasis">
      {{ emptyMessage }}
    </div>

    <!-- Image Grid (READ-ONLY) -->
    <v-row v-else dense>
      <v-col v-for="image in images" :key="image.id" cols="6" sm="4" md="3">
        <v-card @click="$emit('preview', image)">
          <v-img :src="`/uploads/${image.image_url}`" aspect-ratio="1" cover class="cursor-pointer" />
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
interface Image {
  id: number
  image_url: string
  is_primary: boolean
}

interface Props {
  images: Image[]
  loading?: boolean
  emptyMessage: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

defineEmits<{
  preview: [image: Image]
}>()
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
