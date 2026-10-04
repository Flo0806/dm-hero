<template>
  <div ref="mapContainer" class="map-viewer" />
</template>

<script setup lang="ts">
import type { CampaignMap, MapMarker, MapArea, MapClimateArea } from '~~/types/map'
import { clampPercent, FOG_MAX_POINTS, simplifyStroke, type FogMode, type FogStroke, type MapFog } from '~~/types/fog'
import type {
  Map as LeafletMap,
  ImageOverlay,
  LayerGroup,
  LeafletMouseEvent,
  DragEndEvent,
  Circle,
  Polyline,
  CircleMarker,
} from 'leaflet'

// Leaflet only works in browser (needs window)
let L: typeof import('leaflet') | null = null

const props = defineProps<{
  map: CampaignMap
  markers?: MapMarker[]
  areas?: MapArea[]
  climateAreas?: MapClimateArea[]
  // Current in-game weather per zone id — shown in the circle's hover tooltip.
  climateWeather?: Record<number, { weather_type: string, temperature: number | null }>
  editMode?: boolean // Enable area drawing/editing
  measurePoints?: { x: number, y: number }[] // Points for measurement tool
  fog?: MapFog | null // Fog of war (shown when set)
  fogTool?: { mode: FogMode, radius: number } | null // Painting fog (map can't be dragged meanwhile)
  pingEnabled?: boolean // Long press = ping, right-click = note (only while players see this map)
}>()

const emit = defineEmits<{
  markerClick: [marker: MapMarker]
  markerRightClick: [marker: MapMarker]
  mapClick: [position: { x: number, y: number }]
  markerDrag: [data: { marker: MapMarker, x: number, y: number }]
  markerDragIntoArea: [data: { marker: MapMarker, area: MapArea, x: number, y: number }]
  markerDragOutOfArea: [data: { marker: MapMarker, previousArea: MapArea, x: number, y: number }]
  areaClick: [area: MapArea]
  areaRightClick: [area: MapArea]
  areaDrag: [data: { area: MapArea, x: number, y: number }]
  climateAreaRightClick: [area: MapClimateArea]
  climateAreaDrag: [data: { area: MapClimateArea, x: number, y: number }]
  fogStroke: [stroke: FogStroke]
  longPress: [position: { x: number, y: number }]
  mapRightClick: [position: { x: number, y: number }]
}>()

const { t } = useI18n()

const mapContainer = ref<HTMLElement | null>(null)
let leafletMap: LeafletMap | null = null
let imageOverlay: ImageOverlay | null = null
const markerLayer = shallowRef<LayerGroup | null>(null)
const areaLayer = shallowRef<LayerGroup | null>(null)
// Climate zones paint the background — kept on their own layer below location
// areas and markers.
const climateLayer = shallowRef<LayerGroup | null>(null)

// Store circle references for drag handling
const circleRefs = new Map<number, Circle>()
const climateCircleRefs = new Map<number, Circle>()
// Per-circle unlock state — a climate circle is locked (not draggable) until
// the user clicks its lock badge. Reset whenever the area list changes.
const unlockedClimateAreas = ref<Set<number>>(new Set())

// Drag state for climate circles (separate from location-area drag).
const draggingClimateArea = ref<MapClimateArea | null>(null)
const climateDragStartPos = ref<{ lat: number, lng: number } | null>(null)
const climateStartCenter = ref<{ lat: number, lng: number } | null>(null)
const climateDidDrag = ref(false)

// Drag state for areas
const draggingArea = ref<MapArea | null>(null)
const dragStartPos = ref<{ lat: number, lng: number } | null>(null)
const areaStartCenter = ref<{ lat: number, lng: number } | null>(null)

// Flag to suppress click after drag/resize (only if actually moved)
const justFinishedDragging = ref(false)
const didActuallyDrag = ref(false)

// Measurement line layer
let measureLineLayer: LayerGroup | null = null
let _measureLine: Polyline | null = null // Prefixed with _ to satisfy linter
const measureMarkers: CircleMarker[] = []

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

// Update areas when they change
watch(
  () => props.areas,
  () => {
    updateAreas()
  },
  { deep: true },
)

// Update climate areas when they change
watch(
  () => props.climateAreas,
  () => {
    updateClimateAreas()
  },
  { deep: true },
)

// Fog of war: redraw on change, painting mode locks map dragging
watch(() => props.fog, () => updateFog())
watch(() => props.fogTool, () => applyFogTool())

// Update measurement line when points change
watch(
  () => props.measurePoints,
  () => {
    updateMeasureLine()
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

    // Create climate layer (background — below location areas)
    climateLayer.value = L.layerGroup().addTo(leafletMap)

    // Create area layer (below markers)
    areaLayer.value = L.layerGroup().addTo(leafletMap)

    // Create marker layer (above areas)
    markerLayer.value = L.layerGroup().addTo(leafletMap)

    // Create measurement line layer (top)
    measureLineLayer = L.layerGroup().addTo(leafletMap)

    // Fog of war: above areas, below markers
    mapSize = { width: boundsWidth, height: boundsHeight }
    leafletMap.createPane('fog').style.zIndex = '450'
    fogCanvas = createFogCanvas(boundsWidth, boundsHeight, FOG_COLOR)
    fogLayer = L.svgOverlay(fogCanvas.svg, bounds, { pane: 'fog', interactive: false })
    setupFogPainting()
    updateFog()
    applyFogTool()

    // Add areas and markers
    updateClimateAreas()
    updateAreas()
    updateMarkers()
    updateMeasureLine()

    setupLongPress()

    // Handle map clicks
    leafletMap.on('click', (e: LeafletMouseEvent) => {
      if (!imageOverlay) return
      // Don't emit click if we just finished dragging an area or climate circle
      if (justFinishedDragging.value || climateDidDrag.value) return

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

// ---------------------------------------------------------------------------
// Fog of war
// ---------------------------------------------------------------------------

// The DM sees through the fog (half transparent) - players won't
const FOG_COLOR = '#0b0d14'
const FOG_OPACITY = 0.55

let mapSize = { width: 1000, height: 1000 }
let fogCanvas: ReturnType<typeof createFogCanvas> | null = null
let fogLayer: L.SVGOverlay | null = null
let paintingStroke: FogStroke | null = null

function updateFog() {
  if (!leafletMap || !fogLayer || !fogCanvas) return
  if (!props.fog) {
    fogLayer.remove()
    return
  }
  fogCanvas.render(props.fog)
  fogCanvas.svg.style.opacity = String(FOG_OPACITY)
  if (!leafletMap.hasLayer(fogLayer)) fogLayer.addTo(leafletMap)
}

function applyFogTool() {
  if (!leafletMap || !mapContainer.value) return
  if (props.fogTool) leafletMap.dragging.disable()
  else leafletMap.dragging.enable()
  mapContainer.value.classList.toggle('fog-painting', !!props.fogTool)
}

/** Lat/lng of the map -> percent of the image */
/** Lat/lng of the map -> percent of the image (past the edge = at the edge) */
function toPercent(latlng: L.LatLng): [number, number] {
  return [
    clampPercent(Math.round(latlng.lng / mapSize.width * 10000) / 100),
    clampPercent(Math.round((mapSize.height - latlng.lat) / mapSize.height * 10000) / 100),
  ]
}

function finishStroke() {
  if (!paintingStroke) return
  const stroke = paintingStroke
  paintingStroke = null
  // Same look with far fewer points - keeps the fog small enough to send live
  emit('fogStroke', { ...stroke, points: simplifyStroke(stroke.points, stroke.radius * 0.1) })
}

function setupFogPainting() {
  if (!leafletMap) return
  leafletMap.on('mousedown', (e: LeafletMouseEvent) => {
    if (!props.fogTool || !fogCanvas || e.originalEvent.button !== 0) return
    paintingStroke = { mode: props.fogTool.mode, radius: props.fogTool.radius, points: [toPercent(e.latlng)] }
    fogCanvas.livePath(paintingStroke)
  })
  leafletMap.on('mousemove', (e: LeafletMouseEvent) => {
    if (!paintingStroke || !fogCanvas) return
    const point = toPercent(e.latlng)
    const last = paintingStroke.points.at(-1)!
    // Only every few pixels - keeps strokes small enough to send live
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < paintingStroke.radius * 0.25) return
    paintingStroke.points.push(point)
    fogCanvas.livePath(paintingStroke)
    // Very long stroke: send this part, go on with a new one
    if (paintingStroke.points.length >= FOG_MAX_POINTS) {
      const { mode, radius } = paintingStroke
      finishStroke()
      paintingStroke = { mode, radius, points: [point] }
      fogCanvas.livePath(paintingStroke)
    }
  })
  leafletMap.on('mouseup', finishStroke)
  // Released outside the map
  document.addEventListener('mouseup', finishStroke)
}

onUnmounted(() => document.removeEventListener('mouseup', finishStroke))

// ---------------------------------------------------------------------------
// Long press = ping (pulses three times, like Roll20)
// ---------------------------------------------------------------------------

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_PX = 6
let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressStart: { x: number, y: number } | null = null
let suppressClick = false

function cancelPress() {
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = null
  pressStart = null
}

// On the DOM (capture phase), not Leaflet events: areas and markers stop
// Leaflet's mousedown, but pings must work on them too (cities!)
function onPressStart(event: PointerEvent) {
  cancelPress()
  if (!props.pingEnabled || props.fogTool || event.button !== 0 || !leafletMap) return
  pressStart = { x: event.clientX, y: event.clientY }
  const [x, y] = toPercent(leafletMap.mouseEventToLatLng(event))
  pressTimer = setTimeout(() => {
    pressTimer = null
    pressStart = null
    suppressClick = true
    emit('longPress', { x, y })
  }, LONG_PRESS_MS)
}

function onPressMove(event: PointerEvent) {
  // Dragging the map (or a marker) is not a long press
  if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > LONG_PRESS_MOVE_PX) cancelPress()
}

// The click that ends a long press is not a click - not on the map, area or marker
function onClickCapture(event: MouseEvent) {
  if (!suppressClick) return
  suppressClick = false
  event.stopPropagation()
  event.preventDefault()
}

function setupLongPress() {
  const el = mapContainer.value
  if (!el || !leafletMap) return
  el.addEventListener('pointerdown', onPressStart, true)
  el.addEventListener('pointermove', onPressMove, true)
  el.addEventListener('pointerup', cancelPress, true)
  el.addEventListener('click', onClickCapture, true)
  leafletMap.on('zoomstart', cancelPress)
  // Right-click on the map itself (markers/areas handle their own) - only when a note can follow
  leafletMap.on('contextmenu', (e: LeafletMouseEvent) => {
    if (!props.pingEnabled) return
    e.originalEvent.preventDefault()
    const [x, y] = toPercent(e.latlng)
    emit('mapRightClick', { x, y })
  })
}

onUnmounted(() => {
  cancelPress()
  const el = mapContainer.value
  if (!el) return
  el.removeEventListener('pointerdown', onPressStart, true)
  el.removeEventListener('pointermove', onPressMove, true)
  el.removeEventListener('pointerup', cancelPress, true)
  el.removeEventListener('click', onClickCapture, true)
})

/** Show a ping at a spot (percent): a ring pulsing three times + who pinged (or a note, shown longer) */
function ping(x: number, y: number, label: string, color: string, durationMs: number) {
  if (!leafletMap || !L) return
  const icon = L.divIcon({
    className: 'map-ping',
    html: `<span class="map-ping-ring" style="--ping-color:${color}"></span><span class="map-ping-label"></span>`,
    iconSize: [0, 0],
  })
  const marker = L.marker([mapSize.height - y / 100 * mapSize.height, x / 100 * mapSize.width], { icon, interactive: false, keyboard: false, zIndexOffset: 2000 })
    .addTo(leafletMap)
  // Text via textContent - player names never become HTML
  const labelEl = marker.getElement()?.querySelector('.map-ping-label')
  if (labelEl) labelEl.textContent = label
  setTimeout(() => marker.remove(), durationMs)
}

// Threshold: show labels only when zoomed in enough
const LABEL_ZOOM_THRESHOLD = 0

// Default color for location areas
const LOCATION_AREA_COLOR = '#8B7355'

// Helper: Check if a point (x%, y%) is inside an area circle
function isPointInArea(x: number, y: number, area: MapArea): boolean {
  const dx = x - area.center_x
  const dy = y - area.center_y
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance <= area.radius
}

// Helper: Find which area a point is inside (if any)
function findAreaAtPoint(x: number, y: number): MapArea | null {
  if (!props.areas) return null
  for (const area of props.areas) {
    if (isPointInArea(x, y, area)) {
      return area
    }
  }
  return null
}

// Helper: Find which area a marker was in before dragging (based on entity's location_id)
function findPreviousAreaForMarker(marker: MapMarker): MapArea | null {
  if (!props.areas) return null
  // Check if there's an area for this entity's current location
  // We need to check if the marker's entity has a location that matches an area
  // For now, we check if the marker's OLD position was inside any area
  return findAreaAtPoint(marker.x, marker.y)
}

function updateAreas() {
  if (!areaLayer.value || !imageOverlay || !props.areas || !L || !leafletMap) return

  // Clear existing areas
  areaLayer.value.clearLayers()
  circleRefs.clear()

  const bounds = imageOverlay.getBounds()
  const width = bounds.getEast() - bounds.getWest()
  const height = bounds.getNorth() - bounds.getSouth()

  // Add areas
  for (const area of props.areas) {
    // Convert percentage to lat/lng
    const lng = bounds.getWest() + (area.center_x / 100) * width
    const lat = bounds.getNorth() - (area.center_y / 100) * height

    // Radius as percentage of width converted to map units
    const radiusInMapUnits = (area.radius / 100) * width

    const color = area.color || LOCATION_AREA_COLOR

    const circle = L.circle([lat, lng], {
      radius: radiusInMapUnits,
      color: color,
      fillColor: color,
      fillOpacity: 0.2,
      weight: 2,
      interactive: true,
    })

    // Store reference for potential resize
    circleRefs.set(area.id, circle)

    // Tooltip with location name
    circle.bindTooltip(area.location_name || 'Location', {
      permanent: false,
      direction: 'center',
    })

    // Click handler - view location (only if not dragging)
    circle.on('click', (e: LeafletMouseEvent) => {
      if (draggingArea.value || justFinishedDragging.value) return
      L?.DomEvent.stopPropagation(e)
      emit('areaClick', area)
    })

    // Right-click handler - edit area
    circle.on('contextmenu', (e: LeafletMouseEvent) => {
      e.originalEvent.preventDefault()
      L?.DomEvent.stopPropagation(e)
      emit('areaRightClick', area)
    })

    // Drag start - begin dragging the area
    circle.on('mousedown', (e: LeafletMouseEvent) => {
      if (e.originalEvent.button !== 0) return // Only left mouse button
      L?.DomEvent.stopPropagation(e)
      startAreaDrag(area, e)
    })

    circle.addTo(areaLayer.value!)
  }
}

// Render climate-zone circles in the zone's color. Distinct look from location
// areas: dashed border + softer fill so they read as background regions, not
// pins. Click → emit (weather popup); right-click → emit (delete).
function updateClimateAreas() {
  if (!climateLayer.value || !imageOverlay || !L || !leafletMap) return

  climateLayer.value.clearLayers()
  climateCircleRefs.clear()
  if (!props.climateAreas) return

  const bounds = imageOverlay.getBounds()
  const width = bounds.getEast() - bounds.getWest()
  const height = bounds.getNorth() - bounds.getSouth()

  // Locked climate circles are background-only and never intercept clicks, so
  // markers/measuring/other zones underneath stay fully usable even when zones
  // overlap or cover the whole map. The lock badge is the only interactive bit.
  const LOCKED_FILL = 0.08
  const HOVER_FILL = 0.22
  const UNLOCKED_FILL = 0.2

  for (const area of props.climateAreas) {
    const lng = bounds.getWest() + (area.center_x / 100) * width
    const lat = bounds.getNorth() - (area.center_y / 100) * height
    const radiusInMapUnits = (area.radius / 100) * width
    const color = area.zone_color || '#4DD0E1'
    const unlocked = unlockedClimateAreas.value.has(area.id)

    const circle = L.circle([lat, lng], {
      radius: radiusInMapUnits,
      color,
      fillColor: color,
      fillOpacity: unlocked ? UNLOCKED_FILL : LOCKED_FILL,
      weight: 2,
      // Solid border + interactive only when unlocked (= the user is editing it).
      dashArray: unlocked ? undefined : '6 6',
      interactive: unlocked,
    })

    climateCircleRefs.set(area.id, circle)

    if (unlocked) {
      // Editing this zone: drag to move, right-click to resize/delete.
      circle.on('contextmenu', (e: LeafletMouseEvent) => {
        e.originalEvent.preventDefault()
        L?.DomEvent.stopPropagation(e)
        emit('climateAreaRightClick', area)
      })
      circle.on('mousedown', (e: LeafletMouseEvent) => {
        if (e.originalEvent.button !== 0) return // left button only
        L?.DomEvent.stopPropagation(e)
        startClimateDrag(area, e)
      })
    }

    circle.addTo(climateLayer.value!)

    // Lock badge at the circle center — the only always-interactive element.
    // Hover reveals the zone (name tooltip + brighter fill); click toggles edit.
    const lockIcon = unlocked ? 'mdi-lock-open-variant' : 'mdi-lock'
    const lockMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'climate-lock-badge',
        html: `<span class="mdi ${lockIcon}" style="color:${color}"></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      interactive: true,
      keyboard: false,
    })
    // Tooltip: zone name + current weather (temp + type) when available, plus
    // a small lock hint. No separate popup — everything lives in the tooltip.
    // Build the DOM with textContent so user-controlled values (zone name) are
    // never interpreted as HTML (XSS-safe).
    const w = props.climateWeather?.[area.id]
    const parts = [area.zone_name || 'Zone']
    if (w) {
      const temp = w.temperature != null ? `${w.temperature}° ` : ''
      parts.push(`${temp}${t(`calendar.weather.types.${w.weather_type}`, w.weather_type)}`)
    }
    const lockHint = unlocked ? t('maps.climateUnlocked') : t('maps.climateLocked')
    const tooltipEl = document.createElement('div')
    const titleEl = document.createElement('strong')
    titleEl.textContent = parts.join(' · ')
    const hintEl = document.createElement('span')
    hintEl.style.opacity = '0.7'
    hintEl.style.fontSize = '0.85em'
    hintEl.textContent = lockHint
    tooltipEl.appendChild(titleEl)
    tooltipEl.appendChild(document.createElement('br'))
    tooltipEl.appendChild(hintEl)
    lockMarker.bindTooltip(tooltipEl, { direction: 'top' })
    lockMarker.on('mouseover', () => circle.setStyle({ fillOpacity: HOVER_FILL }))
    lockMarker.on('mouseout', () => circle.setStyle({ fillOpacity: unlocked ? UNLOCKED_FILL : LOCKED_FILL }))
    lockMarker.on('click', (e: LeafletMouseEvent) => {
      L?.DomEvent.stopPropagation(e)
      const next = new Set(unlockedClimateAreas.value)
      if (next.has(area.id)) next.delete(area.id)
      else next.add(area.id)
      unlockedClimateAreas.value = next
      updateClimateAreas() // re-render to refresh badge + circle style/interactivity
    })
    lockMarker.addTo(climateLayer.value!)
  }
}

// Area drag handlers
function startAreaDrag(area: MapArea, e: LeafletMouseEvent) {
  if (!leafletMap || !L) return

  draggingArea.value = area
  dragStartPos.value = { lat: e.latlng.lat, lng: e.latlng.lng }

  const circle = circleRefs.get(area.id)
  if (circle) {
    const center = circle.getLatLng()
    areaStartCenter.value = { lat: center.lat, lng: center.lng }
  }

  // Disable map drag during area drag
  leafletMap.dragging.disable()

  // Add move and up listeners to map container
  leafletMap.on('mousemove', onAreaDragMove)
  leafletMap.on('mouseup', onAreaDragEnd)
}

function onAreaDragMove(e: LeafletMouseEvent) {
  if (!draggingArea.value || !dragStartPos.value || !areaStartCenter.value || !L) return

  const circle = circleRefs.get(draggingArea.value.id)
  if (!circle) return

  // Calculate new position
  const deltaLat = e.latlng.lat - dragStartPos.value.lat
  const deltaLng = e.latlng.lng - dragStartPos.value.lng

  const newLat = areaStartCenter.value.lat + deltaLat
  const newLng = areaStartCenter.value.lng + deltaLng

  // Mark that we actually moved
  didActuallyDrag.value = true

  // Move circle
  circle.setLatLng([newLat, newLng])
}

function onAreaDragEnd(_e: LeafletMouseEvent) {
  if (!draggingArea.value || !imageOverlay || !leafletMap || !L) return

  const circle = circleRefs.get(draggingArea.value.id)
  if (!circle) {
    cleanupAreaDrag()
    return
  }

  // Calculate final position as percentage
  const bounds = imageOverlay.getBounds()
  const width = bounds.getEast() - bounds.getWest()
  const height = bounds.getNorth() - bounds.getSouth()

  const finalLatLng = circle.getLatLng()
  const newX = ((finalLatLng.lng - bounds.getWest()) / width) * 100
  const newY = ((bounds.getNorth() - finalLatLng.lat) / height) * 100

  // Emit drag event with new position
  emit('areaDrag', {
    area: draggingArea.value,
    x: newX,
    y: newY,
  })

  cleanupAreaDrag()
}

function cleanupAreaDrag() {
  if (leafletMap) {
    leafletMap.dragging.enable()
    leafletMap.off('mousemove', onAreaDragMove)
    leafletMap.off('mouseup', onAreaDragEnd)
  }

  // Only suppress click if we actually dragged (not just clicked)
  if (didActuallyDrag.value) {
    justFinishedDragging.value = true
    setTimeout(() => {
      justFinishedDragging.value = false
    }, 100)
  }

  draggingArea.value = null
  dragStartPos.value = null
  areaStartCenter.value = null
  didActuallyDrag.value = false
}

// --- Climate-circle dragging (mirrors the location-area drag above) ---
function startClimateDrag(area: MapClimateArea, e: LeafletMouseEvent) {
  if (!leafletMap || !L) return
  draggingClimateArea.value = area
  climateDragStartPos.value = { lat: e.latlng.lat, lng: e.latlng.lng }
  const circle = climateCircleRefs.get(area.id)
  if (circle) {
    const center = circle.getLatLng()
    climateStartCenter.value = { lat: center.lat, lng: center.lng }
  }
  climateDidDrag.value = false
  leafletMap.dragging.disable()
  leafletMap.on('mousemove', onClimateDragMove)
  leafletMap.on('mouseup', onClimateDragEnd)
}

function onClimateDragMove(e: LeafletMouseEvent) {
  if (!draggingClimateArea.value || !climateDragStartPos.value || !climateStartCenter.value) return
  const circle = climateCircleRefs.get(draggingClimateArea.value.id)
  if (!circle) return
  const deltaLat = e.latlng.lat - climateDragStartPos.value.lat
  const deltaLng = e.latlng.lng - climateDragStartPos.value.lng
  climateDidDrag.value = true
  circle.setLatLng([climateStartCenter.value.lat + deltaLat, climateStartCenter.value.lng + deltaLng])
}

function onClimateDragEnd() {
  if (!draggingClimateArea.value || !imageOverlay || !leafletMap) {
    cleanupClimateDrag()
    return
  }
  const circle = climateCircleRefs.get(draggingClimateArea.value.id)
  if (circle) {
    const bounds = imageOverlay.getBounds()
    const width = bounds.getEast() - bounds.getWest()
    const height = bounds.getNorth() - bounds.getSouth()
    const c = circle.getLatLng()
    emit('climateAreaDrag', {
      area: draggingClimateArea.value,
      x: ((c.lng - bounds.getWest()) / width) * 100,
      y: ((bounds.getNorth() - c.lat) / height) * 100,
    })
  }
  cleanupClimateDrag()
}

function cleanupClimateDrag() {
  if (leafletMap) {
    leafletMap.dragging.enable()
    leafletMap.off('mousemove', onClimateDragMove)
    leafletMap.off('mouseup', onClimateDragEnd)
  }
  // Keep the drag flag briefly so the trailing click doesn't open the popup.
  if (climateDidDrag.value) {
    setTimeout(() => {
      climateDidDrag.value = false
    }, 100)
  }
  draggingClimateArea.value = null
  climateDragStartPos.value = null
  climateStartCenter.value = null
}

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

    // Drag handler - emit new position and check for area transitions
    leafletMarker.on('dragend', (e: DragEndEvent) => {
      const newPos = e.target.getLatLng()
      const newX = ((newPos.lng - bounds.getWest()) / width) * 100
      const newY = ((bounds.getNorth() - newPos.lat) / height) * 100

      // Check if marker moved in/out of an area
      const previousArea = findPreviousAreaForMarker(marker)
      const newArea = findAreaAtPoint(newX, newY)

      // Emit base drag event first
      emit('markerDrag', { marker, x: newX, y: newY })

      // Check for area transitions
      if (!previousArea && newArea) {
        // Marker was dragged INTO an area
        emit('markerDragIntoArea', { marker, area: newArea, x: newX, y: newY })
      }
      else if (previousArea && !newArea) {
        // Marker was dragged OUT OF an area
        emit('markerDragOutOfArea', { marker, previousArea, x: newX, y: newY })
      }
      else if (previousArea && newArea && previousArea.id !== newArea.id) {
        // Marker moved from one area to another - treat as out of old, into new
        emit('markerDragOutOfArea', { marker, previousArea, x: newX, y: newY })
        emit('markerDragIntoArea', { marker, area: newArea, x: newX, y: newY })
      }
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
function saveMapState(mapId: number, state: { zoom: number, center: [number, number] }) {
  try {
    const key = `map-view-${mapId}`
    localStorage.setItem(key, JSON.stringify(state))
  }
  catch {
    // localStorage might not be available
  }
}

function loadMapState(mapId: number): { zoom: number, center: [number, number] } | null {
  try {
    const key = `map-view-${mapId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      return JSON.parse(saved)
    }
  }
  catch {
    // localStorage might not be available
  }
  return null
}

// Update measurement line
function updateMeasureLine() {
  if (!measureLineLayer || !L || !imageOverlay) return

  // Clear existing
  measureLineLayer.clearLayers()
  measureMarkers.length = 0
  _measureLine = null

  const points = props.measurePoints
  if (!points || points.length === 0) return

  const b = imageOverlay.getBounds()

  // Convert percentage points to lat/lng
  const latLngs = points.map((p) => {
    const lng = b.getWest() + (p.x / 100) * (b.getEast() - b.getWest())
    const lat = b.getNorth() - (p.y / 100) * (b.getNorth() - b.getSouth())
    return L!.latLng(lat, lng)
  })

  // Draw polyline
  if (latLngs.length >= 2) {
    _measureLine = L.polyline(latLngs, {
      color: '#FFD700',
      weight: 3,
      opacity: 0.8,
      dashArray: '10, 5',
    }).addTo(measureLineLayer)
  }

  // Draw circle markers at each point
  latLngs.forEach((latLng, index) => {
    const circleMarker = L!.circleMarker(latLng, {
      radius: 6,
      fillColor: index === 0 ? '#4CAF50' : '#FFD700', // First point green
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 1,
    }).addTo(measureLineLayer!)

    measureMarkers.push(circleMarker)
  })
}

// Expose method to programmatically add marker at position
defineExpose({
  getMap: () => leafletMap,
  ping,
})
</script>

<style>
.map-viewer {
  width: 100%;
  height: 100%;
  background: #1a1d29;
}

/* Climate-zone lock badge at the circle center */
.climate-lock-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.climate-lock-badge .mdi {
  font-size: 18px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.climate-lock-badge .mdi::before {
  /* @mdi/font ligature glyphs render via ::before; ensure size matches */
  font-size: 16px;
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

/* Painting fog of war: markers and areas let the brush through */
.map-viewer.fog-painting,
.map-viewer.fog-painting .leaflet-interactive {
  cursor: crosshair !important;
}

.map-viewer.fog-painting .leaflet-marker-pane,
.map-viewer.fog-painting .leaflet-overlay-pane .leaflet-interactive {
  pointer-events: none !important;
}

/* Ping: ring pulsing three times */
.map-ping {
  pointer-events: none;
}

.map-ping-ring {
  position: absolute;
  left: -30px;
  top: -30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 4px solid var(--ping-color);
  box-shadow: 0 0 12px var(--ping-color);
  animation: map-ping-pulse 0.8s ease-out 3 forwards;
}

.map-ping-label {
  position: absolute;
  top: 34px;
  left: 0;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes map-ping-pulse {
  from { transform: scale(0.2); opacity: 1; }
  to { transform: scale(1.4); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .map-ping-ring {
    animation: none;
  }
}

/* Area resize handle */
.area-resize-handle {
  cursor: ew-resize !important;
}

.area-resize-handle:hover {
  transform: scale(1.2);
}

/* Leaflet circle hover for draggable areas */
.leaflet-interactive.area-draggable {
  cursor: move !important;
}
</style>
