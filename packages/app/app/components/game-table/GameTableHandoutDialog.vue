<template>
  <!-- Hand a document to all or chosen players - or take it back -->
  <v-dialog :model-value="show" max-width="440" @update:model-value="emit('update:show', $event)">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-hand-extended-outline" color="primary" />
        {{ $t('gameTable.handout.title', { name: title }) }}
      </v-card-title>
      <v-card-text>
        <v-radio-group v-model="mode" hide-details class="mb-2">
          <v-radio value="all" :label="$t('gameTable.handout.all')" />
          <v-radio value="some" :label="$t('gameTable.handout.some')" :disabled="!players.length" />
        </v-radio-group>
        <div v-if="mode === 'some'" class="ps-8">
          <v-checkbox
            v-for="player in players"
            :key="player.id"
            v-model="chosen"
            :value="player.id"
            :label="player.name"
            density="compact"
            hide-details
          />
        </div>
        <p class="text-body-small text-medium-emphasis mt-3 mb-0">
          {{ $t('gameTable.handout.hint') }}
        </p>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="existing" color="error" variant="text" :loading="busy" @click="withdraw">
          {{ $t('gameTable.handout.withdraw') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:show', false)">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" :loading="busy" :disabled="mode === 'some' && !chosen.length" @click="save">
          {{ existing ? $t('common.save') : $t('gameTable.handout.give') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
const props = defineProps<{ show: boolean, documentId: number, title: string }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()
const store = useGameTableStore()
const snackbar = useSnackbarStore()
const { t } = useI18n()

const players = computed(() => store.table?.players ?? [])
const existing = computed(() => store.handoutOf(props.documentId))
const mode = ref<'all' | 'some'>('all')
const chosen = ref<number[]>([])
const busy = ref(false)

// Load the saved recipients on every open - also the first one (the dialog is mounted already open)
watch(() => props.show, (open) => {
  if (!open) return
  const recipients = existing.value?.recipients ?? 'all'
  mode.value = recipients === 'all' ? 'all' : 'some'
  chosen.value = recipients === 'all' ? [] : [...recipients]
}, { immediate: true })

async function run(action: () => Promise<unknown>, success: string) {
  busy.value = true
  try {
    const pending = await action()
    if (pending === true) snackbar.warning(t('gameTable.handout.pending'))
    else snackbar.success(success)
    emit('update:show', false)
  }
  catch (error) {
    const tooLarge = (error as { statusCode?: number }).statusCode === 413
    snackbar.error(tooLarge ? t('gameTable.handout.tooLarge') : t('gameTable.error'))
  }
  finally {
    busy.value = false
  }
}

const save = () => run(() => store.handOut(props.documentId, mode.value === 'all' ? 'all' : chosen.value), t('gameTable.handout.given'))
const withdraw = () => run(() => store.withdrawHandout(existing.value!.id), t('gameTable.handout.withdrawn'))
</script>
