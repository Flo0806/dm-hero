<template>
  <div>
    <!-- Add Item Section -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-autocomplete
          v-model="localItemId"
          :items="availableItems"
          item-title="name"
          item-value="id"
          :label="$t('common.selectItem')"
          :placeholder="$t('common.selectItemPlaceholder')"
          variant="outlined"
          clearable
          :loading="loading"
          class="mb-2"
        />

        <v-select
          v-if="showRelationType && relationTypeSuggestions.length > 0"
          v-model="localRelationType"
          :items="relationTypeSuggestions"
          item-title="title"
          item-value="value"
          :label="$t('common.relationType')"
          variant="outlined"
          clearable
          class="mb-2"
        />

        <v-row v-if="showQuantity || showEquipped">
          <v-col v-if="showQuantity" cols="12" :md="showEquipped ? 6 : 12">
            <v-text-field
              v-model.number="localQuantity"
              :label="$t('common.quantity')"
              :placeholder="$t('common.quantityPlaceholder')"
              variant="outlined"
              type="number"
              min="1"
            />
          </v-col>
          <v-col v-if="showEquipped" cols="12" :md="showQuantity ? 6 : 12" class="d-flex align-center">
            <v-switch
              v-model="localEquipped"
              :label="$t('common.equipped')"
              color="primary"
              hide-details
            />
          </v-col>
        </v-row>

        <v-btn color="primary" block :disabled="!canAdd" @click="handleAdd">
          <v-icon start>mdi-link-plus</v-icon>
          {{ $t('common.linkItem') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Linked Items List -->
    <v-list v-if="linkedItems.length > 0" class="pa-0">
      <v-list-item v-for="item in linkedItems" :key="item.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="showAvatar && item.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${item.image_url}`" />
          </v-avatar>
          <v-avatar v-else-if="showAvatar" size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon :icon="getItemTypeIcon(item.metadata?.type)" />
          </v-avatar>
          <v-icon v-else :icon="getItemTypeIcon(item.metadata?.type)" color="primary" class="mr-3" />
        </template>

        <v-list-item-title>
          {{ item.name }}
          <v-chip v-if="showEquipped && item.equipped" size="x-small" color="success" class="ml-2">
            {{ $t('common.equipped') }}
          </v-chip>
          <v-chip v-if="showRarity && item.rarity" size="x-small" :color="getRarityColor(item.rarity)" class="ml-2">
            {{ $t(`items.rarities.${item.rarity}`) }}
          </v-chip>
        </v-list-item-title>

        <v-list-item-subtitle>
          <v-chip v-if="showRelationType && item.relation_type" size="small" class="mr-1" color="primary" variant="tonal">
            {{ getRelationTypeLabel(item.relation_type) }}
          </v-chip>
          <span v-if="showQuantity && item.quantity && item.quantity > 1" class="text-caption mr-2">
            {{ item.quantity }}x
          </span>
          <span v-if="item.description" class="text-caption text-medium-emphasis">
            {{ item.description.substring(0, 100) }}{{ item.description.length > 100 ? '...' : '' }}
          </span>
        </v-list-item-subtitle>

        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="editItem(item)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', item.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-treasure-chest-outline"
      :title="$t('common.noLinkedItems')"
      :text="$t('common.noLinkedItemsText')"
    />

    <!-- Edit Item Dialog -->
    <v-dialog v-model="showEditDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('common.editItemLink') }}</v-card-title>
        <v-card-text>
          <v-select
            v-if="showRelationType && relationTypeSuggestions.length > 0"
            v-model="editForm.relationType"
            :items="relationTypeSuggestions"
            item-title="title"
            item-value="value"
            :label="$t('common.relationType')"
            variant="outlined"
            clearable
            class="mb-3"
          />
          <v-text-field
            v-if="showQuantity"
            v-model.number="editForm.quantity"
            :label="$t('common.quantity')"
            variant="outlined"
            type="number"
            min="1"
            class="mb-3"
          />
          <v-switch
            v-if="showEquipped"
            v-model="editForm.equipped"
            :label="$t('common.equipped')"
            color="primary"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeEditDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :loading="saving" @click="saveEdit">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useTabDirtyState } from '~/composables/useDialogDirtyState'

const { t } = useI18n()

// Register with parent dialog's dirty state management
const { markDirty } = useTabDirtyState('items', t('npcs.items'))

interface LinkedItem {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
  relation_type?: string | null
  quantity?: number | null
  equipped?: boolean | null
  rarity?: string | null
  metadata?: { type?: string } | null
}

const { getItemTypeIcon } = useEntityIcons()

interface AvailableItem {
  id: number
  name: string
}

interface RelationTypeSuggestion {
  title: string
  value: string
}

interface Props {
  linkedItems: LinkedItem[]
  availableItems: AvailableItem[]
  loading?: boolean
  // Display options
  showAvatar?: boolean
  showRelationType?: boolean
  showQuantity?: boolean
  showEquipped?: boolean
  showRarity?: boolean
  // Relation type suggestions (for select dropdown)
  relationTypeSuggestions?: RelationTypeSuggestion[]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showAvatar: true,
  showRelationType: false,
  showQuantity: false,
  showEquipped: false,
  showRarity: false,
  relationTypeSuggestions: () => [],
})

const emit = defineEmits<{
  add: [payload: { itemId: number; relationType?: string; quantity?: number; equipped?: boolean }]
  update: [payload: { relationId: number; relationType?: string; quantity?: number; equipped?: boolean }]
  remove: [itemId: number]
}>()

const localItemId = ref<number | null>(null)
const localRelationType = ref<string>('')
const localQuantity = ref<number | undefined>(undefined)
const localEquipped = ref(false)

// Edit dialog state
const showEditDialog = ref(false)
const editingItem = ref<LinkedItem | null>(null)
const editForm = ref({
  relationType: '',
  quantity: 1,
  equipped: false,
})
const saving = ref(false)

// Track dirty state: form has data or edit dialog is open
const isDirty = computed(() => {
  const hasFormData = !!localItemId.value || !!localRelationType.value || !!localQuantity.value || localEquipped.value
  return hasFormData || showEditDialog.value
})

// Notify parent dialog about dirty state
watch(isDirty, (dirty) => markDirty(dirty), { immediate: true })

const canAdd = computed(() => {
  if (!localItemId.value) return false
  if (props.showRelationType && props.relationTypeSuggestions.length > 0 && !localRelationType.value) return false
  return true
})

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: 'grey',
    uncommon: 'success',
    rare: 'info',
    'very rare': 'warning',
    legendary: 'error',
    artifact: 'purple',
  }
  return colors[rarity] || 'grey'
}

function getRelationTypeLabel(relationType: string): string {
  // Try to find in suggestions first
  const suggestion = props.relationTypeSuggestions.find((s) => s.value === relationType)
  if (suggestion) return suggestion.title
  return relationType
}

function handleAdd() {
  if (!localItemId.value) return

  const payload: { itemId: number; relationType?: string; quantity?: number; equipped?: boolean } = {
    itemId: localItemId.value,
  }

  if (props.showRelationType && localRelationType.value) {
    payload.relationType = localRelationType.value
  }

  if (props.showQuantity && localQuantity.value) {
    payload.quantity = localQuantity.value
  }

  if (props.showEquipped) {
    payload.equipped = localEquipped.value
  }

  emit('add', payload)

  // Reset form
  localItemId.value = null
  localRelationType.value = ''
  localQuantity.value = undefined
  localEquipped.value = false
}

function editItem(item: LinkedItem) {
  editingItem.value = item
  editForm.value = {
    relationType: item.relation_type || '',
    quantity: item.quantity || 1,
    equipped: item.equipped || false,
  }
  showEditDialog.value = true
}

function saveEdit() {
  if (!editingItem.value) return

  saving.value = true
  emit('update', {
    relationId: editingItem.value.id,
    relationType: editForm.value.relationType || undefined,
    quantity: editForm.value.quantity || undefined,
    equipped: editForm.value.equipped,
  })

  // Close dialog (parent will handle the API call and reload)
  closeEditDialog()
  saving.value = false
}

function closeEditDialog() {
  showEditDialog.value = false
  editingItem.value = null
  editForm.value = { relationType: '', quantity: 1, equipped: false }
}
</script>
