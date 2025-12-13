<template>
  <v-dialog v-model="dialogVisible" max-width="800" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-export</v-icon>
        {{ $t('campaigns.export.title') }}
      </v-card-title>

      <v-card-text>
        <!-- Export Mode Toggle -->
        <v-btn-toggle v-model="exportMode" mandatory class="mb-4" color="primary">
          <v-btn value="full" variant="outlined">
            <v-icon start>mdi-package-variant</v-icon>
            {{ $t('campaigns.export.fullExport') }}
          </v-btn>
          <v-btn value="partial" variant="outlined">
            <v-icon start>mdi-selection-multiple</v-icon>
            {{ $t('campaigns.export.partialExport') }}
          </v-btn>
        </v-btn-toggle>

        <!-- Full Export Info -->
        <v-alert v-if="exportMode === 'full'" type="info" variant="tonal" class="mb-4">
          <div class="font-weight-medium">{{ $t('campaigns.export.fullExportInfo') }}</div>
          <div class="text-body-2 mt-1">
            {{ $t('campaigns.export.fullExportDetails', {
              entities: entityStats.total,
              sessions: sessionCount,
              maps: mapCount
            }) }}
          </div>
        </v-alert>

        <!-- Partial Export Selection -->
        <div v-if="exportMode === 'partial'">
          <v-alert type="info" variant="tonal" class="mb-4" density="compact">
            {{ $t('campaigns.export.partialExportInfo') }}
          </v-alert>

          <!-- Loading State -->
          <div v-if="loading" class="d-flex justify-center py-8">
            <v-progress-circular indeterminate />
          </div>

          <!-- Entity Selection -->
          <div v-else>
            <!-- Quick Stats -->
            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip
                v-for="(count, type) in entityStats.byType"
                :key="type"
                :color="selectedByType[type]?.length ? 'primary' : 'default'"
                variant="tonal"
                size="small"
              >
                {{ $t(`entityTypes.${type}`) }}: {{ selectedByType[type]?.length || 0 }}/{{ count }}
              </v-chip>
            </div>

            <!-- Entity Type Groups -->
            <v-expansion-panels v-model="expandedPanel" variant="accordion">
              <v-expansion-panel
                v-for="(entities, type) in groupedEntities"
                :key="type"
                :value="type"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center flex-grow-1">
                    <v-icon :icon="getEntityIcon(type)" class="mr-2" size="small" />
                    <span>{{ $t(`entityTypes.${type}`) }}</span>
                    <v-chip size="x-small" class="ml-2" variant="tonal">
                      {{ selectedByType[type]?.length || 0 }}/{{ entities.length }}
                    </v-chip>
                    <v-spacer />
                    <v-btn
                      variant="text"
                      size="x-small"
                      @click.stop="toggleAllOfType(type)"
                    >
                      {{ isAllSelected(type) ? $t('common.deselectAll') : $t('common.selectAll') }}
                    </v-btn>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list density="compact" class="py-0">
                    <v-list-item
                      v-for="entity in entities"
                      :key="entity.id"
                      :class="{ 'bg-primary-lighten-5': selectedIds.has(entity.id) }"
                      @click="toggleEntity(entity)"
                    >
                      <template #prepend>
                        <v-checkbox-btn
                          :model-value="selectedIds.has(entity.id)"
                          density="compact"
                          @click.stop
                          @update:model-value="toggleEntity(entity)"
                        />
                      </template>
                      <v-list-item-title>{{ entity.name }}</v-list-item-title>

                      <!-- Linked Entities -->
                      <template v-if="entity.linkedEntities?.length && selectedIds.has(entity.id)">
                        <div class="d-flex flex-wrap ga-1 mt-1">
                          <v-chip
                            v-for="linked in entity.linkedEntities"
                            :key="linked.id"
                            size="x-small"
                            :color="selectedIds.has(linked.id) ? 'success' : 'default'"
                            :variant="selectedIds.has(linked.id) ? 'flat' : 'outlined'"
                            @click.stop="addLinkedEntity(linked)"
                          >
                            <v-icon start size="x-small">{{ getEntityIcon(linked.type) }}</v-icon>
                            {{ linked.name }}
                            <v-icon v-if="!selectedIds.has(linked.id)" end size="x-small">mdi-plus</v-icon>
                          </v-chip>
                        </div>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Selection Summary -->
            <v-alert
              v-if="selectedIds.size > 0"
              type="success"
              variant="tonal"
              class="mt-4"
              density="compact"
            >
              {{ $t('campaigns.export.selectedCount', { count: selectedIds.size }) }}
            </v-alert>
          </div>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="exporting"
          :disabled="exportMode === 'partial' && selectedIds.size === 0"
          @click="doExport"
        >
          <v-icon start>mdi-download</v-icon>
          {{ $t('campaigns.export.download') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface EntityWithLinks {
  id: number
  name: string
  type: string
  type_id: number
  linkedEntities?: Array<{
    id: number
    name: string
    type: string
  }>
}

interface Props {
  modelValue: boolean
  campaignId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const campaignStore = useCampaignStore()

// Get campaign name from store
const campaignName = computed(() => campaignStore.currentCampaign?.name || 'campaign')

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const exportMode = ref<'full' | 'partial'>('full')
const loading = ref(false)
const exporting = ref(false)
const expandedPanel = ref<string | null>(null)

const allEntities = ref<EntityWithLinks[]>([])
const selectedIds = ref<Set<number>>(new Set())
const sessionCount = ref(0)
const mapCount = ref(0)

// Group entities by type
const groupedEntities = computed(() => {
  const groups: Record<string, EntityWithLinks[]> = {}
  for (const entity of allEntities.value) {
    if (!groups[entity.type]) {
      groups[entity.type] = []
    }
    groups[entity.type]!.push(entity)
  }
  return groups
})

// Selected entities by type
const selectedByType = computed(() => {
  const byType: Record<string, number[]> = {}
  for (const entity of allEntities.value) {
    if (!byType[entity.type]) {
      byType[entity.type] = []
    }
    if (selectedIds.value.has(entity.id)) {
      byType[entity.type]!.push(entity.id)
    }
  }
  return byType
})

// Entity stats
const entityStats = computed(() => {
  const byType: Record<string, number> = {}
  for (const entity of allEntities.value) {
    byType[entity.type] = (byType[entity.type] || 0) + 1
  }
  return {
    total: allEntities.value.length,
    byType,
  }
})

// Entity type icons
function getEntityIcon(type: string): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Location: 'mdi-map-marker',
    Item: 'mdi-sword',
    Faction: 'mdi-shield-account',
    Lore: 'mdi-book-open-page-variant',
    Player: 'mdi-account-group',
  }
  return icons[type] || 'mdi-help'
}

// Check if all entities of a type are selected
function isAllSelected(type: string): boolean {
  const entities = groupedEntities.value[type] || []
  return entities.length > 0 && entities.every((e) => selectedIds.value.has(e.id))
}

// Toggle all entities of a type
function toggleAllOfType(type: string) {
  const entities = groupedEntities.value[type] || []
  const allSelected = isAllSelected(type)

  if (allSelected) {
    for (const entity of entities) {
      selectedIds.value.delete(entity.id)
    }
  } else {
    for (const entity of entities) {
      selectedIds.value.add(entity.id)
    }
  }
  // Trigger reactivity
  selectedIds.value = new Set(selectedIds.value)
}

// Toggle single entity
function toggleEntity(entity: EntityWithLinks) {
  if (selectedIds.value.has(entity.id)) {
    selectedIds.value.delete(entity.id)
  } else {
    selectedIds.value.add(entity.id)
  }
  // Trigger reactivity
  selectedIds.value = new Set(selectedIds.value)
}

// Add linked entity to selection
function addLinkedEntity(linked: { id: number; name: string; type: string }) {
  if (!selectedIds.value.has(linked.id)) {
    selectedIds.value.add(linked.id)
    selectedIds.value = new Set(selectedIds.value)
  }
}

// Fetch entities with their relations
async function fetchEntities() {
  if (!props.campaignId) return

  loading.value = true
  try {
    // Fetch all entities with relations
    const response = await $fetch<{
      entities: EntityWithLinks[]
      sessionCount: number
      mapCount: number
    }>(`/api/campaigns/${props.campaignId}/export-preview`)

    allEntities.value = response.entities
    sessionCount.value = response.sessionCount
    mapCount.value = response.mapCount
  } catch (error) {
    console.error('Failed to fetch entities:', error)
  } finally {
    loading.value = false
  }
}

// Electron integration
const { saveFile } = useElectron()

// Perform export
async function doExport() {
  exporting.value = true
  try {
    const response = await $fetch(`/api/campaigns/${props.campaignId}/export`, {
      method: 'POST',
      body: {
        mode: exportMode.value,
        entityIds: exportMode.value === 'partial' ? Array.from(selectedIds.value) : undefined,
      },
      responseType: 'blob',
    })

    const blob = response as unknown as Blob
    const safeName = campaignName.value.replace(/[^a-zA-Z0-9-_]/g, '-')
    const fileName = `${safeName}.dmhero`

    // Use saveFile helper (handles both Electron and browser)
    const result = await saveFile(blob, fileName)
    if (!result.success && result.error) {
      console.error('Export failed:', result.error)
    }

    close()
  } catch (error) {
    console.error('Export failed:', error)
  } finally {
    exporting.value = false
  }
}

function close() {
  dialogVisible.value = false
  exportMode.value = 'full'
  selectedIds.value = new Set()
  expandedPanel.value = null
}

// Watch for dialog open
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      fetchEntities()
    }
  },
)
</script>

<style scoped>
.bg-primary-lighten-5 {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
