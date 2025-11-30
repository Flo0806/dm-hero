<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <v-list v-else-if="characters.length > 0" class="mb-3">
      <v-list-item v-for="npc in characters" :key="npc.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="npc.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${npc.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-account" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ npc.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="npc.description" class="text-caption text-medium-emphasis">
          {{ npc.description.substring(0, 100) }}{{ npc.description.length > 100 ? '...' : '' }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="removeCharacter(npc.relation_id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-account-off"
      :title="$t('players.noCharacters')"
      :text="$t('players.noCharactersText')"
    />

    <v-expansion-panels class="mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon start>mdi-plus</v-icon>
          {{ $t('players.addCharacter') }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-autocomplete
            v-model="selectedNpcId"
            :items="availableNpcs"
            item-title="name"
            item-value="id"
            :label="$t('common.selectNpc')"
            variant="outlined"
            clearable
            class="mb-3"
          />

          <v-btn
            color="primary"
            prepend-icon="mdi-account-plus"
            :disabled="!selectedNpcId"
            :loading="adding"
            @click="addCharacter"
          >
            {{ $t('players.addCharacter') }}
          </v-btn>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
const entitiesStore = useEntitiesStore()

interface Character {
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

const characters = ref<Character[]>([])
const availableNpcs = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const adding = ref(false)
const selectedNpcId = ref<number | null>(null)

watch(
  () => props.entityId,
  async () => {
    await loadCharacters()
  },
  { immediate: true },
)

watch(
  () => entitiesStore.npcs,
  (npcs) => {
    if (npcs) {
      availableNpcs.value = npcs.map((n) => ({ id: n.id, name: n.name }))
    }
  },
  { immediate: true },
)

async function loadCharacters() {
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
    >(`/api/entities/${props.entityId}/related/npcs`)

    characters.value = relations.map((rel) => ({
      relation_id: rel.id,
      id: rel.direction === 'outgoing' ? rel.to_entity_id : rel.from_entity_id,
      name: rel.name,
      description: rel.description,
      image_url: rel.image_url,
    }))
  } catch (error) {
    console.error('Failed to load characters:', error)
    characters.value = []
  } finally {
    loading.value = false
  }
}

async function addCharacter() {
  if (!selectedNpcId.value) return

  adding.value = true
  try {
    const relation = await $fetch<{ id: number }>('/api/entity-relations', {
      method: 'POST',
      body: {
        fromEntityId: props.entityId,
        toEntityId: selectedNpcId.value,
        relationType: 'plays',
      },
    })

    const npc = availableNpcs.value.find((n) => n.id === selectedNpcId.value)
    characters.value.push({
      relation_id: relation.id,
      id: selectedNpcId.value,
      name: npc?.name || '',
      description: null,
      image_url: null,
    })

    selectedNpcId.value = null
    emit('changed')
  } catch (error) {
    console.error('Failed to add character:', error)
  } finally {
    adding.value = false
  }
}

async function removeCharacter(relationId: number) {
  try {
    await $fetch(`/api/entity-relations/${relationId}`, { method: 'DELETE' })
    characters.value = characters.value.filter((c) => c.relation_id !== relationId)
    emit('changed')
  } catch (error) {
    console.error('Failed to remove character:', error)
  }
}
</script>
