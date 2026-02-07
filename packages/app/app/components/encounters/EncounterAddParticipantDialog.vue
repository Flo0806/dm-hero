<template>
  <v-dialog v-model="internalShow" max-width="500" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-account-plus</v-icon>
        {{ $t('encounters.addParticipants') }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </v-card-title>

      <v-divider />

      <v-card-text>
        <div class="d-flex ga-2 mb-3">
          <v-select
            v-model="selectedType"
            :items="entityTypes"
            :label="$t('encounters.selectType')"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 180px;"
          />
          <v-text-field
            v-model="searchQuery"
            :placeholder="$t('common.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            hide-details
          />
        </div>

        <div v-if="loading" class="text-center py-6">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <v-list v-else-if="entities.length > 0" density="compact" style="max-height: 350px; overflow-y: auto;">
          <v-list-item
            v-for="entity in entities"
            :key="entity.id"
          >
            <template #prepend>
              <v-avatar :color="selectedType === 'Player' ? 'cyan-lighten-4' : 'blue-lighten-4'" size="36">
                <v-img v-if="entity.image_url" :src="`/uploads/${entity.image_url}`" />
                <v-icon v-else size="20">{{ selectedType === 'Player' ? 'mdi-account-star' : 'mdi-account' }}</v-icon>
              </v-avatar>
            </template>

            <v-list-item-title>{{ entity.name }}</v-list-item-title>

            <v-list-item-subtitle v-if="entity.resources.length > 0">
              <!-- Auto-detected HP indicator -->
              <span v-if="entity.autoHpField" class="text-success">
                <v-icon size="12" color="success">mdi-check-circle</v-icon>
                {{ $t('encounters.hp') }}: {{ getResource(entity, entity.autoHpField)?.current }}/{{ getResource(entity, entity.autoHpField)?.max }}
              </span>
              <span v-else class="text-warning">
                <v-icon size="12" color="warning">mdi-alert</v-icon>
                {{ $t('encounters.noHpDetected') }}
              </span>
            </v-list-item-subtitle>
            <v-list-item-subtitle v-else>
              <span class="text-error">
                <v-icon size="12" color="error">mdi-alert-circle</v-icon>
                {{ $t('encounters.noResources') }}
              </span>
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex align-center ga-1">
                <!-- Initiative input during combat -->
                <v-text-field
                  v-if="requireInitiative"
                  v-model.number="initiativeInputs[entity.id]"
                  type="number"
                  density="comfortable"
                  variant="outlined"
                  hide-details
                  :label="$t('encounters.initiative')"
                  style="width: 100px; font-size: 18px; font-weight: 700;"
                  @keydown.enter="onAddClick(entity)"
                />

                <!-- Resource picker if multiple -->
                <v-menu v-if="entity.resources.length > 1">
                  <template #activator="{ props: menuProps }">
                    <v-btn icon="mdi-heart-cog" size="x-small" variant="text" v-bind="menuProps" :title="$t('encounters.selectHpResource')" />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      v-for="r in entity.resources"
                      :key="r.name"
                      @click="addWithResource(entity, r.name)"
                    >
                      <v-list-item-title>{{ translateLabel(r.label) }} ({{ r.current }}/{{ r.max }})</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>

                <v-btn
                  icon="mdi-plus"
                  size="small"
                  color="primary"
                  variant="text"
                  :disabled="requireInitiative && initiativeInputs[entity.id] == null"
                  @click="onAddClick(entity)"
                />
              </div>
            </template>
          </v-list-item>
        </v-list>

        <div v-else class="text-center py-6 text-medium-emphasis">
          <div>{{ $t('common.noResults') }}</div>
          <div class="text-body-2 mt-1">{{ $t('encounters.onlyWithStats') }}</div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { EncounterParticipant } from '~~/types/encounter'

const { t } = useI18n()
const campaignStore = useCampaignStore()
const encounterStore = useEncounterStore()
const snackbarStore = useSnackbarStore()

interface ResourceField {
  name: string
  label: string
  current: number
  max: number
}

interface EncounterEntity {
  id: number
  name: string
  image_url?: string | null
  type_name: string
  resources: ResourceField[]
  autoHpField: string | null
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  encounterId: number
  existingParticipants?: EncounterParticipant[]
  requireInitiative?: boolean
}>(), {
  existingParticipants: () => [],
  requireInitiative: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const entityTypes = [
  { title: t('npcs.title'), value: 'NPC' },
  { title: t('players.title'), value: 'Player' },
]

const selectedType = ref('NPC')
const searchQuery = ref('')
const loading = ref(false)
const entities = ref<EncounterEntity[]>([])
const initiativeInputs = ref<Record<number, number | undefined>>({})

let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(selectedType, () => loadEntities())
watch(searchQuery, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadEntities(q), 300)
})
watch(() => props.modelValue, (visible) => {
  if (visible) {
    selectedType.value = 'NPC'
    searchQuery.value = ''
    initiativeInputs.value = {}
    loadEntities()
  }
})

async function loadEntities(search?: string) {
  if (!campaignStore.activeCampaignId) return
  loading.value = true
  try {
    const query: Record<string, string | number> = {
      campaignId: campaignStore.activeCampaignId,
      type: selectedType.value,
    }
    if (search?.trim()) query.search = search.trim()
    entities.value = await $fetch<EncounterEntity[]>('/api/encounters/entities', { query })
  }
  catch {
    entities.value = []
  }
  finally {
    loading.value = false
  }
}

function translateLabel(label: string): string {
  return label.startsWith('statPresets.') ? t(label) : label
}

function getResource(entity: EncounterEntity, fieldName: string): ResourceField | undefined {
  return entity.resources.find(r => r.name === fieldName)
}

function onAddClick(entity: EncounterEntity) {
  // Use auto-detected HP, or first resource, or nothing
  const hpField = entity.autoHpField ?? entity.resources[0]?.name ?? null
  addWithResource(entity, hpField)
}

async function addWithResource(entity: EncounterEntity, hpFieldName: string | null) {
  let currentHp = 0
  let maxHp = 0

  if (hpFieldName) {
    const resource = entity.resources.find(r => r.name === hpFieldName)
    if (resource) {
      currentHp = resource.current
      maxHp = resource.max
    }
  }

  const initiative = props.requireInitiative ? initiativeInputs.value[entity.id] ?? null : null

  const ok = await encounterStore.addParticipantsWithHp(props.encounterId, [{ entityId: entity.id, currentHp, maxHp }])
  if (!ok) return

  // Set initiative and re-sort into correct position
  if (initiative != null) {
    const newParticipant = encounterStore.participants.findLast(p => p.entity_id === entity.id)
    if (newParticipant) {
      await encounterStore.updateParticipant(props.encounterId, newParticipant.id, { initiative })
      await encounterStore.sortByInitiative()
    }
  }

  initiativeInputs.value[entity.id] = undefined
  snackbarStore.success(t('encounters.participantAdded'))
}

function close() {
  emit('update:modelValue', false)
}
</script>
