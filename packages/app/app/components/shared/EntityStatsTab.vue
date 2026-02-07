<template>
  <div>
    <v-progress-linear v-if="store.loading" indeterminate class="mb-3" />

    <!-- No template assigned -->
    <div v-else-if="!store.template" class="text-center py-8">
      <v-icon icon="mdi-clipboard-list-outline" size="48" color="grey" class="mb-4" />
      <p class="text-body-1 text-medium-emphasis mb-2">{{ $t('entityStats.noTemplate') }}</p>

      <template v-if="!readonly">
        <p class="text-body-2 text-medium-emphasis mb-6">{{ $t('entityStats.noTemplateHint') }}</p>

        <div class="d-flex justify-center align-center ga-3 mb-4">
          <v-select
            v-model="selectedTemplateId"
            :items="templateItems"
            :label="$t('entityStats.selectTemplate')"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 350px;"
          />
          <v-btn
            color="primary"
            :disabled="!selectedTemplateId"
            :loading="store.saving"
            @click="assignTemplate"
          >
            {{ $t('entityStats.assignTemplate') }}
          </v-btn>
        </div>

        <NuxtLink to="/reference-data" class="text-caption text-medium-emphasis">
          {{ $t('entityStats.createTemplateLink') }}
        </NuxtLink>
      </template>
    </div>

    <!-- Template assigned -->
    <template v-else>
      <!-- Header -->
      <div class="d-flex align-center ga-2 mb-4">
        <v-icon icon="mdi-clipboard-list-outline" size="small" />
        <span class="text-subtitle-1 font-weight-medium">{{ store.template.name }}</span>
        <v-chip v-if="store.template.system_key" size="x-small" variant="tonal" color="primary">
          {{ store.template.system_key }}
        </v-chip>
        <v-spacer />
        <template v-if="!readonly">
          <v-btn
            icon="mdi-swap-horizontal"
            variant="text"
            size="small"
            @click="showChangeDialog = true"
          >
            <v-icon>mdi-swap-horizontal</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('entityStats.changeTemplate') }}</v-tooltip>
          </v-btn>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="showRemoveDialog = true"
          >
            <v-icon>mdi-delete</v-icon>
            <v-tooltip activator="parent" location="bottom">{{ $t('entityStats.removeTemplate') }}</v-tooltip>
          </v-btn>
        </template>
      </div>

      <!-- Groups -->
      <div v-for="group in store.template.groups" :key="group.id" class="mb-4">
        <v-card variant="outlined">
          <v-card-title class="text-subtitle-2 py-2 px-4">
            {{ resolveLabel(group.name) }}
            <v-chip size="x-small" variant="tonal" class="ml-2">
              {{ $t(`statTemplates.groups.types.${group.group_type}`, group.group_type) }}
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-card-text class="pa-3">
            <!-- Attributes: grid -->
            <v-row v-if="group.group_type === 'attributes'" dense>
              <v-col
                v-for="f in group.fields"
                :key="f.id"
                cols="6"
                sm="4"
                md="3"
                lg="2"
              >
                <div class="text-center pa-2 rounded stat-cell">
                  <div class="text-caption text-medium-emphasis mb-1">{{ resolveLabel(f.label) }}</div>
                  <!-- Number -->
                  <template v-if="f.field_type === 'number'">
                    <template v-if="readonly">
                      <div class="text-h5 font-weight-bold">{{ getNumberParsed(f.name).value || '—' }}</div>
                      <div v-if="f.has_modifier" class="d-flex justify-center mt-1">
                        <v-chip size="small" variant="tonal">{{ formatModifier(getNumberParsed(f.name).modifier) }}</v-chip>
                      </div>
                    </template>
                    <template v-else>
                      <v-text-field
                        :model-value="getNumberParsed(f.name).value"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="centered-input"
                        @update:model-value="(v: string) => onNumberChange(f, Number(v) || 0, getNumberParsed(f.name).modifier)"
                      />
                      <v-text-field
                        v-if="f.has_modifier"
                        :model-value="getNumberParsed(f.name).modifier"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        :label="$t('entityStats.modifier')"
                        class="centered-input mt-2"
                        @update:model-value="(v: string) => onModifierChange(f, getNumberParsed(f.name).value, Number(v) || 0)"
                      />
                    </template>
                  </template>
                  <!-- String -->
                  <template v-else-if="f.field_type === 'string'">
                    <div v-if="readonly" class="text-body-1">{{ store.localValues[f.name] || '—' }}</div>
                    <v-text-field
                      v-else
                      :model-value="String(store.localValues[f.name] ?? '')"
                      variant="outlined"
                      density="compact"
                      hide-details
                      @update:model-value="(v: string) => store.setFieldValue(f.name, v)"
                    />
                  </template>
                  <!-- Boolean -->
                  <template v-else-if="f.field_type === 'boolean'">
                    <v-checkbox
                      :model-value="!!store.localValues[f.name]"
                      hide-details
                      density="compact"
                      class="d-flex justify-center mt-0 pt-0"
                      @update:model-value="(v: boolean | null) => onToggleBoolean(f.name, !!v)"
                    />
                  </template>
                  <!-- Resource -->
                  <template v-else-if="f.field_type === 'resource'">
                    <template v-if="readonly">
                      <div class="d-flex align-center justify-center ga-1">
                        <v-text-field
                          :model-value="getResource(f.name).current"
                          type="number"
                          variant="outlined"
                          density="compact"
                          hide-details
                          class="centered-input"
                          style="max-width: 70px;"
                          @update:model-value="(v: string) => onResourceCurrentChange(f.name, Number(v) || 0)"
                        />
                        <span class="text-body-2 text-medium-emphasis">/ {{ getResource(f.name).max }}</span>
                      </div>
                    </template>
                    <template v-else>
                      <div class="d-flex ga-2">
                        <v-text-field
                          :model-value="getResource(f.name).current"
                          type="number"
                          variant="outlined"
                          density="compact"
                          hide-details
                          :label="$t('entityStats.current')"
                          @update:model-value="(v: string) => store.setResourceValue(f.name, Number(v) || 0, getResource(f.name).max)"
                        />
                        <v-text-field
                          :model-value="getResource(f.name).max"
                          type="number"
                          variant="outlined"
                          density="compact"
                          hide-details
                          :label="$t('entityStats.max')"
                          @update:model-value="(v: string) => store.setResourceValue(f.name, getResource(f.name).current, Number(v) || 0)"
                        />
                      </div>
                    </template>
                    <v-progress-linear
                      v-if="getResource(f.name).max"
                      :model-value="getResourcePct(f.name)"
                      :color="getResourceColor(f.name)"
                      height="4"
                      rounded
                      class="mt-2"
                    />
                  </template>
                </div>
              </v-col>
            </v-row>

            <!-- Resources: wider cards -->
            <v-row v-else-if="group.group_type === 'resources'" dense>
              <v-col
                v-for="f in group.fields"
                :key="f.id"
                cols="12"
                sm="6"
                md="4"
              >
                <div class="pa-3 rounded stat-cell">
                  <div class="text-caption text-medium-emphasis mb-1">{{ resolveLabel(f.label) }}</div>
                  <!-- Resource -->
                  <template v-if="f.field_type === 'resource'">
                    <template v-if="readonly">
                      <div class="d-flex align-center ga-2">
                        <v-text-field
                          :model-value="getResource(f.name).current"
                          type="number"
                          variant="outlined"
                          density="compact"
                          hide-details
                          :label="$t('entityStats.current')"
                          style="max-width: 100px;"
                          @update:model-value="(v: string) => onResourceCurrentChange(f.name, Number(v) || 0)"
                        />
                        <span class="text-body-2 text-medium-emphasis">/ {{ getResource(f.name).max }}</span>
                      </div>
                    </template>
                    <template v-else>
                      <div class="d-flex ga-2">
                        <v-text-field
                          :model-value="getResource(f.name).current"
                          type="number"
                          variant="outlined"
                          density="compact"
                          hide-details
                          :label="$t('entityStats.current')"
                          @update:model-value="(v: string) => store.setResourceValue(f.name, Number(v) || 0, getResource(f.name).max)"
                        />
                        <v-text-field
                          :model-value="getResource(f.name).max"
                          type="number"
                          variant="outlined"
                          density="compact"
                          hide-details
                          :label="$t('entityStats.max')"
                          @update:model-value="(v: string) => store.setResourceValue(f.name, getResource(f.name).current, Number(v) || 0)"
                        />
                      </div>
                    </template>
                    <v-progress-linear
                      v-if="getResource(f.name).max"
                      :model-value="getResourcePct(f.name)"
                      :color="getResourceColor(f.name)"
                      height="4"
                      rounded
                      class="mt-2"
                    />
                  </template>
                  <!-- Number -->
                  <template v-else-if="f.field_type === 'number'">
                    <template v-if="readonly">
                      <div class="text-h6 font-weight-bold">{{ getNumberParsed(f.name).value || '—' }}</div>
                      <div v-if="f.has_modifier" class="mt-1">
                        <v-chip size="small" variant="tonal">{{ formatModifier(getNumberParsed(f.name).modifier) }}</v-chip>
                      </div>
                    </template>
                    <template v-else>
                      <v-text-field
                        :model-value="getNumberParsed(f.name).value"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="centered-input"
                        @update:model-value="(v: string) => onNumberChange(f, Number(v) || 0, getNumberParsed(f.name).modifier)"
                      />
                      <v-text-field
                        v-if="f.has_modifier"
                        :model-value="getNumberParsed(f.name).modifier"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        :label="$t('entityStats.modifier')"
                        class="centered-input mt-2"
                        @update:model-value="(v: string) => onModifierChange(f, getNumberParsed(f.name).value, Number(v) || 0)"
                      />
                    </template>
                  </template>
                  <!-- Boolean -->
                  <template v-else-if="f.field_type === 'boolean'">
                    <v-checkbox
                      :model-value="!!store.localValues[f.name]"
                      hide-details
                      density="compact"
                      @update:model-value="(v: boolean | null) => onToggleBoolean(f.name, !!v)"
                    />
                  </template>
                  <!-- String -->
                  <template v-else-if="f.field_type === 'string'">
                    <div v-if="readonly" class="text-body-1">{{ store.localValues[f.name] || '—' }}</div>
                    <v-text-field
                      v-else
                      :model-value="String(store.localValues[f.name] ?? '')"
                      variant="outlined"
                      density="compact"
                      hide-details
                      @update:model-value="(v: string) => store.setFieldValue(f.name, v)"
                    />
                  </template>
                </div>
              </v-col>
            </v-row>

            <!-- All other types: compact rows -->
            <div v-else>
              <div
                v-for="f in group.fields"
                :key="f.id"
                class="d-flex align-center ga-3 py-2 px-2 rounded field-row"
              >
                <span class="text-body-2 font-weight-medium" style="min-width: 140px;">
                  {{ resolveLabel(f.label) }}
                </span>
                <!-- Number -->
                <template v-if="f.field_type === 'number'">
                  <template v-if="readonly">
                    <span class="text-body-1 font-weight-bold">{{ getNumberParsed(f.name).value || '—' }}</span>
                    <v-chip v-if="f.has_modifier" size="small" variant="tonal">
                      {{ formatModifier(getNumberParsed(f.name).modifier) }}
                    </v-chip>
                  </template>
                  <template v-else>
                    <v-text-field
                      :model-value="getNumberParsed(f.name).value"
                      type="number"
                      variant="outlined"
                      density="compact"
                      hide-details
                      class="centered-input"
                      style="max-width: 100px;"
                      @update:model-value="(v: string) => onNumberChange(f, Number(v) || 0, getNumberParsed(f.name).modifier)"
                    />
                    <v-text-field
                      v-if="f.has_modifier"
                      :model-value="getNumberParsed(f.name).modifier"
                      type="number"
                      variant="outlined"
                      density="compact"
                      hide-details
                      :label="$t('entityStats.modifier')"
                      class="centered-input"
                      style="max-width: 80px;"
                      @update:model-value="(v: string) => onModifierChange(f, getNumberParsed(f.name).value, Number(v) || 0)"
                    />
                  </template>
                </template>
                <!-- String -->
                <template v-else-if="f.field_type === 'string'">
                  <span v-if="readonly" class="text-body-2">{{ store.localValues[f.name] || '—' }}</span>
                  <v-text-field
                    v-else
                    :model-value="String(store.localValues[f.name] ?? '')"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="flex-grow-1"
                    @update:model-value="(v: string) => store.setFieldValue(f.name, v)"
                  />
                </template>
                <!-- Boolean -->
                <template v-else-if="f.field_type === 'boolean'">
                  <v-checkbox
                    :model-value="!!store.localValues[f.name]"
                    hide-details
                    density="compact"
                    @update:model-value="(v: boolean | null) => onToggleBoolean(f.name, !!v)"
                  />
                </template>
                <!-- Resource -->
                <template v-else-if="f.field_type === 'resource'">
                  <template v-if="readonly">
                    <div class="d-flex align-center ga-2">
                      <v-text-field
                        :model-value="getResource(f.name).current"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        :label="$t('entityStats.current')"
                        style="max-width: 80px;"
                        @update:model-value="(v: string) => onResourceCurrentChange(f.name, Number(v) || 0)"
                      />
                      <span class="text-body-2 text-medium-emphasis">/ {{ getResource(f.name).max }}</span>
                    </div>
                  </template>
                  <template v-else>
                    <div class="d-flex ga-2" style="max-width: 240px;">
                      <v-text-field
                        :model-value="getResource(f.name).current"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        :label="$t('entityStats.current')"
                        @update:model-value="(v: string) => store.setResourceValue(f.name, Number(v) || 0, getResource(f.name).max)"
                      />
                      <v-text-field
                        :model-value="getResource(f.name).max"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        :label="$t('entityStats.max')"
                        @update:model-value="(v: string) => store.setResourceValue(f.name, getResource(f.name).current, Number(v) || 0)"
                      />
                    </div>
                  </template>
                </template>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Character Sheet Section -->
      <v-divider class="my-4" />
      <div class="d-flex align-center ga-2 mb-3">
        <v-icon icon="mdi-file-pdf-box" size="small" />
        <span class="text-subtitle-2">{{ $t('entityStats.characterSheet') }}</span>
        <v-spacer />
        <template v-if="!readonly">
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="store.characterSheets.length > 0 ? 'mdi-swap-horizontal' : 'mdi-upload'"
            :loading="uploadingPdf"
            @click="triggerPdfUpload"
          >
            {{ store.characterSheets.length > 0 ? $t('entityStats.replaceCharacterSheet') : $t('entityStats.uploadCharacterSheet') }}
          </v-btn>
          <input
            ref="pdfFileInput"
            type="file"
            accept="application/pdf"
            style="display: none"
            @change="handlePdfUpload"
          />
        </template>
      </div>

      <template v-if="store.characterSheets.length > 0">
        <v-card v-for="sheet in store.characterSheets" :key="sheet.id" variant="outlined" class="mb-3">
          <v-card-title class="d-flex align-center text-subtitle-2 py-2 px-4">
            <v-icon icon="mdi-file-pdf-box" color="error" class="mr-2" size="small" />
            {{ sheet.title }}
            <v-spacer />
            <v-btn icon="mdi-eye" variant="text" size="x-small" @click="previewPdf(sheet)">
              <v-icon>mdi-eye</v-icon>
              <v-tooltip activator="parent" location="bottom">{{ $t('documents.previewPdf') }}</v-tooltip>
            </v-btn>
            <v-btn icon="mdi-download" variant="text" size="x-small" @click="downloadPdf(sheet)">
              <v-icon>mdi-download</v-icon>
              <v-tooltip activator="parent" location="bottom">{{ $t('common.download') }}</v-tooltip>
            </v-btn>
            <v-btn v-if="!readonly" icon="mdi-delete" variant="text" size="x-small" color="error" @click="deleteSheet(sheet)">
              <v-icon>mdi-delete</v-icon>
              <v-tooltip activator="parent" location="bottom">{{ $t('common.delete') }}</v-tooltip>
            </v-btn>
          </v-card-title>
        </v-card>
      </template>
      <div v-else class="text-center text-medium-emphasis py-4">
        {{ $t('entityStats.noCharacterSheet') }}
      </div>
    </template>

    <!-- PDF Preview Dialog -->
    <v-dialog v-model="showPdfPreview" max-width="1200" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-file-pdf-box" class="mr-2" />
          {{ viewingPdf?.title }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="showPdfPreview = false" />
        </v-card-title>
        <v-divider />
        <v-card-text style="height: 80vh; overflow-y: auto">
          <ClientOnly>
            <VuePdfEmbed
              v-if="viewingPdf?.file_path"
              :source="`/documents/${viewingPdf.file_path}`"
              class="pdf-viewer"
            />
          </ClientOnly>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn prepend-icon="mdi-download" color="primary" variant="text" @click="downloadPdf(viewingPdf!)">
            {{ $t('common.download') }}
          </v-btn>
          <v-btn variant="text" @click="showPdfPreview = false">
            {{ $t('common.close') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Change Template Dialog -->
    <v-dialog v-model="showChangeDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t('entityStats.changeTemplate') }}</v-card-title>
        <v-card-text>
          <p class="mb-4">{{ $t('entityStats.changeTemplateConfirm') }}</p>
          <v-select
            v-model="changeTemplateId"
            :items="changeTemplateItems"
            :label="$t('entityStats.selectTemplate')"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showChangeDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :disabled="!changeTemplateId" :loading="store.saving" @click="confirmChangeTemplate">
            {{ $t('entityStats.changeTemplate') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Remove Template Dialog -->
    <v-dialog v-model="showRemoveDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('entityStats.removeTemplate') }}</v-card-title>
        <v-card-text>{{ $t('entityStats.removeTemplateConfirm') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRemoveDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" :loading="store.saving" @click="removeStats">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import type { StatTemplateField, StatResourceValue, StatNumberWithModifier } from '~~/types/stat-template'
import { useSnackbarStore } from '~/stores/snackbar'
import { useEntityStatsStore } from '~/stores/entityStats'
import { useStatTemplatesStore } from '~/stores/statTemplates'

const VuePdfEmbed = defineAsyncComponent(() => import('vue-pdf-embed'))

interface DocumentInfo {
  id: number
  title: string
  file_path?: string
}

const props = defineProps<{
  entityId: number
  readonly?: boolean
}>()

const emit = defineEmits<{
  changed: []
}>()

const { t } = useI18n()
const store = useEntityStatsStore()
const templatesStore = useStatTemplatesStore()
const snackbarStore = useSnackbarStore()
const { showUploadError, showDownloadError } = useErrorHandler()

// Local UI state
const selectedTemplateId = ref<number | null>(null)
const showChangeDialog = ref(false)
const changeTemplateId = ref<number | null>(null)
const showRemoveDialog = ref(false)
const uploadingPdf = ref(false)
const pdfFileInput = ref<HTMLInputElement | null>(null)
const showPdfPreview = ref(false)
const viewingPdf = ref<DocumentInfo | null>(null)

const templateItems = computed(() =>
  templatesStore.templates.map(tmpl => ({
    value: tmpl.id,
    title: tmpl.name,
  })),
)

// Same list but without the currently active template (for change dialog)
const changeTemplateItems = computed(() =>
  templateItems.value.filter(item => item.value !== store.template?.id),
)

// Dirty check: are there unsaved value changes?
const isDirty = computed(() => {
  if (!store.stats) return false
  return JSON.stringify(store.localValues) !== JSON.stringify(store.stats.values)
})

// ============================================================================
// Expose saveStats so the parent dialog can call it on save
// ============================================================================
async function saveStats() {
  if (!isDirty.value) return
  await store.saveValues()
}

defineExpose({ saveStats, isDirty })

// ============================================================================
// Value helpers
// ============================================================================
function getNumberParsed(fieldName: string): { value: number, modifier: number } {
  const val = store.localValues[fieldName]
  if (val && typeof val === 'object' && 'value' in val) {
    const obj = val as StatNumberWithModifier
    return { value: obj.value ?? 0, modifier: obj.modifier ?? 0 }
  }
  return { value: val != null ? Number(val) : 0, modifier: 0 }
}

function getResource(fieldName: string): StatResourceValue {
  const val = store.localValues[fieldName]
  if (val && typeof val === 'object' && 'current' in val) {
    return val as StatResourceValue
  }
  return { current: 0, max: 0 }
}

function getResourcePct(fieldName: string): number {
  const res = getResource(fieldName)
  return res.max ? Math.min(100, Math.max(0, (res.current / res.max) * 100)) : 0
}

function getResourceColor(fieldName: string): string {
  const pct = getResourcePct(fieldName)
  return pct > 50 ? 'success' : pct > 25 ? 'warning' : 'error'
}

function resolveLabel(label: string): string {
  return label.startsWith('statPresets.') ? t(label) : label
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : String(mod)
}

// ============================================================================
// Field change handlers
// ============================================================================
function onNumberChange(field: StatTemplateField, value: number, modifier: number) {
  if (field.has_modifier) {
    store.setNumberWithModifier(field.name, value, modifier)
  }
  else {
    store.setFieldValue(field.name, value)
  }
}

function onModifierChange(field: StatTemplateField, value: number, modifier: number) {
  store.setNumberWithModifier(field.name, value, modifier)
}

async function onToggleBoolean(fieldName: string, value: boolean) {
  await store.toggleBoolean(fieldName, value)
  emit('changed')
}

let resourceSaveTimer: ReturnType<typeof setTimeout> | null = null

function onResourceCurrentChange(fieldName: string, current: number) {
  store.setResourceValue(fieldName, current, getResource(fieldName).max)
  if (resourceSaveTimer) clearTimeout(resourceSaveTimer)
  resourceSaveTimer = setTimeout(async () => {
    await store.saveValues()
    emit('changed')
  }, 100)
}

// ============================================================================
// Template actions
// ============================================================================
async function assignTemplate() {
  if (!selectedTemplateId.value) return
  await store.assignTemplate(selectedTemplateId.value)
  snackbarStore.success(t('entityStats.saved'))
  emit('changed')
}

async function confirmChangeTemplate() {
  if (!changeTemplateId.value) return
  await store.changeTemplate(changeTemplateId.value)
  showChangeDialog.value = false
  changeTemplateId.value = null
  snackbarStore.success(t('entityStats.saved'))
  emit('changed')
}

async function removeStats() {
  await store.removeStats()
  showRemoveDialog.value = false
  snackbarStore.success(t('entityStats.removed'))
  emit('changed')
}

// ============================================================================
// Character Sheet PDF
// ============================================================================
function triggerPdfUpload() {
  pdfFileInput.value?.click()
}

async function handlePdfUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadingPdf.value = true
  try {
    await store.uploadCharacterSheet(props.entityId, file)
    emit('changed')
  }
  catch (error) {
    console.error('PDF upload failed:', error)
    showUploadError('pdf')
  }
  finally {
    uploadingPdf.value = false
    if (target) target.value = ''
  }
}

function previewPdf(doc: DocumentInfo) {
  viewingPdf.value = doc
  showPdfPreview.value = true
}

function downloadPdf(doc: DocumentInfo) {
  if (!doc.file_path) return
  try {
    const link = document.createElement('a')
    link.href = `/documents/${doc.file_path}?download=1`
    link.download = `${doc.title}.pdf`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  catch (error) {
    console.error('Failed to download PDF:', error)
    showDownloadError()
  }
}

async function deleteSheet(doc: DocumentInfo) {
  try {
    await store.deleteCharacterSheet(props.entityId, doc.id)
    emit('changed')
  }
  catch (e) {
    console.error('Failed to delete character sheet:', e)
  }
}

// ============================================================================
// Lifecycle
// ============================================================================
// Always reload when mounted (template may have changed externally)
onMounted(() => {
  store.load(props.entityId)
})

watch(() => props.entityId, (id) => {
  store.load(id)
})
</script>

<style scoped>
.stat-cell {
  border: 1px solid rgba(var(--v-border-color), 0.12);
}

.field-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.centered-input :deep(input) {
  text-align: center;
}

.pdf-viewer {
  width: 100%;
  min-height: 600px;
}
</style>
