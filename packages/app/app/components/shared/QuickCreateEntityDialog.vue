<template>
  <v-dialog v-model="show" max-width="500" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :icon="entityIcon" class="mr-2" :color="entityColor" />
        {{ $t('quickCreate.title', { type: entityTypeLabel }) }}
      </v-card-title>

      <v-card-text>
        <v-text-field
          ref="nameInput"
          v-model="form.name"
          :label="$t('common.name')"
          variant="outlined"
          required
          autofocus
          class="mb-3"
          @keyup.enter="create"
        />
        <v-textarea
          v-model="form.description"
          :label="$t('common.description')"
          variant="outlined"
          rows="3"
          auto-grow
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="creating" @click="close">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          :disabled="!form.name.trim()"
          :loading="creating"
          @click="create"
        >
          {{ $t('quickCreate.create') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
type EntityType = 'NPC' | 'Item' | 'Location' | 'Faction' | 'Lore' | 'Player'

interface Props {
  modelValue: boolean
  entityType: EntityType
  initialName?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialName: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [entity: { id: number; name: string; type: EntityType }]
}>()

const { t } = useI18n()
const campaignStore = useCampaignStore()

const nameInput = ref<{ focus: () => void } | null>(null)
const creating = ref(false)
const form = ref({
  name: '',
  description: '',
})

const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Entity type configuration
const entityConfig: Record<EntityType, { icon: string; color: string; labelKey: string; apiPath: string }> = {
  NPC: { icon: 'mdi-account', color: '#D4A574', labelKey: 'entities.types.npc', apiPath: 'npcs' },
  Item: { icon: 'mdi-sword', color: '#CC8844', labelKey: 'entities.types.item', apiPath: 'items' },
  Location: { icon: 'mdi-map-marker', color: '#8B7355', labelKey: 'entities.types.location', apiPath: 'locations' },
  Faction: { icon: 'mdi-shield-account', color: '#7B92AB', labelKey: 'entities.types.faction', apiPath: 'factions' },
  Lore: { icon: 'mdi-book-open-page-variant', color: '#B8935F', labelKey: 'entities.types.lore', apiPath: 'lore' },
  Player: { icon: 'mdi-account-group', color: '#9C7A97', labelKey: 'entities.types.player', apiPath: 'players' },
}

const entityIcon = computed(() => entityConfig[props.entityType].icon)
const entityColor = computed(() => entityConfig[props.entityType].color)
const entityTypeLabel = computed(() => t(entityConfig[props.entityType].labelKey))
const apiPath = computed(() => entityConfig[props.entityType].apiPath)

// Reset form when dialog opens
watch(show, (isOpen) => {
  if (isOpen) {
    form.value = {
      name: props.initialName || '',
      description: '',
    }
    // Focus name input after dialog animation
    nextTick(() => {
      setTimeout(() => {
        nameInput.value?.focus()
      }, 100)
    })
  }
})

function close() {
  show.value = false
}

async function create() {
  if (!form.value.name.trim() || creating.value) return

  const campaignId = campaignStore.activeCampaignId
  if (!campaignId) {
    console.error('[QuickCreateEntityDialog] No active campaign')
    return
  }

  creating.value = true

  try {
    const response = await $fetch<{ id: number; name: string }>(`/api/${apiPath.value}`, {
      method: 'POST',
      body: {
        name: form.value.name.trim(),
        description: form.value.description.trim() || undefined,
        campaignId,
      },
    })

    emit('created', {
      id: response.id,
      name: response.name,
      type: props.entityType,
    })

    close()
  } catch (error) {
    console.error('[QuickCreateEntityDialog] Failed to create entity:', error)
  } finally {
    creating.value = false
  }
}
</script>
