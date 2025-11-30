<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <v-list v-else-if="loreEntries.length > 0" class="mb-3">
      <v-list-item v-for="lore in loreEntries" :key="lore.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="lore.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${lore.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-book-open-variant" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ lore.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="lore.description" class="text-caption text-medium-emphasis">
          {{ lore.description.substring(0, 100) }}{{ lore.description.length > 100 ? '...' : '' }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="removeLore(lore.relation_id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-book-open-variant"
      :title="$t('players.noLore')"
      :text="$t('players.noLoreText')"
    />

    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('players.addLore') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-autocomplete
            v-model="selectedLoreId"
            :items="availableLore"
            item-title="name"
            item-value="id"
            :label="$t('common.selectLore')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-link"
            :disabled="!selectedLoreId"
            :loading="adding"
            @click="addLore"
          >
            {{ $t('players.addLore') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
const entitiesStore = useEntitiesStore()

interface LoreEntry {
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

const loreEntries = ref<LoreEntry[]>([])
const availableLore = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const adding = ref(false)
const selectedLoreId = ref<number | null>(null)

watch(
  () => props.entityId,
  async () => {
    await loadLore()
  },
  { immediate: true },
)

watch(
  () => entitiesStore.lore,
  (storeLore) => {
    if (storeLore) {
      availableLore.value = storeLore.map((l) => ({ id: l.id, name: l.name }))
    }
  },
  { immediate: true },
)

async function loadLore() {
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
    >(`/api/entities/${props.entityId}/related/lore`)

    loreEntries.value = relations.map((rel) => ({
      relation_id: rel.id,
      id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      name: rel.name,
      description: rel.description,
      image_url: rel.image_url,
    }))
  } catch (error) {
    console.error('Failed to load lore:', error)
    loreEntries.value = []
  } finally {
    loading.value = false
  }
}

async function addLore() {
  if (!selectedLoreId.value) return

  adding.value = true
  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: selectedLoreId.value,
        relationType: 'knows',
      },
    })

    const lore = availableLore.value.find((l) => l.id === selectedLoreId.value)
    loreEntries.value.push({
      relation_id: relation.id,
      id: selectedLoreId.value,
      name: lore?.name || '',
      description: null,
      image_url: null,
    })

    selectedLoreId.value = null
    emit('changed')
  } catch (error) {
    console.error('Failed to add lore:', error)
  } finally {
    adding.value = false
  }
}

async function removeLore(relationId: number) {
  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    loreEntries.value = loreEntries.value.filter((l) => l.relation_id !== relationId)
    emit('changed')
  } catch (error) {
    console.error('Failed to remove lore:', error)
  }
}
</script>
