<template>
  <v-dialog v-model="dialogVisible" max-width="800" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-content-copy</v-icon>
        {{ $t('entities.copyToCampaign.title') }}
      </v-card-title>

      <v-card-text>
        <!-- Target Campaign Selection -->
        <v-select
          v-model="targetCampaignId"
          :items="availableCampaigns"
          item-title="name"
          item-value="id"
          :label="$t('entities.copyToCampaign.targetCampaign')"
          :loading="loadingCampaigns"
          :disabled="copying"
          variant="outlined"
          class="mb-4"
        >
          <template #item="{ props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <v-icon>mdi-book-open-variant</v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>

        <!-- Entity Selection (like Export Dialog) -->
        <v-alert type="info" variant="tonal" class="mb-4" density="compact">
          {{ $t('entities.copyToCampaign.selectEntities') }}
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
            {{ $t('entities.copyToCampaign.selectedCount', { count: selectedIds.size }) }}
          </v-alert>
        </div>

        <!-- Duplicate Warning -->
        <v-alert
          v-if="duplicates.length > 0"
          type="warning"
          variant="tonal"
          class="mt-4"
        >
          <div class="font-weight-medium mb-2">
            {{ $t('entities.copyToCampaign.duplicatesFound', { count: duplicates.length }) }}
          </div>

          <!-- Duplicate List -->
          <v-list density="compact" class="bg-transparent py-0" max-height="150" style="overflow-y: auto">
            <v-list-item
              v-for="dup in duplicates"
              :key="dup.id"
              density="compact"
              class="px-0"
            >
              <template #prepend>
                <v-icon size="small" class="mr-2">{{ getEntityIcon(dup.type_name) }}</v-icon>
              </template>
              <v-list-item-title class="text-body-2">{{ dup.name }}</v-list-item-title>
            </v-list-item>
          </v-list>

          <!-- Mode Selection -->
          <div class="mt-3">
            <div class="text-body-2 mb-2">{{ $t('entities.copyToCampaign.howToHandle') }}</div>
            <v-btn-toggle v-model="copyMode" mandatory color="primary" density="compact">
              <v-btn value="skip" size="small">
                <v-icon start size="small">mdi-skip-next</v-icon>
                {{ $t('entities.copyToCampaign.modeSkip') }}
              </v-btn>
              <v-btn value="update" size="small">
                <v-icon start size="small">mdi-update</v-icon>
                {{ $t('entities.copyToCampaign.modeUpdate') }}
              </v-btn>
              <v-btn value="duplicate" size="small">
                <v-icon start size="small">mdi-content-duplicate</v-icon>
                {{ $t('entities.copyToCampaign.modeDuplicate') }}
              </v-btn>
            </v-btn-toggle>
          </div>
        </v-alert>

        <!-- Success Result -->
        <v-alert
          v-if="copyResult && copyResult.success && !copyResult.requiresConfirmation"
          type="success"
          variant="tonal"
          class="mt-4"
        >
          <div class="font-weight-medium">{{ $t('entities.copyToCampaign.success') }}</div>
          <div class="text-body-2 mt-1">
            {{ $t('entities.copyToCampaign.successDetails', {
              copied: copyResult.stats.entitiesCopied,
              skipped: copyResult.stats.entitiesSkipped,
              updated: copyResult.stats.entitiesUpdated
            }) }}
          </div>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="copying" @click="close">
          {{ copyResult?.success && !copyResult.requiresConfirmation ? $t('common.close') : $t('common.cancel') }}
        </v-btn>
        <v-btn
          v-if="!copyResult?.success || copyResult.requiresConfirmation"
          color="primary"
          variant="flat"
          :loading="copying"
          :disabled="!targetCampaignId || selectedIds.size === 0"
          @click="doCopy"
        >
          <v-icon start>mdi-content-copy</v-icon>
          {{ $t('entities.copyToCampaign.copy') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useSnackbarStore } from '~/stores/snackbar'

interface Campaign {
  id: number
  name: string
}

interface LinkedEntity {
  id: number
  name: string
  type: string
}

interface EntityWithType {
  id: number
  name: string
  type: string
  type_id: number
  linkedEntities?: LinkedEntity[]
}

interface Duplicate {
  id: number
  source_entity_id: number
  name: string
  type_name: string
}

interface CopyResult {
  success: boolean
  stats: {
    entitiesCopied: number
    entitiesSkipped: number
    entitiesUpdated: number
    relationsCopied: number
    documentsCopied: number
    imagesCopied: number
  }
  duplicates?: Duplicate[]
  requiresConfirmation?: boolean
}

interface Props {
  modelValue: boolean
  currentCampaignId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  copied: [result: CopyResult]
}>()

const snackbarStore = useSnackbarStore()
const { t } = useI18n()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const loading = ref(false)
const loadingCampaigns = ref(false)
const copying = ref(false)
const allCampaigns = ref<Campaign[]>([])
const allEntities = ref<EntityWithType[]>([])
const targetCampaignId = ref<number | null>(null)
const copyMode = ref<'skip' | 'update' | 'duplicate'>('skip')
const duplicates = ref<Duplicate[]>([])
const copyResult = ref<CopyResult | null>(null)
const selectedIds = ref<Set<number>>(new Set())
const expandedPanel = ref<string | null>(null)

// Filter out current campaign
const availableCampaigns = computed(() =>
  allCampaigns.value.filter((c) => c.id !== props.currentCampaignId),
)

// Group entities by type
const groupedEntities = computed(() => {
  const groups: Record<string, EntityWithType[]> = {}
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
  selectedIds.value = new Set(selectedIds.value)
}

// Toggle single entity
function toggleEntity(entity: EntityWithType) {
  if (selectedIds.value.has(entity.id)) {
    selectedIds.value.delete(entity.id)
  } else {
    selectedIds.value.add(entity.id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

// Add linked entity to selection
function addLinkedEntity(linked: LinkedEntity) {
  if (!selectedIds.value.has(linked.id)) {
    selectedIds.value.add(linked.id)
    selectedIds.value = new Set(selectedIds.value)
  }
}

// Fetch campaigns
async function fetchCampaigns() {
  loadingCampaigns.value = true
  try {
    const response = await $fetch<Campaign[]>('/api/campaigns')
    allCampaigns.value = response
  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
  } finally {
    loadingCampaigns.value = false
  }
}

// Fetch entities (reuse export-preview endpoint)
async function fetchEntities() {
  if (!props.currentCampaignId) return

  loading.value = true
  try {
    const response = await $fetch<{
      entities: EntityWithType[]
    }>(`/api/campaigns/${props.currentCampaignId}/export-preview`)

    allEntities.value = response.entities
  } catch (error) {
    console.error('Failed to fetch entities:', error)
  } finally {
    loading.value = false
  }
}

// Perform copy
async function doCopy() {
  if (!targetCampaignId.value || selectedIds.value.size === 0) return

  copying.value = true
  try {
    const result = await $fetch<CopyResult>('/api/entities/copy-to-campaign', {
      method: 'POST',
      body: {
        entityIds: Array.from(selectedIds.value),
        targetCampaignId: targetCampaignId.value,
        mode: copyMode.value,
      },
    })

    copyResult.value = result

    if (result.requiresConfirmation && result.duplicates) {
      duplicates.value = result.duplicates
    } else if (result.success) {
      emit('copied', result)
      snackbarStore.success(
        t('entities.copyToCampaign.successMessage', { count: result.stats.entitiesCopied }),
      )
    }
  } catch (error) {
    console.error('Copy failed:', error)
    snackbarStore.error(t('entities.copyToCampaign.error'))
  } finally {
    copying.value = false
  }
}

function close() {
  dialogVisible.value = false
  targetCampaignId.value = null
  copyMode.value = 'skip'
  duplicates.value = []
  copyResult.value = null
  selectedIds.value = new Set()
  expandedPanel.value = null
}

// Watch for dialog open
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      fetchCampaigns()
      fetchEntities()
      duplicates.value = []
      copyResult.value = null
      selectedIds.value = new Set()
    }
  },
)
</script>

<style scoped>
.bg-primary-lighten-5 {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
