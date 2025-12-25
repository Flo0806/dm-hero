<template>
  <v-dialog
    :model-value="modelValue"
    max-width="700"
    persistent
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center text-h5 pa-6 pb-2">
        <v-icon icon="mdi-file-document-check" color="primary" size="28" class="mr-3" />
        {{ $t('tos.acceptTitle') }}
      </v-card-title>

      <v-card-subtitle class="px-6 pb-4">
        {{ $t('tos.acceptSubtitle') }}
      </v-card-subtitle>

      <v-divider />

      <v-card-text class="tos-scroll-area pa-6" style="max-height: 400px; overflow-y: auto;">
        <!-- Summary of key points -->
        <v-alert type="warning" variant="tonal" class="mb-6">
          <template #title>
            {{ $t('tos.keyPointsTitle') }}
          </template>
          <ul class="mt-2 pl-4">
            <li>{{ $t('tos.keyPoint1') }}</li>
            <li>{{ $t('tos.keyPoint2') }}</li>
            <li>{{ $t('tos.keyPoint3') }}</li>
            <li>{{ $t('tos.keyPoint4') }}</li>
          </ul>
        </v-alert>

        <!-- Link to full terms -->
        <p class="text-body-1 mb-4">
          {{ $t('tos.readFullText') }}
          <NuxtLink to="/terms" target="_blank" class="text-primary font-weight-medium">
            {{ $t('tos.fullTermsLink') }}
            <v-icon icon="mdi-open-in-new" size="x-small" />
          </NuxtLink>
        </p>

        <!-- Checkbox -->
        <v-checkbox
          v-model="accepted"
          color="primary"
          hide-details
          class="mt-4"
        >
          <template #label>
            <span class="text-body-1">
              {{ $t('tos.checkboxLabel') }}
              <strong>{{ $t('tos.version') }} {{ tosVersion }}</strong>
            </span>
          </template>
        </v-checkbox>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-6">
        <v-btn
          variant="text"
          @click="handleDecline"
        >
          {{ $t('tos.decline') }}
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!accepted"
          :loading="loading"
          @click="handleAccept"
        >
          {{ $t('tos.accept') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  tosVersion: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'accepted': []
  'declined': []
}>()

const { showError, showSuccess } = useSnackbar()
const { t } = useI18n()
const api = useApiFetch()

const accepted = ref(false)
const loading = ref(false)

// Reset checkbox when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    accepted.value = false
  }
})

async function handleAccept() {
  if (!accepted.value) return

  loading.value = true
  try {
    await api.post('/api/tos/accept', {})
    showSuccess(t('tos.acceptedSuccess'))
    emit('update:modelValue', false)
    emit('accepted')
  } catch (err) {
    console.error('Failed to accept ToS:', err)
    showError(t('tos.acceptError'))
  } finally {
    loading.value = false
  }
}

function handleDecline() {
  emit('update:modelValue', false)
  emit('declined')
}
</script>

<style scoped>
.tos-scroll-area ul {
  list-style-type: disc;
}

.tos-scroll-area li {
  margin-bottom: 0.5rem;
}
</style>
