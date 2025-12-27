<template>
  <v-container>
    <UiPageHeader :title="$t('referenceData.title')" :subtitle="$t('referenceData.subtitle')" />

    <v-tabs v-model="tab" class="mb-6">
      <v-tab value="currencies">
        <v-icon start> mdi-cash-multiple </v-icon>
        {{ $t('campaigns.currencies.title') }}
      </v-tab>
      <v-tab value="races">
        <v-icon start> mdi-human </v-icon>
        {{ $t('referenceData.races') }}
      </v-tab>
      <v-tab value="classes">
        <v-icon start> mdi-sword-cross </v-icon>
        {{ $t('referenceData.classes') }}
      </v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <!-- Currencies Tab -->
      <v-tabs-window-item value="currencies">
        <div v-if="!activeCampaignId" class="text-center py-8">
          <v-icon icon="mdi-alert-circle-outline" size="48" color="warning" class="mb-4" />
          <p class="text-body-1">{{ $t('referenceData.noCampaignSelected') }}</p>
        </div>
        <div v-else>
          <div class="d-flex justify-end mb-4">
            <v-btn color="primary" prepend-icon="mdi-plus" @click="showCurrencyDialog = true">
              {{ $t('campaigns.currencies.add') }}
            </v-btn>
          </div>

          <v-data-table
            :headers="currencyHeaders"
            :items="sortedCurrencies"
            :loading="currenciesLoading"
            :sort-by="[]"
          >
            <template #[`item.sort`]="{ item, index }">
              <div class="d-flex">
                <v-btn
                  icon="mdi-chevron-up"
                  variant="text"
                  size="x-small"
                  :disabled="index === 0"
                  @click="moveCurrency(item, 'up')"
                />
                <v-btn
                  icon="mdi-chevron-down"
                  variant="text"
                  size="x-small"
                  :disabled="index === sortedCurrencies.length - 1"
                  @click="moveCurrency(item, 'down')"
                />
              </div>
            </template>
            <template #[`item.name`]="{ item }">
              {{ getCurrencyDisplayName(item.name) }}
              <v-chip v-if="item.is_default" size="x-small" color="primary" class="ml-2">
                {{ $t('campaigns.currencies.isDefault') }}
              </v-chip>
            </template>
            <template #[`item.actions`]="{ item }">
              <v-btn icon="mdi-pencil" variant="text" size="small" @click="editCurrency(item)" />
              <v-btn
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                @click="confirmDeleteCurrency(item)"
              />
            </template>
          </v-data-table>
        </div>
      </v-tabs-window-item>

      <!-- Races Tab -->
      <v-tabs-window-item value="races">
        <div class="d-flex justify-end mb-4">
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openRaceDialog()">
            {{ $t('referenceData.createRace') }}
          </v-btn>
        </div>

        <v-data-table :headers="raceHeaders" :items="races || []" :loading="racesPending">
          <template #[`item.name`]="{ item }">
            <div class="d-flex align-center gap-2">
              <span>{{ item.name }}</span>
              <v-chip
                v-if="item.is_standard"
                size="x-small"
                color="primary"
                variant="tonal"
              >
                {{ $t('referenceData.standard') }}
              </v-chip>
              <v-chip v-else size="x-small" color="success" variant="tonal">
                {{ $t('referenceData.custom') }}
              </v-chip>
            </div>
          </template>
          <template #[`item.actions`]="{ item }">
            <div class="d-flex justify-end">
              <!-- Standard races cannot be edited/deleted -->
              <template v-if="!item.is_standard">
                <v-btn icon="mdi-pencil" variant="text" size="small" @click="openRaceDialog(item)" />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="deleteRace(item)"
                />
              </template>
              <template v-else>
                <v-tooltip location="top">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" icon="mdi-lock" size="small" color="grey" class="mr-2" />
                  </template>
                  {{ $t('referenceData.standardProtected') }}
                </v-tooltip>
              </template>
            </div>
          </template>
        </v-data-table>
      </v-tabs-window-item>

      <!-- Classes Tab -->
      <v-tabs-window-item value="classes">
        <div class="d-flex justify-end mb-4">
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openClassDialog()">
            {{ $t('referenceData.createClass') }}
          </v-btn>
        </div>

        <v-data-table :headers="classHeaders" :items="classes || []" :loading="classesPending">
          <template #[`item.name`]="{ item }">
            <div class="d-flex align-center gap-2">
              <span>{{ item.name }}</span>
              <v-chip
                v-if="item.is_standard"
                size="x-small"
                color="primary"
                variant="tonal"
              >
                {{ $t('referenceData.standard') }}
              </v-chip>
              <v-chip v-else size="x-small" color="success" variant="tonal">
                {{ $t('referenceData.custom') }}
              </v-chip>
            </div>
          </template>
          <template #[`item.actions`]="{ item }">
            <div class="d-flex justify-end">
              <!-- Standard classes cannot be edited/deleted -->
              <template v-if="!item.is_standard">
                <v-btn icon="mdi-pencil" variant="text" size="small" @click="openClassDialog(item)" />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  color="error"
                  @click="deleteClass(item)"
                />
              </template>
              <template v-else>
                <v-tooltip location="top">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" icon="mdi-lock" size="small" color="grey" class="mr-2" />
                  </template>
                  {{ $t('referenceData.standardProtected') }}
                </v-tooltip>
              </template>
            </div>
          </template>
        </v-data-table>
      </v-tabs-window-item>
    </v-tabs-window>

    <!-- Race Dialog -->
    <v-dialog v-model="showRaceDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{ editingRace ? $t('referenceData.editRace') : $t('referenceData.createRace') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="raceForm.name"
            :label="$t('referenceData.name')"
            :rules="keyRules"
            variant="outlined"
            :hint="$t('referenceData.keyHint')"
            persistent-hint
            maxlength="20"
            class="mb-4"
            @input="raceForm.name = sanitizeKey(raceForm.name)"
          />

          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-2">
            {{ $t('referenceData.translations') }}
          </div>

          <v-text-field
            v-model="raceForm.name_de"
            label="Name (Deutsch)"
            :rules="[(v) => !!v || $t('referenceData.translationRequired')]"
            variant="outlined"
            class="mb-4"
          />
          <v-text-field
            v-model="raceForm.name_en"
            label="Name (English)"
            :rules="[(v) => !!v || $t('referenceData.translationRequired')]"
            variant="outlined"
            class="mb-4"
          />

          <v-alert type="info" density="compact" class="mb-4">
            {{ $t('referenceData.translationHint') }}
          </v-alert>

          <v-textarea
            v-model="raceForm.description"
            :label="$t('referenceData.description')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeRaceDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :disabled="!raceForm.name" :loading="saving" @click="saveRace">
            {{ editingRace ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Class Dialog -->
    <v-dialog v-model="showClassDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{ editingClass ? $t('referenceData.editClass') : $t('referenceData.createClass') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="classForm.name"
            :label="$t('referenceData.name')"
            :rules="keyRules"
            variant="outlined"
            :hint="$t('referenceData.keyHint')"
            persistent-hint
            maxlength="20"
            class="mb-4"
            @input="classForm.name = sanitizeKey(classForm.name)"
          />

          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-2">
            {{ $t('referenceData.translations') }}
          </div>

          <v-text-field
            v-model="classForm.name_de"
            label="German (DE)"
            :rules="[(v) => !!v || $t('referenceData.translationRequired')]"
            variant="outlined"
            class="mb-2"
          />

          <v-text-field
            v-model="classForm.name_en"
            label="English (EN)"
            :rules="[(v) => !!v || $t('referenceData.translationRequired')]"
            variant="outlined"
            class="mb-4"
          />

          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            {{ $t('referenceData.translationHint') }}
          </v-alert>

          <v-textarea
            v-model="classForm.description"
            :label="$t('referenceData.description')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeClassDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" :disabled="!classForm.name" :loading="saving" @click="saveClass">
            {{ editingClass ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Success Snackbar -->
    <v-snackbar v-model="showSuccess" color="success" :timeout="3000">
      {{ successMessage }}
    </v-snackbar>

    <!-- Error Snackbar -->
    <v-snackbar v-model="showError" color="error" :timeout="5000">
      {{ errorMessage }}
    </v-snackbar>

    <!-- Currency Edit Dialog -->
    <v-dialog v-model="showCurrencyDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>
          {{ editingCurrency ? $t('campaigns.currencies.edit') : $t('campaigns.currencies.add') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="currencyForm.code"
            :label="$t('campaigns.currencies.code')"
            :placeholder="$t('campaigns.currencies.codePlaceholder')"
            variant="outlined"
            class="mb-3"
            :rules="[(v) => !!v || $t('campaigns.nameRequired')]"
            maxlength="10"
          />
          <v-text-field
            v-model="currencyForm.name"
            :label="$t('campaigns.currencies.name')"
            :placeholder="$t('campaigns.currencies.namePlaceholder')"
            variant="outlined"
            class="mb-3"
            :rules="[(v) => !!v || $t('campaigns.nameRequired')]"
          />
          <v-text-field
            v-model="currencyForm.symbol"
            :label="$t('campaigns.currencies.symbol')"
            :placeholder="$t('campaigns.currencies.symbolPlaceholder')"
            variant="outlined"
            class="mb-3"
            maxlength="10"
          />
          <v-text-field
            v-model.number="currencyForm.exchange_rate"
            :label="$t('campaigns.currencies.exchangeRate')"
            :hint="$t('campaigns.currencies.exchangeRateHint')"
            persistent-hint
            variant="outlined"
            type="number"
            min="1"
            class="mb-3"
          />
          <v-switch
            v-model="currencyForm.is_default"
            :label="$t('campaigns.currencies.isDefault')"
            color="primary"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeCurrencyDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!currencyForm.code || !currencyForm.name"
            :loading="savingCurrency"
            @click="saveCurrency"
          >
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Currency Delete Dialog -->
    <v-dialog v-model="showCurrencyDeleteDialog" max-width="450">
      <v-card>
        <v-card-title>{{ $t('campaigns.currencies.deleteTitle') }}</v-card-title>
        <v-card-text>
          <p>{{ $t('campaigns.currencies.deleteConfirm', { name: deletingCurrency ? getCurrencyDisplayName(deletingCurrency.name) : '' }) }}</p>
          <v-alert
            v-if="deletingCurrencyItemCount > 0"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-4"
          >
            {{ $t('campaigns.currencies.deleteWarning', { count: deletingCurrencyItemCount }) }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCurrencyDeleteDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" :loading="deletingCurrencyLoading" @click="deleteCurrency">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { useCampaignStore } from '~/stores/campaign'

interface ReferenceData {
  id: number
  name: string
  name_de?: string | null
  name_en?: string | null
  is_standard?: number
  description: string | null
  created_at: string
}

interface Currency {
  id: number
  campaign_id: number
  code: string
  name: string
  symbol: string | null
  exchange_rate: number
  sort_order: number
  is_default: number
  created_at: string
}

const { t } = useI18n()
const campaignStore = useCampaignStore()
const tab = ref('currencies')

// Key validation: lowercase letters and underscores only, max 20 chars
function sanitizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z_]/g, '') // Only allow a-z and underscore
    .slice(0, 20)
}

const keyRules = [
  (v: string) => !!v || t('referenceData.nameRequired'),
  (v: string) => /^[a-z_]+$/.test(v) || t('referenceData.keyInvalid'),
  (v: string) => v.length <= 20 || t('referenceData.keyTooLong'),
]

// Campaign-specific data
const activeCampaignId = computed(() => campaignStore.activeCampaignId)

// Fetch data with caching (not campaign-specific, can be cached globally)
const {
  data: races,
  pending: racesPending,
  refresh: refreshRaces,
} = await useFetch<ReferenceData[]>('/api/races', {
  key: 'races',
  getCachedData: (key) => useNuxtApp().static.data[key],
})
const {
  data: classes,
  pending: classesPending,
  refresh: refreshClasses,
} = await useFetch<ReferenceData[]>('/api/classes', {
  key: 'classes',
  getCachedData: (key) => useNuxtApp().static.data[key],
})

// Table headers
const raceHeaders = [
  { title: t('referenceData.name'), key: 'name', sortable: true },
  { title: t('referenceData.description'), key: 'description', sortable: false },
  { title: t('common.actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const classHeaders = [
  { title: t('referenceData.name'), key: 'name', sortable: true },
  { title: t('referenceData.description'), key: 'description', sortable: false },
  { title: t('common.actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const currencyHeaders = [
  { title: '', key: 'sort', sortable: false, width: '70px' },
  { title: t('campaigns.currencies.code'), key: 'code', sortable: false },
  { title: t('campaigns.currencies.name'), key: 'name', sortable: false },
  { title: t('campaigns.currencies.symbol'), key: 'symbol', sortable: false },
  { title: t('campaigns.currencies.exchangeRate'), key: 'exchange_rate', sortable: false },
  { title: t('common.actions'), key: 'actions', sortable: false, align: 'end' as const },
]

// Currency state
const currencies = ref<Currency[]>([])
const currenciesLoading = ref(false)

// Sorted currencies by sort_order
const sortedCurrencies = computed(() => {
  return [...currencies.value].sort((a, b) => a.sort_order - b.sort_order)
})
const showCurrencyDialog = ref(false)
const showCurrencyDeleteDialog = ref(false)
const editingCurrency = ref<Currency | null>(null)
const deletingCurrency = ref<Currency | null>(null)
const deletingCurrencyItemCount = ref(0)
const savingCurrency = ref(false)
const deletingCurrencyLoading = ref(false)
const currencyForm = ref({
  code: '',
  name: '',
  symbol: '',
  exchange_rate: 1,
  is_default: false,
})

// Load currencies when campaign changes
watch(
  activeCampaignId,
  async (newId) => {
    if (newId) {
      await loadCurrencies()
    } else {
      currencies.value = []
    }
  },
  { immediate: true },
)

async function loadCurrencies() {
  if (!activeCampaignId.value) return

  currenciesLoading.value = true
  try {
    currencies.value = await $fetch<Currency[]>('/api/currencies', {
      query: { campaignId: activeCampaignId.value },
    })
  } catch (error) {
    console.error('Failed to load currencies:', error)
    currencies.value = []
  } finally {
    currenciesLoading.value = false
  }
}

// Helper to translate default currency names
function getCurrencyDisplayName(name: string): string {
  const defaultNames = ['copper', 'silver', 'gold', 'platinum']
  if (defaultNames.includes(name.toLowerCase())) {
    return t(`campaigns.currencies.defaults.${name.toLowerCase()}`)
  }
  return name
}

function editCurrency(currency: Currency) {
  editingCurrency.value = currency
  currencyForm.value = {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol || '',
    exchange_rate: currency.exchange_rate,
    is_default: Boolean(currency.is_default),
  }
  showCurrencyDialog.value = true
}

async function confirmDeleteCurrency(currency: Currency) {
  deletingCurrency.value = currency
  deletingCurrencyItemCount.value = 0

  // Check how many items use this currency
  try {
    const usage = await $fetch<{ itemCount: number }>(`/api/currencies/${currency.id}/usage`)
    deletingCurrencyItemCount.value = usage.itemCount
  } catch (error) {
    console.error('Failed to check currency usage:', error)
  }

  showCurrencyDeleteDialog.value = true
}

function closeCurrencyDialog() {
  showCurrencyDialog.value = false
  editingCurrency.value = null
  currencyForm.value = {
    code: '',
    name: '',
    symbol: '',
    exchange_rate: 1,
    is_default: false,
  }
}

async function saveCurrency() {
  if (!activeCampaignId.value) return

  savingCurrency.value = true
  try {
    if (editingCurrency.value) {
      await $fetch(`/api/currencies/${editingCurrency.value.id}`, {
        method: 'PATCH',
        body: {
          ...currencyForm.value,
          is_default: currencyForm.value.is_default ? 1 : 0,
        },
      })
    } else {
      await $fetch('/api/currencies', {
        method: 'POST',
        body: {
          campaignId: activeCampaignId.value,
          ...currencyForm.value,
          is_default: currencyForm.value.is_default ? 1 : 0,
        },
      })
    }

    await loadCurrencies()
    closeCurrencyDialog()
    successMessage.value = t('common.saved')
    showSuccess.value = true
  } catch (error) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || t('referenceData.saveError')
    showError.value = true
  } finally {
    savingCurrency.value = false
  }
}

async function deleteCurrency() {
  if (!deletingCurrency.value) return

  deletingCurrencyLoading.value = true
  try {
    await $fetch(`/api/currencies/${deletingCurrency.value.id}`, {
      method: 'DELETE',
    })
    await loadCurrencies()
    showCurrencyDeleteDialog.value = false
    deletingCurrency.value = null
  } catch (error) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || t('referenceData.deleteError')
    showError.value = true
  } finally {
    deletingCurrencyLoading.value = false
  }
}

async function moveCurrency(currency: Currency, direction: 'up' | 'down') {
  const sorted = sortedCurrencies.value
  const currentIndex = sorted.findIndex((c) => c.id === currency.id)
  if (currentIndex === -1) return

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= sorted.length) return

  const targetCurrency = sorted[targetIndex]
  if (!targetCurrency) return

  // Swap sort_order values
  try {
    await Promise.all([
      $fetch(`/api/currencies/${currency.id}`, {
        method: 'PATCH',
        body: { sort_order: targetCurrency.sort_order },
      }),
      $fetch(`/api/currencies/${targetCurrency.id}`, {
        method: 'PATCH',
        body: { sort_order: currency.sort_order },
      }),
    ])
    await loadCurrencies()
  } catch (error) {
    console.error('Failed to reorder currencies:', error)
    errorMessage.value = t('referenceData.saveError')
    showError.value = true
  }
}

// Race form state
const showRaceDialog = ref(false)
const editingRace = ref<ReferenceData | null>(null)
const saving = ref(false)
const raceForm = ref({
  name: '',
  name_de: '',
  name_en: '',
  description: '',
})

// Class form state
const showClassDialog = ref(false)
const editingClass = ref<ReferenceData | null>(null)
const classForm = ref({
  name: '',
  name_de: '',
  name_en: '',
  description: '',
})

// Delete state
const showDeleteDialog = ref(false)
const deleting = ref(false)
const deleteDialogTitle = ref('')
const deleteDialogMessage = ref('')
const deleteType = ref<'race' | 'class'>('race')
const deletingId = ref<number | null>(null)

// Success handling
const showSuccess = ref(false)
const successMessage = ref('')

// Error handling
const showError = ref(false)
const errorMessage = ref('')

function openRaceDialog(race?: ReferenceData) {
  if (race) {
    editingRace.value = race
    raceForm.value = {
      name: race.name,
      name_de: race.name_de || '',
      name_en: race.name_en || '',
      description: race.description || '',
    }
  } else {
    editingRace.value = null
    raceForm.value = {
      name: '',
      name_de: '',
      name_en: '',
      description: '',
    }
  }
  showRaceDialog.value = true
}

function closeRaceDialog() {
  showRaceDialog.value = false
  editingRace.value = null
  raceForm.value = {
    name: '',
    name_de: '',
    name_en: '',
    description: '',
  }
}

function openClassDialog(classData?: ReferenceData) {
  if (classData) {
    editingClass.value = classData
    classForm.value = {
      name: classData.name,
      name_de: classData.name_de || '',
      name_en: classData.name_en || '',
      description: classData.description || '',
    }
  } else {
    editingClass.value = null
    classForm.value = {
      name: '',
      name_de: '',
      name_en: '',
      description: '',
    }
  }
  showClassDialog.value = true
}

function closeClassDialog() {
  showClassDialog.value = false
  editingClass.value = null
  classForm.value = {
    name: '',
    name_de: '',
    name_en: '',
    description: '',
  }
}

async function saveRace() {
  saving.value = true

  try {
    if (editingRace.value) {
      await $fetch(`/api/races/${editingRace.value.id}`, {
        method: 'PATCH',
        body: raceForm.value,
      })
      successMessage.value = t('referenceData.races') + ' ' + t('common.save').toLowerCase()
    } else {
      await $fetch('/api/races', {
        method: 'POST',
        body: raceForm.value,
      })
      successMessage.value = t('referenceData.races') + ' ' + t('common.create').toLowerCase()
    }

    await refreshRaces()
    closeRaceDialog()
    showSuccess.value = true
  } catch (error) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || t('referenceData.saveError')
    showError.value = true
  } finally {
    saving.value = false
  }
}

async function saveClass() {
  saving.value = true

  try {
    if (editingClass.value) {
      await $fetch(`/api/classes/${editingClass.value.id}`, {
        method: 'PATCH',
        body: classForm.value,
      })
      successMessage.value = t('referenceData.classes') + ' ' + t('common.save').toLowerCase()
    } else {
      await $fetch('/api/classes', {
        method: 'POST',
        body: classForm.value,
      })
      successMessage.value = t('referenceData.classes') + ' ' + t('common.create').toLowerCase()
    }

    await refreshClasses()
    closeClassDialog()
    showSuccess.value = true
  } catch (error) {
    const err = error as { data?: { message?: string } }
    errorMessage.value = err.data?.message || t('referenceData.saveError')
    showError.value = true
  } finally {
    saving.value = false
  }
}

function deleteRace(race: ReferenceData) {
  deleteType.value = 'race'
  deletingId.value = race.id
  deleteDialogTitle.value = t('referenceData.deleteRaceTitle')
  deleteDialogMessage.value = t('referenceData.deleteRaceConfirm', { name: race.name })
  showDeleteDialog.value = true
}

function deleteClass(classData: ReferenceData) {
  deleteType.value = 'class'
  deletingId.value = classData.id
  deleteDialogTitle.value = t('referenceData.deleteClassTitle')
  deleteDialogMessage.value = t('referenceData.deleteClassConfirm', { name: classData.name })
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingId.value) return

  deleting.value = true

  try {
    if (deleteType.value === 'race') {
      await $fetch(`/api/races/${deletingId.value}`, {
        method: 'DELETE',
      })
      await refreshRaces()
    } else {
      await $fetch(`/api/classes/${deletingId.value}`, {
        method: 'DELETE',
      })
      await refreshClasses()
    }

    showDeleteDialog.value = false
    deletingId.value = null
  } catch (error) {
    const err = error as { data?: { message?: string; data?: { code?: string; count?: number } } }
    const errData = err.data?.data

    // Translate specific error codes
    if (errData?.code === 'RACE_IN_USE') {
      errorMessage.value = t('referenceData.raceInUse', { count: errData.count })
    } else if (errData?.code === 'CLASS_IN_USE') {
      errorMessage.value = t('referenceData.classInUse', { count: errData.count })
    } else {
      errorMessage.value = t('referenceData.deleteError')
    }
    showError.value = true
  } finally {
    deleting.value = false
  }
}
</script>
