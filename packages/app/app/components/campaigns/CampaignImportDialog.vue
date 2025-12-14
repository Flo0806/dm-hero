<template>
  <v-dialog v-model="dialogVisible" max-width="600" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-import</v-icon>
        {{ $t('campaigns.import.title') }}
      </v-card-title>

      <v-card-text>
        <!-- Step 1: File Upload -->
        <div v-if="step === 'upload'">
          <v-file-input
            v-model="selectedFile"
            accept=".dmhero"
            :label="$t('campaigns.import.selectFile')"
            prepend-icon="mdi-file-upload"
            variant="outlined"
            :error-messages="fileError"
            @update:model-value="onFileSelected"
          />

          <v-alert type="info" variant="tonal" density="compact" class="mt-2">
            {{ $t('campaigns.import.fileInfo') }}
          </v-alert>

          <!-- Error in upload step -->
          <v-alert v-if="error" type="error" variant="tonal" class="mt-2">
            {{ error }}
          </v-alert>
        </div>

        <!-- Step 2: Preview -->
        <div v-else-if="step === 'preview'">
          <!-- Loading -->
          <div v-if="parsing" class="d-flex justify-center py-8">
            <v-progress-circular indeterminate />
          </div>

          <!-- Preview Content -->
          <div v-else-if="preview">
            <v-alert type="success" variant="tonal" class="mb-4">
              <div class="font-weight-medium">{{ preview.campaignName }}</div>
              <div v-if="preview.description" class="text-body-2 mt-1">
                {{ preview.description }}
              </div>
            </v-alert>

            <!-- Stats -->
            <v-list density="compact" class="mb-4">
              <v-list-subheader>{{ $t('campaigns.import.contents') }}</v-list-subheader>

              <v-list-item v-if="preview.entityCounts.NPC">
                <template #prepend>
                  <v-icon size="small">mdi-account</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.entityCounts.NPC }} {{ $t('entityTypes.NPC') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.entityCounts.Location">
                <template #prepend>
                  <v-icon size="small">mdi-map-marker</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.entityCounts.Location }} {{ $t('entityTypes.Location') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.entityCounts.Item">
                <template #prepend>
                  <v-icon size="small">mdi-sword</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.entityCounts.Item }} {{ $t('entityTypes.Item') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.entityCounts.Faction">
                <template #prepend>
                  <v-icon size="small">mdi-shield-account</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.entityCounts.Faction }} {{ $t('entityTypes.Faction') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.entityCounts.Lore">
                <template #prepend>
                  <v-icon size="small">mdi-book-open-page-variant</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.entityCounts.Lore }} {{ $t('entityTypes.Lore') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.entityCounts.Player">
                <template #prepend>
                  <v-icon size="small">mdi-account-group</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.entityCounts.Player }} {{ $t('entityTypes.Player') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.sessionCount">
                <template #prepend>
                  <v-icon size="small">mdi-calendar</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.sessionCount }} {{ $t('nav.sessions') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.mapCount">
                <template #prepend>
                  <v-icon size="small">mdi-map</v-icon>
                </template>
                <v-list-item-title>
                  {{ preview.mapCount }} {{ $t('nav.maps') }}
                </v-list-item-title>
              </v-list-item>

              <v-list-item v-if="preview.hasCalendar">
                <template #prepend>
                  <v-icon size="small">mdi-calendar-month</v-icon>
                </template>
                <v-list-item-title>
                  {{ $t('nav.calendar') }}
                </v-list-item-title>
              </v-list-item>
            </v-list>

            <!-- Import Mode Selection -->
            <v-radio-group v-model="importMode" class="mb-4">
              <v-radio value="new">
                <template #label>
                  <div>
                    <div class="font-weight-medium">{{ $t('campaigns.import.modeNew') }}</div>
                    <div class="text-caption text-medium-emphasis">
                      {{ $t('campaigns.import.modeNewHint') }}
                    </div>
                  </div>
                </template>
              </v-radio>
              <v-radio value="merge" :disabled="!activeCampaign">
                <template #label>
                  <div>
                    <div class="font-weight-medium">
                      {{ $t('campaigns.import.modeMerge') }}
                      <span v-if="activeCampaign" class="text-primary">
                        "{{ activeCampaign.name }}"
                      </span>
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ activeCampaign
                        ? $t('campaigns.import.modeMergeHint')
                        : $t('campaigns.import.modeMergeNoActive')
                      }}
                    </div>
                  </div>
                </template>
              </v-radio>
            </v-radio-group>

            <!-- Campaign Name (only for new campaign) -->
            <v-text-field
              v-if="importMode === 'new'"
              v-model="campaignName"
              :label="$t('campaigns.import.campaignName')"
              variant="outlined"
              density="compact"
              :hint="$t('campaigns.import.nameHint')"
              persistent-hint
            />

            <!-- Merge Warning -->
            <v-alert
              v-if="importMode === 'merge'"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              {{ $t('campaigns.import.mergeInfo') }}
            </v-alert>

            <!-- Warnings -->
            <v-alert
              v-if="preview.warnings?.length"
              type="warning"
              variant="tonal"
              class="mt-4"
              density="compact"
            >
              <div v-for="warning in preview.warnings" :key="warning">
                {{ warning }}
              </div>
            </v-alert>
          </div>
        </div>

        <!-- Step 3: Importing -->
        <div v-else-if="step === 'importing'" class="text-center py-8">
          <v-progress-circular indeterminate size="64" class="mb-4" />
          <div class="text-h6">{{ $t('campaigns.import.importing') }}</div>
          <div class="text-body-2 text-medium-emphasis">
            {{ $t('campaigns.import.pleaseWait') }}
          </div>
        </div>

        <!-- Step 4: Success -->
        <div v-else-if="step === 'success'" class="text-center py-8">
          <v-icon size="64" color="success" class="mb-4">mdi-check-circle</v-icon>
          <div class="text-h6">{{ $t('campaigns.import.success') }}</div>
          <div class="text-body-2 text-medium-emphasis">
            {{ $t('campaigns.import.successDetails', importResult?.stats || {}) }}
          </div>
        </div>

        <!-- Error -->
        <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <!-- Upload Step -->
        <template v-if="step === 'upload'">
          <v-btn variant="text" @click="close">
            {{ $t('common.cancel') }}
          </v-btn>
        </template>

        <!-- Preview Step -->
        <template v-else-if="step === 'preview'">
          <v-btn variant="text" @click="goBack">
            {{ $t('common.back') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!preview || parsing"
            @click="doImport"
          >
            <v-icon start>mdi-import</v-icon>
            {{ $t('campaigns.import.importNow') }}
          </v-btn>
        </template>

        <!-- Success Step -->
        <template v-else-if="step === 'success'">
          <v-btn variant="text" @click="close">
            {{ $t('common.close') }}
          </v-btn>
          <v-btn v-if="importMode === 'new'" color="primary" variant="flat" @click="goToCampaign">
            {{ $t('campaigns.import.openCampaign') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { ImportResult } from '~~/types/export'

interface ImportPreview {
  campaignName: string
  description?: string
  exportType: 'full' | 'partial'
  entityCounts: Record<string, number>
  sessionCount: number
  mapCount: number
  hasCalendar: boolean
  warnings?: string[]
}

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: [campaignId: number]
}>()

const router = useRouter()
const campaignStore = useCampaignStore()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

type Step = 'upload' | 'preview' | 'importing' | 'success'
type ImportMode = 'new' | 'merge'

const step = ref<Step>('upload')
const selectedFile = ref<File | File[] | null>(null)
const fileError = ref('')
const parsing = ref(false)
const error = ref('')
const preview = ref<ImportPreview | null>(null)
const campaignName = ref('')
const importMode = ref<ImportMode>('new')
const importResult = ref<ImportResult | null>(null)
const importedCampaignId = ref<number | null>(null)

// Get current campaign for merge option
const activeCampaign = computed(() => campaignStore.currentCampaign)

// Parse the uploaded file to show preview
async function onFileSelected(filesOrFile: File[] | File | null) {
  console.log('[Import] onFileSelected called', filesOrFile)
  if (!filesOrFile) {
    console.log('[Import] No files selected')
    return
  }

  // Vuetify v-file-input can return File[] or File depending on version/config
  const file = Array.isArray(filesOrFile) ? filesOrFile[0] : filesOrFile
  if (!file) {
    console.log('[Import] No file in input')
    return
  }
  console.log('[Import] File:', file.name, file.size)

  if (!file.name.endsWith('.dmhero')) {
    fileError.value = 'Please select a .dmhero file'
    return
  }

  fileError.value = ''
  parsing.value = true
  step.value = 'preview'
  error.value = ''

  try {
    console.log('[Import] Loading JSZip...')
    // Read and parse the ZIP to extract manifest
    const JSZip = (await import('jszip')).default
    console.log('[Import] JSZip loaded, parsing file...')
    const zip = await JSZip.loadAsync(file)
    const manifestFile = zip.file('manifest.json')

    if (!manifestFile) {
      throw new Error('Invalid .dmhero file: manifest.json not found')
    }

    const manifestContent = await manifestFile.async('string')
    const manifest = JSON.parse(manifestContent)

    // Build preview
    const entityCounts: Record<string, number> = {}

    // For v1.1+: Use entityTypes from manifest if available
    // For v1.0: Use fallback mapping
    const fallbackTypeNames: Record<number, string> = {
      1: 'NPC',
      2: 'Location',
      3: 'Item',
      4: 'Faction',
      5: 'Quest',
      6: 'Lore',
      7: 'Player',
    }

    // Build type_id -> type_name mapping from manifest (v1.1+) or fallback
    const typeIdToName = new Map<number, string>()
    if (manifest.entityTypes) {
      for (const t of manifest.entityTypes) {
        typeIdToName.set(t.id, t.name)
      }
    } else {
      // Fallback for v1.0 exports
      for (const [id, name] of Object.entries(fallbackTypeNames)) {
        typeIdToName.set(Number(id), name)
      }
    }

    if (manifest.entities) {
      for (const entity of manifest.entities) {
        // v1.1+: Use type_name directly if available
        // v1.0: Look up from typeIdToName map
        const typeName = entity.type_name || typeIdToName.get(entity.type_id) || 'Unknown'
        entityCounts[typeName] = (entityCounts[typeName] || 0) + 1
      }
    }

    // Check for version-related warnings
    const warnings: string[] = []
    if (manifest.version && manifest.version !== '1.1' && manifest.version !== '1.0') {
      warnings.push(`Export format v${manifest.version} - may have compatibility issues`)
    }
    if (!manifest.entityTypes && manifest.version !== '1.0') {
      warnings.push('Export missing entity type mapping - using fallback')
    }

    preview.value = {
      campaignName: manifest.campaign?.name || 'Unnamed Campaign',
      description: manifest.campaign?.description,
      exportType: manifest.exportType || 'full',
      entityCounts,
      sessionCount: manifest.sessions?.length || 0,
      mapCount: manifest.maps?.length || 0,
      hasCalendar: !!manifest.calendar,
      warnings: warnings.length > 0 ? warnings : undefined,
    }

    campaignName.value = preview.value.campaignName
    console.log('[Import] Preview ready:', preview.value)
  } catch (err) {
    console.error('[Import] Error parsing file:', err)
    error.value = err instanceof Error ? err.message : 'Failed to parse file'
    step.value = 'upload'
  } finally {
    parsing.value = false
  }
}

// Perform the import
async function doImport() {
  if (!selectedFile.value) return

  // Handle both File and File[]
  const file = Array.isArray(selectedFile.value) ? selectedFile.value[0] : selectedFile.value
  if (!file) return

  // Validate merge mode has active campaign
  if (importMode.value === 'merge' && !activeCampaign.value) {
    error.value = 'No active campaign for merge'
    return
  }

  step.value = 'importing'
  error.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append(
      'options',
      JSON.stringify({
        mode: importMode.value,
        campaignName: importMode.value === 'new' ? campaignName.value : undefined,
        targetCampaignId: importMode.value === 'merge' ? activeCampaign.value?.id : undefined,
      }),
    )

    const result = await $fetch<ImportResult>('/api/campaigns/import', {
      method: 'POST',
      body: formData,
    })

    if (result.success) {
      importResult.value = result
      importedCampaignId.value = result.campaignId
      step.value = 'success'
    } else {
      throw new Error(result.errors?.join(', ') || 'Import failed')
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Import failed'
    step.value = 'preview'
  }
}

// Navigate to the imported campaign
async function goToCampaign() {
  if (importedCampaignId.value) {
    await campaignStore.setActiveCampaign(importedCampaignId.value)
    emit('imported', importedCampaignId.value)
    close()
    router.push('/')
  }
}

function goBack() {
  step.value = 'upload'
  preview.value = null
  error.value = ''
}

function close() {
  dialogVisible.value = false
  step.value = 'upload'
  selectedFile.value = null
  fileError.value = ''
  parsing.value = false
  error.value = ''
  preview.value = null
  campaignName.value = ''
  importMode.value = 'new'
  importResult.value = null
  importedCampaignId.value = null
}
</script>
