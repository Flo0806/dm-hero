<template>
  <!-- Show this map to the players - exactly one map is shown at a time.
       Only there if the campaign has a game; highlighted while it's shown. -->
  <v-btn
    v-if="store.table"
    :variant="shown ? 'flat' : 'text'"
    :color="shown ? 'primary' : undefined"
    :prepend-icon="shown ? 'mdi-cast-connected' : 'mdi-cast'"
    :loading="busy"
    @click="toggle"
  >
    {{ shown ? $t('gameTable.map.shown') : $t('gameTable.map.show') }}
    <v-tooltip activator="parent" location="bottom">
      {{ shown ? $t('gameTable.map.stopHint') : $t('gameTable.map.showHint') }}
    </v-tooltip>
  </v-btn>
</template>

<script setup lang="ts">
const props = defineProps<{ mapId: number }>()
const store = useGameTableStore()
const snackbar = useSnackbarStore()
const { t } = useI18n()

const shown = computed(() => store.table?.shown_map_id === props.mapId)
const busy = ref(false)

async function toggle() {
  busy.value = true
  try {
    const pending = await store.setShownMap(shown.value ? null : props.mapId)
    if (pending) snackbar.warning(t(`gameTable.map.pending.${pending}`))
  }
  catch (error) {
    console.error('[GameTable] Show map failed:', error)
    snackbar.error(t('gameTable.map.failed'))
  }
  finally {
    busy.value = false
  }
}
</script>
