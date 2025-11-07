<template>
  <v-container>
    <UiPageHeader :title="$t('campaigns.title')" :subtitle="$t('campaigns.subtitle')">
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          size="large"
          @click="showCreateDialog = true"
        >
          {{ $t('campaigns.create') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <v-row v-if="pending">
      <v-col v-for="i in 3" :key="i" cols="12" md="6" lg="4">
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <v-row v-else-if="campaigns && campaigns.length > 0">
      <v-col v-for="campaign in campaigns" :key="campaign.id" cols="12" md="6" lg="4">
        <v-card hover class="h-100 d-flex flex-column" @click="selectCampaign(campaign)">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-sword-cross" class="mr-2" color="primary" />
            {{ campaign.name }}
          </v-card-title>
          <v-card-text class="flex-grow-1">
            <div v-if="campaign.description" class="text-body-2 mb-4">
              {{ campaign.description }}
            </div>
            <div v-else class="text-body-2 text-disabled mb-4">
              {{ $t('campaigns.noDescription') }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ $t('campaigns.created') }}: {{ formatDate(campaign.created_at) }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" prepend-icon="mdi-pencil" @click.stop="editCampaign(campaign)">
              {{ $t('common.edit') }}
            </v-btn>
            <v-spacer />
            <v-btn
              variant="text"
              color="error"
              prepend-icon="mdi-delete"
              @click.stop="deleteCampaign(campaign)"
            >
              {{ $t('common.delete') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <ClientOnly v-else>
      <v-empty-state
        icon="mdi-sword-cross"
        :title="$t('campaigns.empty')"
        :text="$t('campaigns.emptyText')"
      >
        <template #actions>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('campaigns.create') }}
          </v-btn>
        </template>
      </v-empty-state>
      <template #fallback>
        <v-container class="text-center py-16">
          <v-icon icon="mdi-sword-cross" size="64" color="grey" class="mb-4" />
          <h2 class="text-h5 mb-2">{{ $t('campaigns.empty') }}</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">{{ $t('campaigns.emptyText') }}</p>
          <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
            {{ $t('campaigns.create') }}
          </v-btn>
        </v-container>
      </template>
    </ClientOnly>

    <!-- Create/Edit Campaign Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="600">
      <v-card>
        <v-card-title>
          {{ editingCampaign ? $t('campaigns.edit') : $t('campaigns.create') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="campaignForm.name"
            :label="$t('campaigns.name')"
            :rules="[(v) => !!v || $t('campaigns.nameRequired')]"
            variant="outlined"
            class="mb-4"
          />
          <v-textarea
            v-model="campaignForm.description"
            :label="$t('campaigns.description')"
            variant="outlined"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!campaignForm.name"
            :loading="saving"
            @click="saveCampaign"
          >
            {{ editingCampaign ? $t('common.save') : $t('common.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <UiDeleteConfirmDialog
      v-model="showDeleteDialog"
      :title="$t('campaigns.deleteTitle')"
      :message="$t('campaigns.deleteConfirm', { name: deletingCampaign?.name })"
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </v-container>
</template>

<script setup lang="ts">
interface Campaign {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

const router = useRouter()
const campaignStore = useCampaignStore()
const entitiesStore = useEntitiesStore()

// Load campaigns from store
onMounted(async () => {
  await campaignStore.loadCampaigns()
})

const campaigns = computed(() => campaignStore.campaigns)
const pending = computed(() => campaignStore.loading)

// Form state
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const editingCampaign = ref<Campaign | null>(null)
const deletingCampaign = ref<Campaign | null>(null)
const saving = ref(false)
const deleting = ref(false)

const campaignForm = ref({
  name: '',
  description: '',
})

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function selectCampaign(campaign: Campaign) {
  // Set active campaign in store
  campaignStore.setActiveCampaign(campaign.id)

  // Clear old entities when switching campaigns
  entitiesStore.clearAll()

  // Navigate to main app
  router.push('/')
}

function editCampaign(campaign: Campaign) {
  editingCampaign.value = campaign
  campaignForm.value = {
    name: campaign.name,
    description: campaign.description || '',
  }
  showCreateDialog.value = true
}

function deleteCampaign(campaign: Campaign) {
  deletingCampaign.value = campaign
  showDeleteDialog.value = true
}

async function saveCampaign() {
  if (!campaignForm.value.name) return

  saving.value = true

  try {
    if (editingCampaign.value) {
      // Update existing campaign via store
      await campaignStore.updateCampaign(editingCampaign.value.id, campaignForm.value)
    } else {
      // Create new campaign via store
      await campaignStore.createCampaign(campaignForm.value)
    }

    closeDialog()
  } catch (error) {
    console.error('Failed to save campaign:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingCampaign.value) return

  deleting.value = true

  try {
    await campaignStore.deleteCampaign(deletingCampaign.value.id)
    showDeleteDialog.value = false
    deletingCampaign.value = null
  } catch (error) {
    console.error('Failed to delete campaign:', error)
  } finally {
    deleting.value = false
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingCampaign.value = null
  campaignForm.value = {
    name: '',
    description: '',
  }
}
</script>
