<template>
  <div>
    <!-- Add Lore Section -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-autocomplete
          v-model="localLoreId"
          :items="availableLore"
          item-title="name"
          item-value="id"
          :label="$t('common.selectLore')"
          :placeholder="$t('common.selectLorePlaceholder')"
          variant="outlined"
          clearable
          :loading="loading"
          class="mb-2"
        >
          <template #prepend-item>
            <v-list-item class="text-primary" @click="showQuickCreate = true">
              <template #prepend>
                <v-icon>mdi-plus</v-icon>
              </template>
              <v-list-item-title>{{ $t('quickCreate.newLore') }}</v-list-item-title>
            </v-list-item>
            <v-divider class="my-1" />
          </template>
        </v-autocomplete>
        <v-btn color="primary" block :disabled="!localLoreId" @click="handleAdd">
          <v-icon start>mdi-link-plus</v-icon>
          {{ $t('common.linkLore') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Linked Lore List -->
    <v-list v-if="linkedLore.length > 0" class="pa-0">
      <v-list-item v-for="lore in linkedLore" :key="lore.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="lore.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${lore.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-book-open-variant" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ lore.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="lore.description">
          {{ lore.description.substring(0, 100) }}{{ lore.description.length > 100 ? '...' : '' }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', lore.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-book-off"
      :title="$t('common.noLinkedLore')"
      :text="$t('common.noLinkedLoreText')"
    />

    <!-- Quick Create Dialog -->
    <SharedQuickCreateEntityDialog
      v-model="showQuickCreate"
      entity-type="Lore"
      @created="handleQuickCreated"
    />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const entitiesStore = useEntitiesStore()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

// Register with parent dialog's dirty state management
const { markDirty } = useTabDirtyState('lore', t('lore.title'))

interface LinkedLore {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
  direction?: 'outgoing' | 'incoming'
}

interface AvailableLore {
  id: number
  name: string
}

interface Props {
  linkedLore: LinkedLore[]
  availableLore: AvailableLore[]
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  add: [loreId: number]
  remove: [loreId: number]
}>()

const localLoreId = ref<number | null>(null)

// Quick Create state
const showQuickCreate = ref(false)

// Track dirty state
const isDirty = computed(() => !!localLoreId.value)
watch(isDirty, (dirty) => markDirty(dirty), { immediate: true })

function handleAdd() {
  if (!localLoreId.value) return

  emit('add', localLoreId.value)
  localLoreId.value = null
}

async function handleQuickCreated(newEntity: { id: number; name: string }) {
  // Reload lore to include the new entry
  const campaignId = campaignStore.activeCampaignId
  if (campaignId) {
    await entitiesStore.fetchLore(campaignId, true)
  }

  // Pre-select the new lore in the autocomplete (user still needs to click "Link")
  localLoreId.value = newEntity.id

  snackbarStore.success(t('quickCreate.created', { name: newEntity.name }))
}
</script>
