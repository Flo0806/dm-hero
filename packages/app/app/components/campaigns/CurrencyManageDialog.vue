<template>
  <v-dialog v-model="dialogVisible" max-width="700" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-cash-multiple" class="mr-2" color="primary" />
        {{ $t('campaigns.currencies.title') }}
      </v-card-title>
      <v-card-subtitle>{{ $t('campaigns.currencies.subtitle') }}</v-card-subtitle>

      <v-card-text class="pt-4">
        <!-- Currency List -->
        <v-list v-if="currencies.length > 0" lines="two">
          <v-list-item
            v-for="currency in currencies"
            :key="currency.id"
            class="mb-2 rounded border"
          >
            <template #prepend>
              <v-avatar color="primary" size="40">
                <span class="text-body-1 font-weight-bold">{{ currency.symbol }}</span>
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ getCurrencyDisplayName(currency.name) }}
              <v-chip v-if="currency.is_default" size="x-small" color="primary" class="ml-2">
                {{ $t('campaigns.currencies.isDefault') }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ currency.code }} &bull; {{ $t('campaigns.currencies.exchangeRate') }}: {{ currency.exchange_rate }}
            </v-list-item-subtitle>

            <template #append>
              <v-btn icon="mdi-pencil" variant="text" size="small" @click="editCurrency(currency)" />
              <v-btn
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                @click="confirmDeleteCurrency(currency)"
              />
            </template>
          </v-list-item>
        </v-list>

        <!-- Empty State -->
        <div v-else class="text-center py-8 text-medium-emphasis">
          <v-icon icon="mdi-cash-remove" size="48" class="mb-2" />
          <p>{{ $t('campaigns.currencies.empty') }}</p>
          <p class="text-body-2">{{ $t('campaigns.currencies.emptyText') }}</p>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn prepend-icon="mdi-plus" color="primary" @click="addCurrency">
          {{ $t('campaigns.currencies.add') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="dialogVisible = false">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Add/Edit Currency Dialog -->
    <v-dialog v-model="showEditDialog" max-width="500" persistent>
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
          <v-btn variant="text" @click="closeEditDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!currencyForm.code || !currencyForm.name"
            :loading="saving"
            @click="saveCurrency"
          >
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('campaigns.currencies.deleteTitle') }}</v-card-title>
        <v-card-text>
          <p>{{ $t('campaigns.currencies.deleteConfirm', { name: deletingCurrency ? getCurrencyDisplayName(deletingCurrency.name) : '' }) }}</p>
          <v-alert
            v-if="deleteItemsAffected > 0"
            type="warning"
            variant="tonal"
            class="mt-3"
          >
            {{ $t('campaigns.currencies.deleteWarning', { count: deleteItemsAffected }) }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" :loading="deleting" @click="deleteCurrency">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
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

const { t, te } = useI18n()

// Default currency keys that have translations
const DEFAULT_CURRENCY_KEYS = ['copper', 'silver', 'gold', 'platinum']

// Translate currency name if it's a known key, otherwise return as-is
function getCurrencyDisplayName(name: string): string {
  if (DEFAULT_CURRENCY_KEYS.includes(name)) {
    const key = `campaigns.currencies.defaults.${name}`
    return te(key) ? t(key) : name
  }
  return name
}

const props = defineProps<{
  show: boolean
  campaignId: number
}>()

const emit = defineEmits<{
  'update:show': [boolean]
}>()

const dialogVisible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

// State
const currencies = ref<Currency[]>([])
const loading = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const editingCurrency = ref<Currency | null>(null)
const deletingCurrency = ref<Currency | null>(null)
const deleteItemsAffected = ref(0)
const saving = ref(false)
const deleting = ref(false)

const currencyForm = ref({
  code: '',
  name: '',
  symbol: '',
  exchange_rate: 1,
  is_default: false,
})

// Load currencies when dialog opens
watch(
  () => props.show,
  async (show) => {
    if (show && props.campaignId) {
      await loadCurrencies()
    }
  },
  { immediate: true },
)

async function loadCurrencies() {
  loading.value = true
  try {
    currencies.value = await $fetch<Currency[]>('/api/currencies', {
      query: { campaignId: props.campaignId },
    })
  } catch (error) {
    console.error('Failed to load currencies:', error)
  } finally {
    loading.value = false
  }
}

function addCurrency() {
  editingCurrency.value = null
  currencyForm.value = {
    code: '',
    name: '',
    symbol: '',
    exchange_rate: 1,
    is_default: false,
  }
  showEditDialog.value = true
}

function editCurrency(currency: Currency) {
  editingCurrency.value = currency
  currencyForm.value = {
    code: currency.code,
    // Show translated name in edit form for default currencies
    name: getCurrencyDisplayName(currency.name),
    symbol: currency.symbol || '',
    exchange_rate: currency.exchange_rate,
    is_default: Boolean(currency.is_default),
  }
  showEditDialog.value = true
}

function closeEditDialog() {
  showEditDialog.value = false
  editingCurrency.value = null
}

async function saveCurrency() {
  saving.value = true
  try {
    if (editingCurrency.value) {
      // Update existing
      await $fetch(`/api/currencies/${editingCurrency.value.id}`, {
        method: 'PATCH',
        body: currencyForm.value,
      })
    } else {
      // Create new
      await $fetch('/api/currencies', {
        method: 'POST',
        body: {
          campaignId: props.campaignId,
          ...currencyForm.value,
        },
      })
    }
    await loadCurrencies()
    closeEditDialog()
  } catch (error) {
    console.error('Failed to save currency:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDeleteCurrency(currency: Currency) {
  deletingCurrency.value = currency
  deleteItemsAffected.value = 0

  // Check how many items would be affected
  try {
    const result = await $fetch<{ itemsAffected: number }>(`/api/currencies/${currency.id}`, {
      method: 'DELETE',
      query: { dryRun: true },
    }).catch(() => ({ itemsAffected: 0 }))
    deleteItemsAffected.value = result.itemsAffected || 0
  } catch {
    // Ignore error, just show dialog
  }

  showDeleteDialog.value = true
}

async function deleteCurrency() {
  if (!deletingCurrency.value) return

  deleting.value = true
  try {
    await $fetch(`/api/currencies/${deletingCurrency.value.id}`, {
      method: 'DELETE',
    })
    await loadCurrencies()
    showDeleteDialog.value = false
    deletingCurrency.value = null
  } catch (error) {
    console.error('Failed to delete currency:', error)
  } finally {
    deleting.value = false
  }
}
</script>
