<template>
  <v-dialog :model-value="show" max-width="480" @update:model-value="emit('update:show', $event)">
    <v-card>
      <v-card-title>
        {{ player ? $t('gameTable.editPlayer') : $t('gameTable.addPlayer') }}
      </v-card-title>
      <v-card-text>
        <v-form id="game-table-player-form" @submit.prevent="save">
          <v-text-field
            v-model="name"
            :label="$t('gameTable.name')"
            variant="outlined"
            autofocus
            class="mb-2"
          />
          <v-autocomplete
            v-model="playerEntityId"
            :items="entityOptions"
            :label="$t('gameTable.linkEntity')"
            :hint="$t('gameTable.linkEntityHint')"
            persistent-hint
            clearable
            variant="outlined"
            @update:model-value="onEntityPicked"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:show', false)">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" type="submit" form="game-table-player-form" :disabled="!name.trim()">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { GameTablePlayer } from '~~/types/game-table'

const props = defineProps<{ show: boolean, player?: GameTablePlayer | null }>()
const emit = defineEmits<{
  'update:show': [boolean]
  'save': [{ name: string, playerEntityId: number | null }]
}>()

const entitiesStore = useEntitiesStore()
const name = ref('')
const playerEntityId = ref<number | null>(null)

const entityOptions = computed(() =>
  entitiesStore.activePlayers.map(p => ({ title: p.name, value: p.id })),
)

watch(() => props.show, (open) => {
  if (!open) return
  name.value = props.player?.name ?? ''
  playerEntityId.value = props.player?.player_entity_id ?? null
})

// Picking an entity fills an empty name - most DMs want the same name
function onEntityPicked(id: number | null) {
  if (!id || name.value.trim()) return
  name.value = entitiesStore.players.find(p => p.id === id)?.name ?? ''
}

function save() {
  if (!name.value.trim()) return
  emit('save', { name: name.value.trim(), playerEntityId: playerEntityId.value })
}
</script>
