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
      </svg>

      <!-- SVG Highlighted Line Layer (above cards) -->
      <svg v-if="hoveredConnectionId !== null && hoveredLine" class="chaos-lines chaos-lines--front">
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
      </svg>

      <!-- Center Entity Card (sticky at top) -->
      <div ref="centerRef" class="chaos-center-section">
        <ChaosEntityCard
          :entity="entity"
          :entity-type="entityType"
          :is-center="true"
          :is-highlighted="hoveredConnectionId !== null"
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
          :is-highlighted="hoveredConnectionId === conn.relationId"
          @hover="onCardHover(conn.relationId, $event)"
          @click="navigateToEntity(conn.entityId)"
        />
      </div>

      <!-- No Connections Message -->
      <div v-else class="chaos-no-connections">
        <p class="text-body-1 text-medium-emphasis">{{ $t('chaos.noConnections') }}</p>
        <p class="text-body-2 text-disabled">{{ $t('chaos.noConnectionsText') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const entity = ref<Entity | null>(null)
const entityType = ref<EntityType | null>(null)
const connections = ref<Connection[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
const centerRef = ref<HTMLElement | null>(null)
const connectionRefs = ref<Map<number, HTMLElement>>(new Map())
const hoveredConnectionId = ref<number | null>(null)

interface ConnectionLine {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

const connectionLines = ref<ConnectionLine[]>([])

const hoveredLine = computed(() => {
  if (hoveredConnectionId.value === null) return null
  return connectionLines.value.find((line) => line.id === hoveredConnectionId.value) || null
})

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
    return
  }

  const canvasRect = canvasRef.value.getBoundingClientRect()
  const centerCard = centerRef.value.querySelector('.chaos-entity-card')
  if (!centerCard) return

  const centerRect = centerCard.getBoundingClientRect()
  const centerX = centerRect.left + centerRect.width / 2 - canvasRect.left
  const centerY = centerRect.bottom - canvasRect.top

  const lines: ConnectionLine[] = []

  connections.value.forEach((conn) => {
    const cardEl = connectionRefs.value.get(conn.relationId)
    if (!cardEl) return

    const cardRect = cardEl.getBoundingClientRect()
    const cardX = cardRect.left + cardRect.width / 2 - canvasRect.left
    const cardY = cardRect.top - canvasRect.top

    lines.push({
      id: conn.relationId,
      x1: centerX,
      y1: centerY,
      x2: cardX,
      y2: cardY,
      color: conn.entityColor,
    })
  })

  connectionLines.value = lines
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
      $fetch<Connection[]>(`/api/entities/${id}/connections`),
    ])

    entity.value = entityData.entity
    entityType.value = entityData.type
    connections.value = connectionsData
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

// Translate relation type by trying multiple translation key patterns
function translateRelationType(relationType: string): string {
  // Try different translation key patterns
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

  for (const key of keyPatterns) {
    const translated = t(key)
    // If translation found (not equal to key), return it
    if (translated !== key) {
      return translated
    }
  }

  // Fallback: return original value (might already be translated in DB)
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
  z-index: 1; /* Below cards */
}

.chaos-lines--front {
  z-index: 15; /* Above cards - only for highlighted line */
}

.chaos-line {
  transition: stroke-opacity 0.2s ease;
}
</style>
