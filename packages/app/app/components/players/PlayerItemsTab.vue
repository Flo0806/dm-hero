<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <v-list v-else-if="items.length > 0" class="mb-3">
      <v-list-item v-for="item in items" :key="item.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="item.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${item.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-sword" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ item.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="item.description" class="text-caption text-medium-emphasis">
          {{ item.description.substring(0, 100) }}{{ item.description.length > 100 ? '...' : '' }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="removeItem(item.relation_id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-sword-cross"
      :title="$t('players.noItems')"
      :text="$t('players.noItemsText')"
    />

    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('players.addItem') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-autocomplete
            v-model="selectedItemId"
            :items="availableItems"
            item-title="name"
            item-value="id"
            :label="$t('common.selectItem')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-link"
            :disabled="!selectedItemId"
            :loading="adding"
            @click="addItem"
          >
            {{ $t('players.addItem') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
const entitiesStore = useEntitiesStore()

interface PlayerItem {
  relation_id: number
  id: number
  name: string
  description: string | null
  image_url: string | null
}

interface Props {
  entityId: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  changed: []
}>()

const items = ref<PlayerItem[]>([])
const availableItems = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const adding = ref(false)
const selectedItemId = ref<number | null>(null)

watch(
  () => props.entityId,
  async () => {
    await loadItems()
  },
  { immediate: true },
)

watch(
  () => entitiesStore.items,
  (storeItems) => {
    if (storeItems) {
      availableItems.value = storeItems.map((i) => ({ id: i.id, name: i.name }))
    }
  },
  { immediate: true },
)

async function loadItems() {
  if (!props.entityId) return

  loading.value = true
  try {
    const relations = await $fetch<
      Array<{
        id: number
        from_entity_id: number
        to_entity_id: number
        name: string
        description: string | null
        image_url: string | null
        direction: 'outgoing' | 'incoming'
      }>
    >(`/api/entities/${props.entityId}/related/items`)

    items.value = relations.map((rel) => ({
      relation_id: rel.id,
      id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      name: rel.name,
      description: rel.description,
      image_url: rel.image_url,
    }))
  } catch (error) {
    console.error('Failed to load items:', error)
    items.value = []
  } finally {
    loading.value = false
  }
}

async function addItem() {
  if (!selectedItemId.value) return

  adding.value = true
  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: selectedItemId.value,
        relationType: 'owns',
      },
    })

    const item = availableItems.value.find((i) => i.id === selectedItemId.value)
    items.value.push({
      relation_id: relation.id,
      id: selectedItemId.value,
      name: item?.name || '',
      description: null,
      image_url: null,
    })

    selectedItemId.value = null
    emit('changed')
  } catch (error) {
    console.error('Failed to add item:', error)
  } finally {
    adding.value = false
  }
}

async function removeItem(relationId: number) {
  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    items.value = items.value.filter((i) => i.relation_id !== relationId)
    emit('changed')
  } catch (error) {
    console.error('Failed to remove item:', error)
  }
}
</script>
