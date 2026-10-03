<template>
  <!-- One global dialog (see app.vue): tick fields -> share -> "sure?" -> shared -->
  <v-dialog :model-value="!!target" max-width="480" @update:model-value="close">
    <v-card v-if="target">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-share-variant" color="primary" />
        {{ $t('gameTable.share.title', { name: target.name }) }}
      </v-card-title>

      <v-card-text v-if="step === 'choose'">
        <v-text-field
          v-model="displayName"
          :label="$t('gameTable.share.displayName')"
          :hint="$t('gameTable.share.displayNameHint', { name: target.name })"
          persistent-hint
          clearable
          variant="outlined"
          class="mb-4"
        />
        <p class="text-body-medium text-medium-emphasis mb-2">
          {{ $t('gameTable.share.chooseFields') }}
        </p>
        <v-checkbox
          v-for="field in availableFields"
          :key="field"
          v-model="selected"
          :value="field"
          :label="fieldLabel(field)"
          density="compact"
          hide-details
        />
        <v-checkbox
          v-if="differsFromDefaults"
          v-model="rememberDefaults"
          :label="$t('gameTable.share.rememberDefaults', { type: typeLabel })"
          color="primary"
          density="compact"
          hide-details
          class="mt-3"
        />
        <v-alert type="info" variant="tonal" density="compact" class="mt-4">
          {{ $t('gameTable.share.liveHint') }}
        </v-alert>
      </v-card-text>

      <v-card-text v-else>
        <p class="text-body-large mb-0">
          {{ $t('gameTable.share.confirm') }}
        </p>
      </v-card-text>

      <v-card-actions>
        <v-btn v-if="existing && step === 'choose'" variant="text" color="error" :loading="busy" @click="stopSharing">
          {{ $t('gameTable.share.stop') }}
        </v-btn>
        <v-spacer />
        <template v-if="step === 'choose'">
          <v-btn variant="text" @click="close">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" variant="flat" :disabled="!selected.length" :loading="busy" @click="existing ? save() : step = 'confirm'">
            {{ existing ? $t('common.save') : $t('gameTable.share.action') }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" @click="step = 'choose'">
            {{ $t('gameTable.share.back') }}
          </v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" @click="save">
            {{ $t('gameTable.share.confirmYes') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { SHARE_TYPE_CONFIG } from '~~/types/share'

const { t } = useI18n()
const store = useGameTableStore()
const snackbarStore = useSnackbarStore()

const target = computed(() => store.shareTarget)
const existing = computed(() => target.value ? store.shareOf(target.value.type, target.value.entityId) : null)
const availableFields = computed(() => (target.value ? store.shareKinds[target.value.type] : undefined) ?? [])
const selected = ref<string[]>([])
/** Alias instead of the real name - clearing it later is the reveal */
const displayName = ref<string | null>(null)
const step = ref<'choose' | 'confirm'>('choose')
const rememberDefaults = ref(false)

// Remembered ticks of this type (or everything if nothing remembered yet)
const defaults = computed(() => (target.value ? store.shareDefaults[target.value.type] : undefined) ?? availableFields.value)
const differsFromDefaults = computed(() =>
  selected.value.length !== defaults.value.length || selected.value.some(f => !defaults.value.includes(f)),
)
const typeLabel = computed(() => target.value ? t(`${SHARE_TYPE_CONFIG[target.value.type].i18n}.title`) : '')
const busy = ref(false)

// Already shared: its fields. New: everything ticked (defaults per type come later).
// The field list is ensured first, so the ticks never start out empty.
watch(target, async (value) => {
  if (!value) return
  step.value = 'choose'
  try {
    await store.ensureShareKinds()
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
  rememberDefaults.value = false
  selected.value = existing.value ? [...existing.value.fields] : [...defaults.value]
  displayName.value = existing.value?.display_name ?? null
})

// i18n keys are camelCase (armor_class -> armorClass)
const fieldLabel = (field: string) =>
  t(`${SHARE_TYPE_CONFIG[target.value!.type].i18n}.${field.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}`, 1)

function close() {
  store.shareTarget = null
}

async function run(action: () => Promise<unknown>, message: string) {
  busy.value = true
  try {
    await action()
    snackbarStore.success(message)
    close()
  }
  catch (e) {
    // 413 = this game's storage on the player server is full (images)
    snackbarStore.error((e as { statusCode?: number }).statusCode === 413 ? t('gameTable.share.storageFull') : t('gameTable.error'))
  }
  finally {
    busy.value = false
  }
}

const save = () => run(async () => {
  await store.share(target.value!.type, target.value!.entityId, selected.value, displayName.value)
  if (rememberDefaults.value && differsFromDefaults.value) await store.saveShareDefaults(target.value!.type, selected.value)
}, t('gameTable.share.done'))
const stopSharing = () => run(() => store.unshare(existing.value!.id), t('gameTable.share.stopped'))
</script>
