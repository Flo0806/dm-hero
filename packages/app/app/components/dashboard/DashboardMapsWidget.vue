<template>
  <v-card class="dashboard-card h-100" variant="outlined" to="/maps" hover>
    <v-card-text class="pa-4">
      <div class="d-flex align-center justify-space-between mb-3">
        <div class="d-flex align-center">
          <v-icon icon="mdi-map" color="primary" size="24" class="mr-2" />
          <span class="text-subtitle-1 font-weight-medium">{{ $t('dashboard.maps.title') }}</span>
        </div>
        <v-icon icon="mdi-chevron-right" size="20" class="text-medium-emphasis" />
      </div>

      <div v-if="maps.length > 0">
        <!-- Map preview -->
        <div v-if="primaryMap" class="position-relative overflow-hidden rounded-lg mb-3">
          <v-img
            :src="`/uploads/${primaryMap.image_url}`"
            :aspect-ratio="16/9"
            cover
            class="rounded"
          >
            <div class="map-overlay d-flex align-center justify-space-between py-2 px-3">
              <span class="text-body-2 font-weight-medium text-white">{{ primaryMap.name }}</span>
              <v-chip size="x-small" color="primary" variant="flat">
                {{ primaryMap._markerCount || 0 }} {{ $t('dashboard.maps.markers') }}
              </v-chip>
            </div>
          </v-img>
        </div>

        <div class="dashboard-info-box d-flex justify-space-between py-2 px-3 rounded">
          <div class="text-body-2">
            <v-icon icon="mdi-map" size="16" class="mr-1" />
            {{ maps.length }} {{ $t('dashboard.maps.count') }}
          </div>
          <div class="text-body-2">
            <v-icon icon="mdi-map-marker" size="16" class="mr-1" />
            {{ totalMarkers }} {{ $t('dashboard.maps.totalMarkers') }}
          </div>
        </div>
      </div>

      <div v-else class="d-flex flex-column align-center text-center py-4">
        <v-icon icon="mdi-map-plus" size="32" class="text-medium-emphasis mb-2" />
        <p class="text-body-2 text-medium-emphasis mb-2">
          {{ $t('dashboard.maps.empty') }}
        </p>
        <v-btn size="small" color="primary" variant="tonal" to="/maps">
          {{ $t('dashboard.maps.add') }}
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { CampaignMap } from '~~/types/map'

const props = defineProps<{
  maps: CampaignMap[]
}>()

// Use the first map as primary preview
const primaryMap = computed(() => props.maps[0] || null)

const totalMarkers = computed(() => {
  return props.maps.reduce((sum, m) => sum + (m._markerCount || 0), 0)
})
</script>

<style scoped>
.map-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
}
</style>
