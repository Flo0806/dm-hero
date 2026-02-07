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
        <!-- AI Integration Section -->
        <div class="mb-6">
          <h2 class="text-h6 mb-4">
            {{ $t('settings.sections.ai') }}
          </h2>

          <!-- Provider Selection -->
          <v-select
            v-model="aiProvider"
            :items="providerOptions"
            item-title="title"
            item-value="value"
            :label="$t('settings.ai.provider')"
            :hint="$t('settings.ai.providerHint')"
            variant="outlined"
            density="comfortable"
            class="mb-4"
            persistent-hint
            autocomplete="off"
          />

          <!-- OpenAI API Key -->
          <v-text-field
            v-model="openaiApiKey"
            :label="$t('settings.ai.openaiApiKey')"
            :placeholder="$t('settings.ai.openaiApiKeyPlaceholder')"
            :hint="aiProvider === 'openai' ? $t('settings.ai.activeProvider') : ''"
            :type="showOpenaiKey ? 'text' : 'password'"
            variant="outlined"
            density="comfortable"
            class="mb-4"
            persistent-hint
            :color="aiProvider === 'openai' ? 'primary' : undefined"
          >
            <template #prepend-inner>
              <v-icon v-if="aiProvider === 'openai'" color="primary" size="small">mdi-check-circle</v-icon>
            </template>
            <template #append-inner>
              <v-btn
                :icon="showOpenaiKey ? 'mdi-eye-off' : 'mdi-eye'"
                variant="text"
                size="small"
                @click="showOpenaiKey = !showOpenaiKey"
              />
            </template>
            <template #details>
              <a href="https://platform.openai.com/api-keys" target="_blank" class="text-caption text-primary">
                {{ $t('settings.ai.openaiHowToGetKey') }}
                <v-icon size="x-small">mdi-open-in-new</v-icon>
              </a>
            </template>
          </v-text-field>

          <!-- Gemini API Key -->
          <v-text-field
            v-model="geminiApiKey"
            :label="$t('settings.ai.geminiApiKey')"
            :placeholder="$t('settings.ai.geminiApiKeyPlaceholder')"
            :hint="aiProvider === 'gemini' ? $t('settings.ai.activeProvider') : ''"
            :type="showGeminiKey ? 'text' : 'password'"
            variant="outlined"
            density="comfortable"
            class="mb-4"
            persistent-hint
            :color="aiProvider === 'gemini' ? 'primary' : undefined"
          >
            <template #prepend-inner>
              <v-icon v-if="aiProvider === 'gemini'" color="primary" size="small">mdi-check-circle</v-icon>
            </template>
            <template #append-inner>
              <v-btn
                :icon="showGeminiKey ? 'mdi-eye-off' : 'mdi-eye'"
                variant="text"
                size="small"
                @click="showGeminiKey = !showGeminiKey"
              />
            </template>
            <template #details>
              <a href="https://aistudio.google.com/apikey" target="_blank" class="text-caption text-primary">
                {{ $t('settings.ai.geminiHowToGetKey') }}
                <v-icon size="x-small">mdi-open-in-new</v-icon>
              </a>
            </template>
          </v-text-field>

          <!-- OpenAI Model -->
          <v-combobox
            v-if="aiProvider === 'openai'"
            v-model="openaiModel"
            :items="openaiModels"
            :label="$t('settings.ai.openaiModel')"
            :hint="$t('settings.ai.modelHint')"
            variant="outlined"
            density="comfortable"
            persistent-hint
            class="mb-4"
          />

          <!-- Gemini Model -->
          <v-combobox
            v-if="aiProvider === 'gemini'"
            v-model="geminiModel"
            :items="geminiModels"
            :label="$t('settings.ai.geminiModel')"
            :hint="$t('settings.ai.modelHint')"
            variant="outlined"
            density="comfortable"
            persistent-hint
            class="mb-4"
          />

          <!-- Test Connection Button -->
          <v-btn
            :loading="testing"
            :disabled="!activeApiKey || activeApiKey.trim().length === 0"
            color="secondary"
            variant="outlined"
            class="mb-4"
            @click="testConnection"
          >
            <v-icon start>mdi-connection</v-icon>
            {{ $t('settings.ai.testConnection') }}
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
              {{ testResult.modelsAvailable }} {{ $t('settings.ai.modelsAvailable') }}
            </div>
          </v-alert>
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

    <!-- Data Management Section (Electron only) -->
    <v-card v-if="isElectron" class="mt-6">
      <v-card-text>
        <div class="mb-6">
          <h2 class="text-h6 mb-2">
            {{ $t('settings.dataManagement.title') }}
          </h2>
          <p class="text-medium-emphasis text-body-2">
            {{ $t('settings.dataManagement.subtitle') }}
          </p>
        </div>

        <!-- Storage Path Info -->
        <v-alert v-if="dataPaths" type="info" variant="tonal" density="compact" class="mb-4">
          <div class="text-caption">
            <strong>{{ $t('settings.dataManagement.storagePath') }}:</strong><br />
            {{ dataPaths.databasePath }}
          </div>
        </v-alert>

        <!-- Export Database Button -->
        <div class="d-flex flex-column flex-sm-row">
          <v-btn
            :loading="exporting"
            color="secondary"
            variant="outlined"
            @click="exportDatabase"
          >
            <v-icon start>mdi-database-export</v-icon>
            {{ $t('settings.dataManagement.exportDatabase') }}
          </v-btn>

          <v-btn
            color="secondary"
            variant="outlined"
            class="ml-sm-4 mt-3 mt-sm-0"
            @click="openUploadsFolder"
          >
            <v-icon start>mdi-folder-image</v-icon>
            {{ $t('settings.dataManagement.openUploadsFolder') }}
          </v-btn>
        </div>

        <!-- Hints -->
        <div class="mt-3 text-caption text-medium-emphasis">
          <p>{{ $t('settings.dataManagement.exportDatabaseHint') }}</p>
          <p>{{ $t('settings.dataManagement.openUploadsFolderHint') }}</p>
        </div>
      </v-card-text>
    </v-card>

    <!-- Logs Section -->
    <v-card class="mt-6">
      <v-card-text>
        <div class="mb-4">
          <h2 class="text-h6 mb-2">
            {{ $t('settings.sections.logs') }}
          </h2>
          <p class="text-medium-emphasis text-body-2">
            {{ $t('settings.logs.subtitle') }}
          </p>
        </div>

        <!-- Log Path Info -->
        <v-alert v-if="logPath" type="info" variant="tonal" density="compact" class="mb-4">
          <div class="text-caption">
            <strong>{{ $t('settings.logs.logPath') }}:</strong><br />
            {{ logPath }}
          </div>
        </v-alert>

        <!-- Open Logs Folder Button (Electron only) -->
        <v-btn
          v-if="isElectron"
          color="secondary"
          variant="outlined"
          @click="openLogsFolder"
        >
          <v-icon start>mdi-folder-text</v-icon>
          {{ $t('settings.logs.openFolder') }}
        </v-btn>

        <div class="mt-2 text-caption text-medium-emphasis">
          {{ $t('settings.logs.hint') }}
        </div>
      </v-card-text>
    </v-card>

    <!-- Announcements Section -->
    <v-card class="mt-6">
      <v-card-text>
        <div class="mb-4">
          <h2 class="text-h6 mb-2">
            {{ $t('settings.sections.announcements') }}
          </h2>
        </div>

        <v-btn
          color="secondary"
          variant="outlined"
          :disabled="!hasSeenLatest"
          @click="resetAnnouncements"
        >
          <v-icon start>mdi-bell-ring</v-icon>
          {{ $t('announcements.resetButton') }}
        </v-btn>

        <div class="mt-2 text-caption text-medium-emphasis">
          {{ hasSeenLatest ? $t('settings.announcements.alreadySeen') : $t('settings.announcements.notSeen') }}
        </div>
      </v-card-text>
    </v-card>

    <!-- Success/Error Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { useAnnouncements } from '~/composables/useAnnouncements'
import { useElectron } from '~/composables/useElectron'

const { t } = useI18n()

// Announcements
const { resetAnnouncements: doResetAnnouncements, hasSeenLatest: checkHasSeenLatest } = useAnnouncements()
const hasSeenLatest = ref(true)

function resetAnnouncements() {
  doResetAnnouncements()
  hasSeenLatest.value = false
  snackbar.value = {
    show: true,
    message: t('announcements.resetSuccess'),
    color: 'success',
  }
}

function checkAnnouncementState() {
  hasSeenLatest.value = checkHasSeenLatest()
}

// Electron API detection
const electron = useElectron()
const dataPaths = ref<{ databasePath: string, uploadPath: string, logsPath: string } | null>(null)
const exporting = ref(false)
const logPath = ref<string | null>(null)
const isElectron = computed(() => electron.isElectron)

// Settings state
const aiProvider = ref<'openai' | 'gemini'>('openai')
const openaiApiKey = ref('')
const geminiApiKey = ref('')
const openaiModel = ref('gpt-4o-mini')
const geminiModel = ref('gemini-2.5-flash')
const showOpenaiKey = ref(false)
const showGeminiKey = ref(false)

const providerOptions = [
  { value: 'openai', title: 'OpenAI (GPT, DALL-E)' },
  { value: 'gemini', title: 'Google Gemini (Gemini, Imagen)' },
]

const openaiModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4.5-preview']
const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro']

const activeApiKey = computed(() =>
  aiProvider.value === 'openai' ? openaiApiKey.value : geminiApiKey.value,
)

// UI state
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{
  success: boolean
  message: string
  modelsAvailable?: number
} | null>(null)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
})

// Load settings on mount
onMounted(() => {
  loadSettings()
  checkElectron()
  checkAnnouncementState()
  loadLogPath()
})

// Load data paths (Electron only)
async function checkElectron() {
  if (electron.isElectron) {
    try {
      dataPaths.value = await electron.getDataPaths()
    }
    catch (error) {
      console.error('[Settings] Failed to get data paths:', error)
    }
  }
}

// Export database (Electron only)
async function exportDatabase() {
  if (!electron.isElectron) return

  exporting.value = true
  try {
    const result = await electron.exportDatabase()

    if (result.success) {
      snackbar.value = {
        show: true,
        message: t('settings.dataManagement.exportSuccess'),
        color: 'success',
      }
    }
    else if (result.canceled) {
      snackbar.value = {
        show: true,
        message: t('settings.dataManagement.exportCanceled'),
        color: 'info',
      }
    }
    else {
      snackbar.value = {
        show: true,
        message: `${t('settings.dataManagement.exportFailed')}: ${result.error}`,
        color: 'error',
      }
    }
  }
  catch (error) {
    console.error('[Settings] Export failed:', error)
    snackbar.value = {
      show: true,
      message: t('settings.dataManagement.exportFailed'),
      color: 'error',
    }
  }
  finally {
    exporting.value = false
  }
}

// Open uploads folder (Electron only)
async function openUploadsFolder() {
  if (!electron.isElectron) return

  try {
    const result = await electron.openUploadsFolder()

    if (!result.success) {
      snackbar.value = {
        show: true,
        message: `${t('settings.dataManagement.openFolderFailed')}: ${result.error}`,
        color: 'error',
      }
    }
  }
  catch (error) {
    console.error('[Settings] Open folder failed:', error)
    snackbar.value = {
      show: true,
      message: t('settings.dataManagement.openFolderFailed'),
      color: 'error',
    }
  }
}

// Load log path from backend
async function loadLogPath() {
  try {
    const result = await $fetch<{ logPath: string, logDir: string }>('/api/log-info/path')
    logPath.value = result.logPath
  }
  catch (error) {
    console.error('[Settings] Failed to load log path:', error)
  }
}

// Open logs folder (Electron only)
async function openLogsFolder() {
  if (!electron.isElectron) return

  try {
    const result = await electron.openLogsFolder()

    if (!result.success) {
      snackbar.value = {
        show: true,
        message: `${t('settings.logs.openFolderFailed')}: ${result.error}`,
        color: 'error',
      }
    }
  }
  catch (error) {
    console.error('[Settings] Open logs folder failed:', error)
    snackbar.value = {
      show: true,
      message: t('settings.logs.openFolderFailed'),
      color: 'error',
    }
  }
}

// Load settings from backend
async function loadSettings() {
  try {
    const settings = await $fetch<Record<string, string>>('/api/settings')

    aiProvider.value = (settings.ai_provider as 'openai' | 'gemini') || 'openai'
    openaiApiKey.value = settings.openai_api_key_full || ''
    geminiApiKey.value = settings.gemini_api_key_full || ''
    openaiModel.value = settings.openai_model || 'gpt-4o-mini'
    geminiModel.value = settings.gemini_model || 'gemini-2.5-flash'
  }
  catch (error) {
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
        ai_provider: aiProvider.value,
        openai_api_key: openaiApiKey.value,
        openai_model: openaiModel.value,
        gemini_api_key: geminiApiKey.value,
        gemini_model: geminiModel.value,
      },
    })

    snackbar.value = {
      show: true,
      message: t('settings.saved'),
      color: 'success',
    }
  }
  catch (error) {
    const err = error as { data?: { message?: string } }
    console.error('[Settings] Failed to save settings:', error)
    snackbar.value = {
      show: true,
      message: err.data?.message || t('settings.saveFailed'),
      color: 'error',
    }
  }
  finally {
    saving.value = false
  }
}

// Test AI connection
async function testConnection() {
  testing.value = true
  testResult.value = null

  try {
    const result = await $fetch<{
      success: boolean
      message: string
      modelsAvailable?: number
    }>('/api/settings/test-ai', {
      method: 'POST',
      body: {
        provider: aiProvider.value,
        apiKey: activeApiKey.value,
      },
    })

    testResult.value = {
      success: true,
      message: t('settings.ai.testSuccess'),
      modelsAvailable: result.modelsAvailable,
    }
  }
  catch (error) {
    const err = error as { data?: { message?: string } }
    console.error('[Settings] Test connection failed:', error)
    testResult.value = {
      success: false,
      message: err.data?.message || t('settings.ai.testFailed'),
    }
  }
  finally {
    testing.value = false
  }
}
</script>
