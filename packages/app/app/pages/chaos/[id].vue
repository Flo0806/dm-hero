<template>
  <div class="chaos-graph-container">
    <!-- Header with back button and entity info -->
    <div class="chaos-header">
      <v-btn icon variant="text" @click="goBack">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <div class="chaos-title">
        <h1 class="text-h5">{{ $t('chaos.title') }}</h1>
        <span v-if="entity" class="text-body-2 text-medium-emphasis">
          {{ entity.name }} · {{ connections.length }} {{ $t('chaos.connections') }}
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="chaos-loading">
      <v-progress-circular indeterminate size="64" color="primary" />
      <p class="mt-4 text-body-1">{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="chaos-error">
      <v-icon size="64" color="error">mdi-alert-circle</v-icon>
      <p class="mt-4 text-body-1">{{ error }}</p>
      <v-btn color="primary" class="mt-4" @click="goBack">
        {{ $t('common.back') }}
      </v-btn>
    </div>

    <!-- Chaos Graph Canvas -->
    <div v-else-if="entity" ref="canvasRef" class="chaos-canvas" @scroll="updateLines">
      <!-- SVG Lines Layer (behind cards) -->
      <svg v-if="connections.length > 0" class="chaos-lines chaos-lines--back">
        <!-- Main connection lines to center -->
        <line
          v-for="line in connectionLines"
          :key="line.id"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          :stroke="line.color"
          stroke-width="1.5"
          :stroke-opacity="hoveredConnectionId === null ? 0.4 : hoveredConnectionId === line.id ? 0 : 0.15"
          stroke-linecap="round"
          class="chaos-line"
        />
        <!-- Inter-connection lines (always visible, but dimmed) -->
        <line
          v-for="interLine in interConnectionLines"
          :key="'inter-back-' + interLine.id"
          :x1="interLine.x1"
          :y1="interLine.y1"
          :x2="interLine.x2"
          :y2="interLine.y2"
          stroke-width="1.5"
          :stroke-opacity="hoveredEntityId === null ? 0.25 : isInterLineHovered(interLine) ? 0 : 0.1"
          stroke-linecap="round"
          stroke-dasharray="6,4"
          class="chaos-line chaos-line--inter"
        />
      </svg>

      <!-- SVG Highlighted Line Layer (above cards) -->
      <svg v-if="hoveredConnectionId !== null && hoveredLine" class="chaos-lines chaos-lines--front">
        <!-- Main connection line to center -->
        <line
          :x1="hoveredLine.x1"
          :y1="hoveredLine.y1"
          :x2="hoveredLine.x2"
          :y2="hoveredLine.y2"
          :stroke="hoveredLine.color"
          stroke-width="3"
          stroke-opacity="1"
          stroke-linecap="round"
          class="chaos-line"
        />
        <!-- Inter-connection lines (connections between sibling entities) -->
        <line
          v-for="interLine in hoveredInterLines"
          :key="'inter-' + interLine.id"
          :x1="interLine.x1"
          :y1="interLine.y1"
          :x2="interLine.x2"
          :y2="interLine.y2"
          stroke-width="2"
          stroke-opacity="0.8"
          stroke-linecap="round"
          stroke-dasharray="6,4"
          class="chaos-line chaos-line--inter"
        />
      </svg>

      <!-- Center Entity Card (sticky at top) -->
      <div ref="centerRef" class="chaos-center-section">
        <ChaosEntityCard
          :entity="entity"
          :entity-type="entityType"
          :is-center="true"
          :is-highlighted="hoveredConnectionId !== null"
          @view="openViewDialog(entity!, entityType!)"
          @edit="openEditDialog(entity!, entityType!)"
        />
      </div>

      <!-- Connections Grid -->
      <div v-if="connections.length > 0" ref="gridRef" class="chaos-connections-grid">
        <ChaosEntityCard
          v-for="(conn, index) in connections"
          :key="conn.relationId"
          :ref="(el) => setConnectionRef(index, el)"
          :entity="connectionToEntity(conn)"
          :entity-type="connectionToEntityType(conn)"
          :relation-label="translateRelationType(conn.relationType)"
          :is-highlighted="isCardHighlighted(conn)"
          @hover="onCardHover(conn.relationId, $event)"
          @click="navigateToEntity(conn.entityId)"
          @view="openViewDialog(connectionToEntity(conn), connectionToEntityType(conn))"
          @edit="openEditDialog(connectionToEntity(conn), connectionToEntityType(conn))"
        />
      </div>

      <!-- No Connections Message -->
      <div v-else class="chaos-no-connections">
        <p class="text-body-1 text-medium-emphasis">{{ $t('chaos.noConnections') }}</p>
        <p class="text-body-2 text-disabled">{{ $t('chaos.noConnectionsText') }}</p>
      </div>
    </div>

    <!-- View Dialogs -->
    <NpcViewDialog
      v-if="viewDialogTypeName === 'NPC'"
      :show="viewDialogOpen"
      :npc="viewingNpc"
      @update:show="viewDialogOpen = $event"
      @edit="openEditDialogFromNpc($event)"
    />

    <ItemViewDialog
      v-if="viewDialogTypeName === 'Item'"
      :model-value="viewDialogOpen"
      :item="viewingItem"
      @update:model-value="viewDialogOpen = $event"
    />

    <LocationViewDialog
      v-if="viewDialogTypeName === 'Location'"
      :model-value="viewDialogOpen"
      :location="viewingLocation"
      @update:model-value="viewDialogOpen = $event"
    />

    <FactionViewDialog
      v-if="viewDialogTypeName === 'Faction'"
      :model-value="viewDialogOpen"
      :faction="viewingFaction"
      @update:model-value="viewDialogOpen = $event"
      @edit="openEditDialogFromFaction"
    />

    <LoreViewDialog
      v-if="viewDialogTypeName === 'Lore'"
      :model-value="viewDialogOpen"
      :lore="viewingLore"
      :npcs="viewDialogNpcs"
      :items="viewDialogItems"
      :factions="viewDialogFactions"
      :locations="viewDialogLocations"
      :documents="viewDialogDocuments"
      :images="viewDialogImages"
      :counts="viewDialogCounts"
      :loading-npcs="loadingViewNpcs"
      :loading-items="loadingViewItems"
      :loading-factions="loadingViewFactions"
      :loading-locations="loadingViewLocations"
      @update:model-value="viewDialogOpen = $event"
      @edit="openEditDialogFromLore"
    />

    <!-- Edit Dialogs -->
    <NpcEditDialog
      v-if="editDialogTypeName === 'NPC'"
      :show="editDialogOpen"
      :npc-id="editingEntityId"
      @update:show="editDialogOpen = $event"
      @saved="handleEntitySaved"
      @created="handleEntityCreated"
    />

    <LocationEditDialog
      v-if="editDialogTypeName === 'Location'"
      :show="editDialogOpen"
      :location-id="editingEntityId"
      @update:show="editDialogOpen = $event"
      @saved="handleEntitySaved"
      @created="handleEntityCreated"
    />

    <ItemEditDialog
      v-if="editDialogTypeName === 'Item'"
      :show="editDialogOpen"
      :item-id="editingEntityId"
      @update:show="editDialogOpen = $event"
      @saved="handleEntitySaved"
      @created="handleEntityCreated"
    />

    <FactionEditDialog
      v-if="editDialogTypeName === 'Faction'"
      :show="editDialogOpen"
      :faction-id="editingEntityId"
      @update:show="editDialogOpen = $event"
      @saved="handleEntitySaved"
      @created="handleEntityCreated"
    />

    <LoreEditDialog
      v-if="editDialogTypeName === 'Lore'"
      :show="editDialogOpen"
      :lore-id="editingEntityId"
      @update:show="editDialogOpen = $event"
      @saved="handleEntitySaved"
      @created="handleEntityCreated"
    />

    <PlayerEditDialog
      v-if="editDialogTypeName === 'Player'"
      :show="editDialogOpen"
      :player-id="editingEntityId"
      @update:show="editDialogOpen = $event"
      @saved="handleEntitySaved"
      @created="handleEntityCreated"
    />
  </div>
</template>

<script setup lang="ts">
import NpcViewDialog from '~/components/npcs/NpcViewDialog.vue'
import NpcEditDialog from '~/components/npcs/NpcEditDialog.vue'
import ItemViewDialog from '~/components/items/ItemViewDialog.vue'
import ItemEditDialog from '~/components/items/ItemEditDialog.vue'
import LocationViewDialog from '~/components/locations/LocationViewDialog.vue'
import LocationEditDialog from '~/components/locations/LocationEditDialog.vue'
import FactionViewDialog from '~/components/factions/FactionViewDialog.vue'
import FactionEditDialog from '~/components/factions/FactionEditDialog.vue'
import LoreViewDialog from '~/components/lore/LoreViewDialog.vue'
import LoreEditDialog from '~/components/lore/LoreEditDialog.vue'
import PlayerEditDialog from '~/components/players/PlayerEditDialog.vue'
import type { NPC } from '~~/types/npc'
import type { Item } from '~~/types/item'
import type { Location } from '~~/types/location'
import type { Faction } from '~~/types/faction'
import type { Lore } from '~~/types/lore'

interface Entity {
  id: number
  name: string
  description: string | null
  image_url: string | null
  type_id: number
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface EntityType {
  id: number
  name: string
  icon: string
  color: string
}

interface Connection {
  relationId: number
  entityId: number
  entityName: string
  entityType: string
  entityTypeId: number
  entityIcon: string
  entityColor: string
  entityImageUrl: string | null
  relationType: string
  relationNotes: unknown
  direction: 'outgoing' | 'incoming'
}

interface InterConnection {
  relationId: number
  fromEntityId: number
  toEntityId: number
  relationType: string
}

interface ConnectionsResponse {
  connections: Connection[]
  interConnections: InterConnection[]
}

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()

const entity = ref<Entity | null>(null)
const entityType = ref<EntityType | null>(null)
const connections = ref<Connection[]>([])
const interConnections = ref<InterConnection[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const centerRef = ref<HTMLElement | null>(null)
const connectionRefs = ref<Map<number, HTMLElement>>(new Map())
const hoveredConnectionId = ref<number | null>(null)

// View Dialog state - simple refs like npcs/index.vue does it
const viewDialogOpen = ref(false)
const viewDialogTypeName = ref<string | null>(null)
const viewingNpc = ref<NPC | null>(null)
const viewingItem = ref<Item | null>(null)
const viewingLocation = ref<Location | null>(null)
const viewingFaction = ref<Faction | null>(null)
const viewingLore = ref<Lore | null>(null)

// Lore view dialog data
const viewDialogNpcs = ref<Array<{ id: number; name: string; description: string | null; image_url: string | null }>>([])
const viewDialogItems = ref<Array<{ id: number; name: string; description: string | null; image_url: string | null }>>([])
const viewDialogFactions = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const viewDialogLocations = ref<
  Array<{ id: number; name: string; description: string | null; image_url: string | null }>
>([])
const viewDialogDocuments = ref<Array<{ id: number; title: string; content: string }>>([])
const viewDialogImages = ref<Array<{ id: number; image_url: string; is_primary: boolean }>>([])
const viewDialogCounts = ref<{
  npcs: number
  items: number
  factions: number
  locations: number
  documents: number
  images: number
} | null>(null)
const loadingViewNpcs = ref(false)
const loadingViewItems = ref(false)
const loadingViewFactions = ref(false)
const loadingViewLocations = ref(false)

// Edit Dialog state
const editDialogOpen = ref(false)
const editDialogTypeName = ref<string | null>(null)
const editingEntityId = ref<number | null>(null)

interface ConnectionLine {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

interface InterConnectionLine {
  id: number
  fromEntityId: number
  toEntityId: number
  x1: number
  y1: number
  x2: number
  y2: number
}

const connectionLines = ref<ConnectionLine[]>([])
const interConnectionLines = ref<InterConnectionLine[]>([])

const hoveredLine = computed(() => {
  if (hoveredConnectionId.value === null) return null
  return connectionLines.value.find((line) => line.id === hoveredConnectionId.value) || null
})

// Get the entityId of the currently hovered connection
const hoveredEntityId = computed(() => {
  if (hoveredConnectionId.value === null) return null
  const conn = connections.value.find((c) => c.relationId === hoveredConnectionId.value)
  return conn?.entityId || null
})

// Get inter-connection lines that involve the hovered entity
const hoveredInterLines = computed(() => {
  if (hoveredEntityId.value === null) return []
  return interConnectionLines.value.filter(
    (line) => line.fromEntityId === hoveredEntityId.value || line.toEntityId === hoveredEntityId.value,
  )
})

// Check if an inter-connection line involves the hovered entity
function isInterLineHovered(interLine: InterConnectionLine): boolean {
  return hoveredEntityId.value !== null &&
    (interLine.fromEntityId === hoveredEntityId.value || interLine.toEntityId === hoveredEntityId.value)
}

// Get entity IDs that are connected to the hovered entity via inter-connections
const interConnectedEntityIds = computed(() => {
  if (hoveredEntityId.value === null) return new Set<number>()
  const ids = new Set<number>()
  hoveredInterLines.value.forEach((line) => {
    if (line.fromEntityId === hoveredEntityId.value) {
      ids.add(line.toEntityId)
    } else {
      ids.add(line.fromEntityId)
    }
  })
  return ids
})

// Check if a connection card should be highlighted (either directly hovered or inter-connected)
function isCardHighlighted(conn: Connection): boolean {
  if (hoveredConnectionId.value === conn.relationId) return true
  return interConnectedEntityIds.value.has(conn.entityId)
}

// Calculate intersection point of a line with a rectangle border (with padding)
function getLineRectIntersection(
  lineStartX: number,
  lineStartY: number,
  _lineEndX: number,
  _lineEndY: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
  padding: number = 4,
): { x: number; y: number } {
  // Add padding to create gap between line end and card border
  const rectLeft = rectX - padding
  const rectRight = rectX + rectWidth + padding
  const rectTop = rectY - padding
  const rectBottom = rectY + rectHeight + padding
  const rectCenterX = rectX + rectWidth / 2
  const rectCenterY = rectY + rectHeight / 2

  // Direction from rect center to line start
  const dx = lineStartX - rectCenterX
  const dy = lineStartY - rectCenterY

  if (dx === 0 && dy === 0) {
    return { x: rectCenterX, y: rectTop }
  }

  // Calculate intersection with each edge
  let t = Infinity

  // Top edge
  if (dy < 0) {
    const tTop = (rectTop - rectCenterY) / dy
    if (tTop > 0 && tTop < t) {
      const xAtTop = rectCenterX + tTop * dx
      if (xAtTop >= rectLeft && xAtTop <= rectRight) t = tTop
    }
  }
  // Bottom edge
  if (dy > 0) {
    const tBottom = (rectBottom - rectCenterY) / dy
    if (tBottom > 0 && tBottom < t) {
      const xAtBottom = rectCenterX + tBottom * dx
      if (xAtBottom >= rectLeft && xAtBottom <= rectRight) t = tBottom
    }
  }
  // Left edge
  if (dx < 0) {
    const tLeft = (rectLeft - rectCenterX) / dx
    if (tLeft > 0 && tLeft < t) {
      const yAtLeft = rectCenterY + tLeft * dy
      if (yAtLeft >= rectTop && yAtLeft <= rectBottom) t = tLeft
    }
  }
  // Right edge
  if (dx > 0) {
    const tRight = (rectRight - rectCenterX) / dx
    if (tRight > 0 && tRight < t) {
      const yAtRight = rectCenterY + tRight * dy
      if (yAtRight >= rectTop && yAtRight <= rectBottom) t = tRight
    }
  }

  if (t === Infinity) {
    return { x: rectCenterX, y: rectTop }
  }

  return {
    x: rectCenterX + t * dx,
    y: rectCenterY + t * dy,
  }
}

function setConnectionRef(index: number, el: unknown) {
  if (el && connections.value[index]) {
    const htmlEl = (el as { $el?: HTMLElement }).$el || (el as HTMLElement)
    connectionRefs.value.set(connections.value[index].relationId, htmlEl)
  }
}

function onCardHover(relationId: number, hoveredEntity: unknown) {
  hoveredConnectionId.value = hoveredEntity ? relationId : null
}

function updateLines() {
  if (!canvasRef.value || !centerRef.value || connections.value.length === 0) {
    connectionLines.value = []
    interConnectionLines.value = []
    return
  }

  const canvasRect = canvasRef.value.getBoundingClientRect()
  const centerCard = centerRef.value.querySelector('.chaos-entity-card')
  if (!centerCard) return

  const centerRect = centerCard.getBoundingClientRect()
  const centerX = centerRect.left + centerRect.width / 2 - canvasRect.left
  const centerY = centerRect.top + centerRect.height / 2 - canvasRect.top

  // Center card rect for intersection calculation
  const centerRectRel = {
    x: centerRect.left - canvasRect.left,
    y: centerRect.top - canvasRect.top,
    width: centerRect.width,
    height: centerRect.height,
  }

  const lines: ConnectionLine[] = []

  // Build a map of entityId -> card rect (relative to canvas)
  const entityRects = new Map<number, { x: number; y: number; width: number; height: number }>()

  connections.value.forEach((conn) => {
    const cardEl = connectionRefs.value.get(conn.relationId)
    if (!cardEl) return

    const cardRect = cardEl.getBoundingClientRect()
    const relRect = {
      x: cardRect.left - canvasRect.left,
      y: cardRect.top - canvasRect.top,
      width: cardRect.width,
      height: cardRect.height,
    }

    // Store rect for inter-connections
    entityRects.set(conn.entityId, relRect)

    const cardCenterX = relRect.x + relRect.width / 2
    const cardCenterY = relRect.y + relRect.height / 2

    // Calculate intersection points at card borders
    const centerIntersect = getLineRectIntersection(
      cardCenterX, cardCenterY, centerX, centerY,
      centerRectRel.x, centerRectRel.y, centerRectRel.width, centerRectRel.height,
    )
    const cardIntersect = getLineRectIntersection(
      centerX, centerY, cardCenterX, cardCenterY,
      relRect.x, relRect.y, relRect.width, relRect.height,
    )

    lines.push({
      id: conn.relationId,
      x1: centerIntersect.x,
      y1: centerIntersect.y,
      x2: cardIntersect.x,
      y2: cardIntersect.y,
      color: conn.entityColor,
    })
  })

  connectionLines.value = lines

  // Calculate inter-connection lines
  const interLines: InterConnectionLine[] = []

  interConnections.value.forEach((ic) => {
    const fromRect = entityRects.get(ic.fromEntityId)
    const toRect = entityRects.get(ic.toEntityId)

    if (fromRect && toRect) {
      const fromCenterX = fromRect.x + fromRect.width / 2
      const fromCenterY = fromRect.y + fromRect.height / 2
      const toCenterX = toRect.x + toRect.width / 2
      const toCenterY = toRect.y + toRect.height / 2

      // Calculate intersection points at card borders
      const fromIntersect = getLineRectIntersection(
        toCenterX, toCenterY, fromCenterX, fromCenterY,
        fromRect.x, fromRect.y, fromRect.width, fromRect.height,
      )
      const toIntersect = getLineRectIntersection(
        fromCenterX, fromCenterY, toCenterX, toCenterY,
        toRect.x, toRect.y, toRect.width, toRect.height,
      )

      interLines.push({
        id: ic.relationId,
        fromEntityId: ic.fromEntityId,
        toEntityId: ic.toEntityId,
        x1: fromIntersect.x,
        y1: fromIntersect.y,
        x2: toIntersect.x,
        y2: toIntersect.y,
      })
    }
  })

  interConnectionLines.value = interLines
}

// Load entity on mount
onMounted(async () => {
  await loadEntity()
  // Wait for DOM to render, then calculate lines
  await nextTick()
  setTimeout(updateLines, 100)

  // Update lines on resize
  if (canvasRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      updateLines()
    })
    resizeObserver.observe(canvasRef.value)
    onUnmounted(() => resizeObserver.disconnect())
  }
})

async function loadEntity() {
  loading.value = true
  error.value = null

  try {
    const id = Number(route.params.id)

    if (isNaN(id)) {
      error.value = 'Invalid entity ID'
      return
    }

    // Fetch entity and connections in parallel
    const [entityData, connectionsData] = await Promise.all([
      $fetch<{ entity: Entity; type: EntityType }>(`/api/entities/${id}`),
      $fetch<ConnectionsResponse>(`/api/entities/${id}/connections`),
    ])

    entity.value = entityData.entity
    entityType.value = entityData.type
    connections.value = connectionsData.connections
    interConnections.value = connectionsData.interConnections
  } catch (e) {
    console.error('[ChaosGraph] Failed to load entity:', e)
    error.value = 'Failed to load entity'
  } finally {
    loading.value = false
  }
}

// Convert connection to entity format for ChaosEntityCard
function connectionToEntity(conn: Connection): Entity {
  return {
    id: conn.entityId,
    name: conn.entityName,
    description: null,
    image_url: conn.entityImageUrl,
    type_id: conn.entityTypeId,
    metadata: null,
    created_at: '',
    updated_at: '',
  }
}

// Convert connection to entity type format for ChaosEntityCard
function connectionToEntityType(conn: Connection): EntityType {
  return {
    id: conn.entityTypeId,
    name: conn.entityType,
    icon: conn.entityIcon,
    color: conn.entityColor,
  }
}

// Navigate to another entity's chaos graph
function navigateToEntity(entityId: number) {
  router.push(`/chaos/${entityId}`)
}

function goBack() {
  router.back()
}

// Open view dialog - fetch full entity data from API
async function openViewDialog(ent: Entity, entType: EntityType) {
  const typeRoutes: Record<string, string> = {
    NPC: 'npcs',
    Item: 'items',
    Location: 'locations',
    Faction: 'factions',
    Lore: 'lore',
    Player: 'players',
  }

  const apiRoute = typeRoutes[entType.name]
  if (!apiRoute) {
    // Unsupported type - navigate to page instead
    router.push(`/${entType.name.toLowerCase()}/${ent.id}`)
    return
  }

  // Player has no ViewDialog - open EditDialog directly
  if (entType.name === 'Player') {
    editingEntityId.value = ent.id
    editDialogTypeName.value = 'Player'
    editDialogOpen.value = true
    return
  }

  try {
    const data = await $fetch(`/api/${apiRoute}/${ent.id}`)

    // Set the correct ref based on type
    viewingNpc.value = null
    viewingItem.value = null
    viewingLocation.value = null
    viewingFaction.value = null
    viewingLore.value = null

    switch (entType.name) {
    case 'NPC':
      viewingNpc.value = data as NPC
      break
    case 'Item':
      viewingItem.value = data as Item
      break
    case 'Location':
      viewingLocation.value = data as Location
      break
    case 'Faction':
      viewingFaction.value = data as Faction
      break
    case 'Lore':
      viewingLore.value = data as Lore
      // Load additional data for Lore view dialog
      loadLoreViewData(ent.id)
      break
    }

    viewDialogTypeName.value = entType.name
    viewDialogOpen.value = true
  } catch (e) {
    console.error('[ChaosGraph] Failed to load entity for view:', e)
  }
}

// Open edit dialog for supported entity types, navigate for others
function openEditDialog(ent: Entity, entType: EntityType) {
  // Types with integrated edit dialogs
  const supportedTypes = ['NPC', 'Location', 'Item', 'Faction', 'Lore', 'Player']

  if (supportedTypes.includes(entType.name)) {
    editingEntityId.value = ent.id
    editDialogTypeName.value = entType.name
    editDialogOpen.value = true
  } else {
    // Fallback: navigate to list page with edit query
    const typeRoutes: Record<string, string> = {
      Player: 'players',
    }
    const routePath = typeRoutes[entType.name] || 'npcs'
    router.push({ path: `/${routePath}`, query: { edit: ent.id } })
  }
}

// Helper for NpcViewDialog edit event (receives NPC directly, not Connection)
function openEditDialogFromNpc(npc: NPC) {
  editingEntityId.value = npc.id
  editDialogTypeName.value = 'NPC'
  editDialogOpen.value = true
  viewDialogOpen.value = false
}

// Helper for FactionViewDialog edit event (receives Faction directly, not Connection)
function openEditDialogFromFaction(faction: Faction) {
  editingEntityId.value = faction.id
  editDialogTypeName.value = 'Faction'
  editDialogOpen.value = true
  viewDialogOpen.value = false
}

// Helper for LoreViewDialog edit event (receives Lore directly, not Connection)
function openEditDialogFromLore(lore: Lore) {
  editingEntityId.value = lore.id
  editDialogTypeName.value = 'Lore'
  editDialogOpen.value = true
  viewDialogOpen.value = false
}

// Load additional data for Lore view dialog
async function loadLoreViewData(loreId: number) {
  loadingViewNpcs.value = true
  loadingViewItems.value = true
  loadingViewFactions.value = true
  loadingViewLocations.value = true

  try {
    const [npcs, items, factions, locations, documents, images, counts] = await Promise.all([
      $fetch<typeof viewDialogNpcs.value>(`/api/entities/${loreId}/related/npcs`).catch(() => []),
      $fetch<typeof viewDialogItems.value>(`/api/entities/${loreId}/related/items`).catch(() => []),
      $fetch<typeof viewDialogFactions.value>(`/api/entities/${loreId}/related/factions`).catch(() => []),
      $fetch<typeof viewDialogLocations.value>(`/api/entities/${loreId}/related/locations`).catch(() => []),
      $fetch<typeof viewDialogDocuments.value>(`/api/entities/${loreId}/documents`).catch(() => []),
      $fetch<typeof viewDialogImages.value>(`/api/entity-images/${loreId}`).catch(() => []),
      $fetch<typeof viewDialogCounts.value>(`/api/lore/${loreId}/counts`).catch(() => null),
    ])

    viewDialogNpcs.value = npcs
    viewDialogItems.value = items
    viewDialogFactions.value = factions
    viewDialogLocations.value = locations
    viewDialogDocuments.value = documents
    viewDialogImages.value = images
    viewDialogCounts.value = counts
  } catch (error) {
    console.error('[ChaosGraph] Failed to load lore view data:', error)
  } finally {
    loadingViewNpcs.value = false
    loadingViewItems.value = false
    loadingViewFactions.value = false
    loadingViewLocations.value = false
  }
}

// Handle entity saved/created - reload connections
async function handleEntitySaved() {
  await loadEntity()
  await nextTick()
  setTimeout(updateLines, 100)
}

async function handleEntityCreated() {
  await loadEntity()
  await nextTick()
  setTimeout(updateLines, 100)
}

// Translate relation type by checking if translation exists first (avoids i18n warnings)
function translateRelationType(relationType: string): string {
  const keyPatterns = [
    `npcs.npcRelationTypes.${relationType}`,
    `npcs.relationTypes.${relationType}`,
    `npcs.itemRelationTypes.${relationType}`,
    `factions.relationTypes.${relationType}`,
    `items.relationTypes.${relationType}`,
    `items.ownerRelationTypes.${relationType}`,
    `locations.relationTypes.${relationType}`,
    `lore.relationTypes.${relationType}`,
    `players.relationTypes.${relationType}`,
  ]

  // Use te() to check if key exists before calling t() - avoids console warnings
  for (const key of keyPatterns) {
    if (te(key)) {
      return t(key)
    }
  }

  // Fallback: return original value (user-entered text, already in correct language)
  return relationType
}
</script>

<style scoped>
.chaos-graph-container {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px);
  background: rgb(var(--v-theme-background));
}

.chaos-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex-shrink: 0;
}

.chaos-title {
  display: flex;
  flex-direction: column;
}

.chaos-loading,
.chaos-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.chaos-canvas {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  position: relative;
}

.chaos-center-section {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgb(var(--v-theme-background));
  padding: 16px 0;
}

.chaos-connections-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px 32px; /* vertical horizontal */
  justify-content: center;
  position: relative;
  /* No z-index here - let cards manage their own stacking */
}

.chaos-no-connections {
  text-align: center;
  padding: 48px 24px;
}

.chaos-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.chaos-lines--back {
  z-index: 1; /* Below all cards */
}

.chaos-lines--front {
  z-index: 25; /* Above everything including highlighted cards */
}

.chaos-line {
  transition: stroke-opacity 0.2s ease;
}

.chaos-line--inter {
  stroke: rgb(var(--v-theme-primary));
}
</style>
