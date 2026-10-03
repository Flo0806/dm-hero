<template>
  <!-- Step 1: game code (prefilled from QR links). Step 2: personal PIN. -->
  <form class="w-full max-w-105" @submit.prevent="submit">
    <div class="flex flex-col sm:flex-row gap-2.5">
      <template v-if="step === 'code'">
        <label for="game-code" class="sr-only">{{ $t('home.codeLabel') }}</label>
        <input
          id="game-code"
          ref="codeInput"
          v-model="code"
          :placeholder="$t('home.codeLabel')"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="12"
          class="field uppercase placeholder:normal-case"
        />
      </template>
      <template v-else>
        <label for="player-pin" class="sr-only">{{ $t('home.pinLabel') }}</label>
        <input
          id="player-pin"
          ref="pinInput"
          v-model="pin"
          :placeholder="$t('home.pinLabel')"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          aria-describedby="pin-hint"
          class="field"
        />
      </template>
      <button type="submit" :disabled="!canSubmit" class="btn-primary">
        {{ step === 'code' ? $t('home.next') : $t('home.join') }}
      </button>
    </div>

    <p v-if="step === 'pin'" id="pin-hint" class="mt-3 mb-0 text-sm text-muted">
      {{ $t('home.pinHint', { code: normalizedCode }) }}
      <button type="button" class="ml-1 p-0 border-none bg-transparent text-primary underline cursor-pointer focus-ring" @click="back">
        {{ $t('home.changeCode') }}
      </button>
    </p>
    <p role="alert" aria-live="assertive" class="mt-3 mb-0 min-h-6 text-sm text-danger">
      {{ error }}
    </p>
  </form>
</template>

<script setup lang="ts">
const emit = defineEmits<{ joined: [gameId: string] }>()
const { t } = useI18n()
const { join } = usePlayerSession()

// QR codes / links from DM Hero carry the game code (?code=XXXXXX)
const route = useRoute()
const code = ref(typeof route.query.code === 'string' ? route.query.code : '')
const pin = ref('')
const step = ref<'code' | 'pin'>('code')
const busy = ref(false)
const error = ref('')
const codeInput = ref<HTMLInputElement>()
const pinInput = ref<HTMLInputElement>()

const normalizedCode = computed(() => code.value.trim().toUpperCase())
const canSubmit = computed(() => !busy.value && (step.value === 'code' ? !!normalizedCode.value : /^\d{6}$/.test(pin.value.trim())))

async function submit() {
  error.value = ''
  if (step.value === 'code') {
    step.value = 'pin'
    await nextTick()
    pinInput.value?.focus()
    return
  }

  busy.value = true
  try {
    const result = await join(normalizedCode.value, pin.value.trim())
    emit('joined', result.gameId)
  }
  catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 429 ? t('home.tooManyAttempts') : t('home.joinFailed')
    pin.value = ''
    pinInput.value?.focus()
  }
  finally {
    busy.value = false
  }
}

async function back() {
  step.value = 'code'
  pin.value = ''
  error.value = ''
  await nextTick()
  codeInput.value?.focus()
}
</script>
