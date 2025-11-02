<template>
  <div v-if="breadcrumb" class="location-breadcrumb">
    <v-chip
      size="small"
      prepend-icon="mdi-map-marker-path"
      variant="outlined"
      color="primary"
    >
      {{ breadcrumb }}
    </v-chip>
  </div>
  <v-skeleton-loader v-else-if="loading" type="chip" width="200" />
</template>

<script setup lang="ts">
const props = defineProps<{
  locationId: number
}>()

const { fetchPath, formatBreadcrumb } = useLocationPath()

const breadcrumb = ref('')
const loading = ref(false)

// Fetch breadcrumb on mount
onMounted(async () => {
  loading.value = true
  try {
    const path = await fetchPath(props.locationId)

    // Remove current location from path (we only want parents)
    const parentPath = path.slice(0, -1)

    if (parentPath.length > 0) {
      breadcrumb.value = formatBreadcrumb(parentPath)
    }
  }
  finally {
    loading.value = false
  }
})
</script>

<style scoped>
.location-breadcrumb {
  font-size: 0.875rem;
}
</style>
