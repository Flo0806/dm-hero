<template>
  <div ref="mapContainer" class="map-viewer" />
</template>

<script setup lang="ts">
import type { CampaignMap, MapMarker } from '~~/types/map'
import type {
  Map as LeafletMap,
  ImageOverlay,
  LayerGroup,
  LeafletMouseEvent,
  DragEndEvent,
} from 'leaflet'

// Leaflet only works in browser (needs window)
let L: typeof import('leaflet') | null = null

const props = defineProps<{
  map: CampaignMap
  markers?: MapMarker[]
}>()

const emit = defineEmits<{
  markerClick: [marker: MapMarker]
  markerRightClick: [marker: MapMarker]
  mapClick: [position: { x: number; y: number }]
  markerDrag: [data: { marker: MapMarker; x: number; y: number }]
}>()

const mapContainer = ref<HTMLElement | null>(null)
let leafletMap: LeafletMap | null = null
let imageOverlay: ImageOverlay | null = null
const markerLayer = shallowRef<LayerGroup | null>(null)

// Initialize map when container is ready
onMounted(async () => {
  // Dynamic import - Leaflet needs window
  const leaflet = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  L = leaflet.default || leaflet

  await nextTick()
  if (mapContainer.value) {
    initMap()
  }
})

onUnmounted(() => {
  if (leafletMap) {
    leafletMap.remove()
    leafletMap = null
  }
})

// Reinitialize when map changes
watch(
  () => props.map.id,
  () => {
    if (leafletMap) {
      leafletMap.remove()
      leafletMap = null
    }
    nextTick(() => initMap())
  },
)

// Update markers when they change
watch(
  () => props.markers,
  () => {
    updateMarkers()
  },
  { deep: true },
)

function initMap() {
  if (!mapContainer.value || !L) return

  // Load image to get dimensions first
  const img = new Image()
  img.onload = () => {
    if (!mapContainer.value || !L) return

    // Use normalized coordinates (0-1000 for easier math)
    // Scale image to fit in 1000x1000 coordinate space
    const aspectRatio = img.width / img.height
    const boundsHeight = 1000
    const boundsWidth = 1000 * aspectRatio

    const bounds: L.LatLngBoundsExpression = [[0, 0], [boundsHeight, boundsWidth]]

    // Load saved view state
    const savedState = loadMapState(props.map.id)

    // Create map with simple CRS for image overlay
    leafletMap = L.map(mapContainer.value, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 4,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      center: savedState?.center || [boundsHeight / 2, boundsWidth / 2],
      zoom: savedState?.zoom ?? 0, // Default 100%
    })

    // Add image overlay
    imageOverlay = L.imageOverlay(`/uploads/${props.map.image_url}`, bounds)
    imageOverlay.addTo(leafletMap)

    // Create marker layer
    markerLayer.value = L.layerGroup().addTo(leafletMap)

    // Add markers
    updateMarkers()

    // Handle map clicks
    leafletMap.on('click', (e: LeafletMouseEvent) => {
      if (!imageOverlay) return

      // Convert lat/lng to percentage of image
      const b = imageOverlay.getBounds()
      const x = ((e.latlng.lng - b.getWest()) / (b.getEast() - b.getWest())) * 100
      const y = ((b.getNorth() - e.latlng.lat) / (b.getNorth() - b.getSouth())) * 100

      emit('mapClick', { x, y })
    })

    // Save view state on zoom/pan and update labels visibility
    leafletMap.on('moveend', () => {
      if (leafletMap) {
        saveMapState(props.map.id, {
          zoom: leafletMap.getZoom(),
          center: [leafletMap.getCenter().lat, leafletMap.getCenter().lng],
        })
      }
    })

    // Update marker labels when zoom changes
    leafletMap.on('zoomend', () => {
      updateMarkers()
    })
  }
  img.src = `/uploads/${props.map.image_url}`
}

// Threshold: show labels only when zoomed in enough
const LABEL_ZOOM_THRESHOLD = 0

function updateMarkers() {
  if (!markerLayer.value || !imageOverlay || !props.markers || !L || !leafletMap) return

  // Clear existing markers
  markerLayer.value.clearLayers()

  const bounds = imageOverlay.getBounds()
  const width = bounds.getEast() - bounds.getWest()
  const height = bounds.getNorth() - bounds.getSouth()

  // Check if we should show labels based on zoom
  const currentZoom = leafletMap.getZoom()
  const showLabels = currentZoom >= LABEL_ZOOM_THRESHOLD

  // Add markers
  for (const marker of props.markers) {
    // Convert percentage to lat/lng
    const lng = bounds.getWest() + (marker.x / 100) * width
    const lat = bounds.getNorth() - (marker.y / 100) * height

    const icon = createMarkerIcon(marker, showLabels)
    if (!icon) continue

    const leafletMarker = L.marker([lat, lng], {
      icon,
      draggable: true,
    })

    // Tooltip with custom label, notes, and description
    const tooltipContent = buildTooltipContent(marker)
    leafletMarker.bindTooltip(tooltipContent, {
      permanent: false,
      direction: 'top',
      offset: [0, -35],
    })

    // Click handler - open entity preview
    leafletMarker.on('click', () => {
      emit('markerClick', marker)
    })

    // Right-click handler - edit marker
    leafletMarker.on('contextmenu', (e: LeafletMouseEvent) => {
      e.originalEvent.preventDefault()
      emit('markerRightClick', marker)
    })

    // Drag handler - emit new position
    leafletMarker.on('dragend', (e: DragEndEvent) => {
      const newPos = e.target.getLatLng()
      const newX = ((newPos.lng - bounds.getWest()) / width) * 100
      const newY = ((bounds.getNorth() - newPos.lat) / height) * 100
      emit('markerDrag', { marker, x: newX, y: newY })
    })

    leafletMarker.addTo(markerLayer.value!)
  }
}

function createMarkerIcon(marker: MapMarker, showLabel: boolean) {
  if (!L) return null
  const color = marker.custom_color || getEntityColor(marker.entity_type)
  const iconName = marker.custom_icon || getEntityIcon(marker.entity_type)
  const label = marker.entity_name || ''

  return L.divIcon({
    className: 'map-marker-icon',
    html: `
      <div class="marker-wrapper">
        <div class="marker-pin" style="background-color: ${color}">
          <i class="mdi ${iconName}"></i>
        </div>
        ${showLabel ? `<div class="marker-label">${label}</div>` : ''}
      </div>
    `,
    iconSize: [80, 60],
    iconAnchor: [40, 42],
  })
}

function getEntityColor(entityType?: string): string {
  const colors: Record<string, string> = {
    npc: '#D4A574',
    location: '#8B7355',
    item: '#CC8844',
    faction: '#7B92AB',
    lore: '#9C6B98',
    player: '#4CAF50',
  }
  return colors[entityType?.toLowerCase() || ''] || '#888888'
}

function getEntityIcon(entityType?: string): string {
  const icons: Record<string, string> = {
    npc: 'mdi-account',
    location: 'mdi-map-marker',
    item: 'mdi-sword',
    faction: 'mdi-shield',
    lore: 'mdi-book-open-variant',
    player: 'mdi-account-star',
  }
  return icons[entityType?.toLowerCase() || ''] || 'mdi-map-marker'
}

function buildTooltipContent(marker: MapMarker): string {
  const name = marker.entity_name || 'Unknown'
  const customLabel = marker.custom_label
  const notes = marker.notes
  const description = marker.entity_description || ''

  let content = `<strong>${name}</strong>`

  // Show custom label if different from entity name
  if (customLabel && customLabel !== name) {
    content += `<br><span style="font-size: 11px; color: #D4A574;">"${customLabel}"</span>`
  }

  // Show notes if present
  if (notes) {
    const shortNotes = notes.length > 60 ? notes.substring(0, 60) + '...' : notes
    content += `<br><span style="font-size: 11px; font-style: italic;">${shortNotes}</span>`
  }

  // Show entity description as fallback
  if (!notes && description) {
    const shortDesc = description.length > 60 ? description.substring(0, 60) + '...' : description
    content += `<br><span style="font-size: 11px; opacity: 0.7;">${shortDesc}</span>`
  }

  return content
}

// LocalStorage helpers for map view state
function saveMapState(mapId: number, state: { zoom: number; center: [number, number] }) {
  try {
    const key = `map-view-${mapId}`
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // localStorage might not be available
  }
}

function loadMapState(mapId: number): { zoom: number; center: [number, number] } | null {
  try {
    const key = `map-view-${mapId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // localStorage might not be available
  }
  return null
}

// Expose method to programmatically add marker at position
defineExpose({
  getMap: () => leafletMap,
})
</script>

<style>
.map-viewer {
  width: 100%;
  height: 100%;
  background: #1a1d29;
}

.map-marker-icon {
  background: transparent;
  border: none;
}

.marker-pin {
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
}

.marker-pin i {
  transform: rotate(45deg);
  color: white;
  font-size: 16px;
}

.marker-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 80px;
}

.marker-label {
  margin-top: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

/* Hover effects */
.marker-wrapper:hover .marker-pin {
  transform: rotate(-45deg) scale(1.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.marker-pin {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
</style>
