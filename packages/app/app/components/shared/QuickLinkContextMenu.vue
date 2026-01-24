<template>
  <v-menu
    v-model="internalShow"
    :style="menuStyle"
    :close-on-content-click="false"
    location="bottom start"
    origin="top start"
  >
    <v-list density="compact" nav elevation="8">
      <!-- Entity Link Options -->
      <template v-for="config in linkConfigs" :key="config.targetType">
        <!-- Single relation type: direct click, no submenu -->
        <v-list-item
          v-if="config.relationTypes.length === 1"
          class="px-2"
          @click="handleSelect(config.targetType, config.relationTypes[0] ?? 'related')"
        >
          <template #prepend>
            <v-icon :icon="config.icon" size="small" class="mr-2" />
          </template>
          <v-list-item-title class="text-body-2">
            {{ $t(config.labelKey) }}
          </v-list-item-title>
        </v-list-item>

        <!-- Multiple relation types: show submenu -->
        <v-list-item v-else class="px-2">
          <template #prepend>
            <v-icon :icon="config.icon" size="small" class="mr-2" />
          </template>
          <v-list-item-title class="text-body-2">
            {{ $t(config.labelKey) }}
          </v-list-item-title>
          <template #append>
            <v-icon icon="mdi-chevron-right" size="small" />
          </template>

          <!-- Nested submenu for relation types -->
          <v-menu
            activator="parent"
            location="end"
            open-on-hover
            :open-delay="100"
            :close-delay="100"
          >
            <v-list density="compact" nav max-height="400" class="overflow-y-auto" elevation="8">
              <v-list-item
                v-for="relationType in sortedRelationTypes(config)"
                :key="relationType"
                class="px-3"
                @click="handleSelect(config.targetType, relationType)"
              >
                <v-list-item-title class="text-body-2">
                  {{ $t(`${config.i18nPrefix}.${relationType}`, relationType) }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-list-item>
      </template>

      <!-- Divider -->
      <v-divider class="my-1" />

      <!-- Add to Group - always show, with submenu for all campaign groups -->
      <v-list-item class="px-2">
        <template #prepend>
          <v-icon icon="mdi-folder-plus" size="small" class="mr-2" />
        </template>
        <v-list-item-title class="text-body-2">
          {{ $t('quickLink.addToGroup') }}
        </v-list-item-title>
        <template #append>
          <v-icon icon="mdi-chevron-right" size="small" />
        </template>

        <!-- Nested submenu for groups -->
        <v-menu
          activator="parent"
          location="end"
          open-on-hover
          :open-delay="100"
          :close-delay="100"
        >
          <v-list density="compact" nav elevation="8">
            <v-list-item
              v-for="group in allGroups"
              :key="group.id"
              class="px-3"
              :disabled="isInGroup(group.id)"
              @click="!isInGroup(group.id) && handleAddToGroup(group.id)"
            >
              <template #prepend>
                <v-avatar :color="group.color || 'grey'" size="24" class="mr-2">
                  <v-icon :icon="group.icon || 'mdi-folder'" size="small" />
                </v-avatar>
              </template>
              <v-list-item-title class="text-body-2">
                {{ group.name }}
              </v-list-item-title>
              <template v-if="isInGroup(group.id)" #append>
                <v-icon icon="mdi-check" size="small" color="success" />
              </template>
            </v-list-item>

            <v-divider v-if="allGroups.length > 0" class="my-1" />

            <v-list-item class="px-3" @click="handleCreateGroup">
              <template #prepend>
                <v-icon icon="mdi-plus" size="small" class="mr-2" />
              </template>
              <v-list-item-title class="text-body-2">
                {{ $t('quickLink.createGroup') }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { QUICK_LINK_CONFIG, type QuickLinkTargetConfig, type SourceEntityType } from '~~/types/quick-link'
import type { GroupInfo } from '~~/types/group'

const { t } = useI18n()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

interface Props {
  modelValue: boolean
  position: { x: number; y: number }
  sourceEntity: { id: number; name: string }
  sourceType: SourceEntityType
  groups?: GroupInfo[] // Groups this entity is already in (for marking)
}

const props = withDefaults(defineProps<Props>(), {
  groups: () => [],
})

// Load all campaign groups when menu opens
const allGroups = ref<GroupInfo[]>([])

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen && campaignStore.activeCampaignId) {
    try {
      const groups = await $fetch<GroupInfo[]>('/api/groups', {
        query: { campaignId: campaignStore.activeCampaignId },
      })
      allGroups.value = groups
    } catch (e) {
      console.error('[QuickLinkContextMenu] Failed to load groups:', e)
      allGroups.value = []
    }
  }
})

// Check if entity is already in a group
function isInGroup(groupId: number): boolean {
  return props.groups?.some(g => g.id === groupId) ?? false
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [payload: { targetType: string; relationType: string }]
  'added-to-group': [] // Notify parent to refresh counts
  'create-group': []
}>()

const internalShow = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const menuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  zIndex: 2000,
}))

const linkConfigs = computed(() => {
  return QUICK_LINK_CONFIG[props.sourceType] || []
})

// Sort relation types alphabetically by translated name
function sortedRelationTypes(config: QuickLinkTargetConfig): readonly string[] {
  return [...config.relationTypes].sort((a, b) => {
    const aLabel = t(`${config.i18nPrefix}.${a}`, a)
    const bLabel = t(`${config.i18nPrefix}.${b}`, b)
    return aLabel.localeCompare(bLabel)
  })
}

function handleSelect(targetType: string, relationType: string) {
  emit('select', { targetType, relationType })
  internalShow.value = false
}

async function handleAddToGroup(groupId: number) {
  try {
    await $fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: { entityIds: [props.sourceEntity.id] },
    })
    snackbarStore.success(t('groups.entitiesAdded', 1))
    emit('added-to-group') // Notify parent to refresh counts
  } catch (e) {
    console.error('[QuickLinkContextMenu] Failed to add to group:', e)
    snackbarStore.error(t('common.error'))
  }
  internalShow.value = false
}

function handleCreateGroup() {
  emit('create-group')
  internalShow.value = false
}
</script>
