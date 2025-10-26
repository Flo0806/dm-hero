<template>
  <v-container>
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h1 class="text-h3 mb-2">
          {{ $t('campaigns.title') }}
        </h1>
        <p class="text-body-1 text-medium-emphasis">
          {{ $t('campaigns.subtitle') }}
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        size="large"
        @click="showCreateDialog = true"
      >
        {{ $t('campaigns.create') }}
      </v-btn>
    </div>

    <v-row v-if="pending">
      <v-col
        v-for="i in 3"
        :key="i"
        cols="12"
        md="6"
        lg="4"
      >
        <v-skeleton-loader type="card" />
      </v-col>
    </v-row>

    <v-row v-else-if="campaigns && campaigns.length > 0">
      <v-col
        v-for="campaign in campaigns"
        :key="campaign.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card
          hover
          class="h-100 d-flex flex-column"
          @click="selectCampaign(campaign)"
        >
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
            <v-btn
              variant="text"
              prepend-icon="mdi-pencil"
              @click.stop="editCampaign(campaign)"
            >
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

    <v-empty-state
      v-else
      icon="mdi-sword-cross"
      :title="$t('campaigns.empty')"
      :text="$t('campaigns.emptyText')"
    >
      <template #actions>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          {{ $t('campaigns.create') }}
        </v-btn>
      </template>
    </v-empty-state>

    <!-- Create/Edit Campaign Dialog -->
    <v-dialog
      v-model="showCreateDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>
          {{ editingCampaign ? $t('campaigns.edit') : $t('campaigns.create') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="campaignForm.name"
            :label="$t('campaigns.name')"
            :rules="[v => !!v || $t('campaigns.nameRequired')]"
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
          <v-btn
            variant="text"
            @click="closeDialog"
          >
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
    <v-dialog
      v-model="showDeleteDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>{{ $t('campaigns.deleteTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('campaigns.deleteConfirm', { name: deletingCampaign?.name }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeleteDialog = false"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="confirmDelete"
          >
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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

const { t } = useI18n()
const router = useRouter()

// Fetch campaigns
const { data: campaigns, pending, refresh } = await useFetch<Campaign[]>('/api/campaigns')

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

function selectCampaign(campaign: Campaign) {
  // Store selected campaign in localStorage
  localStorage.setItem('activeCampaignId', campaign.id.toString())
  localStorage.setItem('activeCampaignName', campaign.name)

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
  saving.value = true

  try {
    if (editingCampaign.value) {
      // Update existing campaign
      await $fetch(`/api/campaigns/${editingCampaign.value.id}`, {
        method: 'PATCH',
        body: campaignForm.value,
      })
    }
    else {
      // Create new campaign
      await $fetch('/api/campaigns', {
        method: 'POST',
        body: campaignForm.value,
      })
    }

    await refresh()
    closeDialog()
  }
  finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deletingCampaign.value)
    return

  deleting.value = true

  try {
    await $fetch(`/api/campaigns/${deletingCampaign.value.id}`, {
      method: 'DELETE',
    })

    await refresh()
    showDeleteDialog.value = false
    deletingCampaign.value = null
  }
  finally {
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
