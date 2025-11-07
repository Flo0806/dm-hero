<template>
  <v-container>
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-h4 mb-2">
        {{ $t('settings.title') }}
      </h1>
      <p class="text-medium-emphasis">
        {{ $t('settings.subtitle') }}
      </p>
    </div>

    <!-- Settings Form -->
    <v-card>
      <v-card-text>
        <!-- OpenAI Integration Section -->
        <div class="mb-6">
          <h2 class="text-h6 mb-4">
            {{ $t('settings.sections.openai') }}
          </h2>

          <!-- API Key Field -->
          <v-text-field
            v-model="apiKey"
            :label="$t('settings.openai.apiKey')"
            :placeholder="$t('settings.openai.apiKeyPlaceholder')"
            :hint="$t('settings.openai.apiKeyHint')"
            :type="showApiKey ? 'text' : 'password'"
            variant="outlined"
            density="comfortable"
            class="mb-4"
            persistent-hint
          >
            <template #append-inner>
              <v-btn
                :icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
                variant="text"
                size="small"
                @click="showApiKey = !showApiKey"
              />
            </template>
          </v-text-field>

          <!-- Get API Key Help -->
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            <div class="d-flex align-center">
              <span class="flex-grow-1">{{ $t('settings.openai.howToGetKey') }}</span>
              <v-btn
                href="https://platform.openai.com/api-keys"
                target="_blank"
                variant="text"
                size="small"
                color="primary"
              >
                {{ $t('settings.openai.getApiKey') }}
                <v-icon end> mdi-open-in-new </v-icon>
              </v-btn>
            </div>
          </v-alert>

          <!-- Test Connection Button -->
          <v-btn
            :loading="testing"
            :disabled="!apiKey || apiKey.trim().length === 0"
            color="secondary"
            variant="outlined"
            class="mb-4"
            @click="testConnection"
          >
            <v-icon start> mdi-connection </v-icon>
            {{ $t('settings.openai.testConnection') }}
          </v-btn>

          <!-- Test Result Alert -->
          <v-alert
            v-if="testResult"
            :type="testResult.success ? 'success' : 'error'"
            variant="tonal"
            density="compact"
            class="mb-4"
            closable
            @click:close="testResult = null"
          >
            {{ testResult.message }}
            <div v-if="testResult.success && testResult.modelsAvailable" class="text-caption mt-1">
              {{ testResult.modelsAvailable }} models available
              <span v-if="testResult.hasGpt4oMini">(including gpt-4o-mini ✓)</span>
            </div>
          </v-alert>

          <!-- Model Selection (for future use) -->
          <v-text-field
            v-model="model"
            :label="$t('settings.openai.model')"
            :hint="$t('settings.openai.modelHint')"
            variant="outlined"
            density="comfortable"
            persistent-hint
            readonly
            disabled
          />
        </div>
      </v-card-text>

      <v-divider />

      <!-- Action Buttons -->
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="loadSettings">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn :loading="saving" color="primary" variant="elevated" @click="saveSettings">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Success/Error Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
const { t } = useI18n()

// Settings state
const apiKey = ref('')
const model = ref('gpt-4o-mini')
const showApiKey = ref(false)

// UI state
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{
  success: boolean
  message: string
  modelsAvailable?: number
  hasGpt4oMini?: boolean
} | null>(null)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

// Load settings on mount
onMounted(() => {
  loadSettings()
})

// Load settings from backend
async function loadSettings() {
  try {
    const settings = await $fetch<Record<string, string>>('/api/settings')

    // Use the full API key (not masked) for editing
    apiKey.value = settings.openai_api_key_full || ''
    model.value = settings.openai_model || 'gpt-4o-mini'
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error)
  }
}

// Save settings to backend
async function saveSettings() {
  saving.value = true
  testResult.value = null

  try {
    await $fetch('/api/settings', {
      method: 'POST',
      body: {
        openai_api_key: apiKey.value,
        openai_model: model.value,
      },
    })

    snackbar.value = {
      show: true,
      message: t('settings.saved'),
      color: 'success',
    }
  } catch (error) {
    const err = error as { data?: { message?: string } }
    console.error('[Settings] Failed to save settings:', error)
    snackbar.value = {
      show: true,
      message: err.data?.message || t('settings.saveFailed'),
      color: 'error',
    }
  } finally {
    saving.value = false
  }
}

// Test OpenAI connection
async function testConnection() {
  testing.value = true
  testResult.value = null

  try {
    const result = await $fetch<{
      success: boolean
      message: string
      modelsAvailable?: number
      hasGpt4oMini?: boolean
    }>('/api/settings/test-openai', {
      method: 'POST',
      body: {
        apiKey: apiKey.value,
      },
    })

    testResult.value = {
      success: true,
      message: t('settings.openai.testSuccess'),
      modelsAvailable: result.modelsAvailable,
      hasGpt4oMini: result.hasGpt4oMini,
    }
  } catch (error) {
    const err = error as { data?: { message?: string } }
    console.error('[Settings] Test connection failed:', error)
    testResult.value = {
      success: false,
      message: err.data?.message || t('settings.openai.testFailed'),
    }
  } finally {
    testing.value = false
  }
}
</script>
