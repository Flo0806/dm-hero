<template>
  <v-card elevation="0" class="profile-card">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon icon="mdi-book-multiple" class="mr-2" />
        {{ $t('profile.adventures.title') }}
      </div>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-plus"
        to="/store/upload"
      >
        {{ $t('profile.adventures.create') }}
      </v-btn>
    </v-card-title>

    <v-card-text>
      <!-- Loading -->
      <div v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <!-- Empty State -->
      <div v-else-if="adventures.length === 0" class="text-center py-8">
        <v-icon icon="mdi-book-open-blank-variant" size="64" color="medium-emphasis" class="mb-4" />
        <p class="text-body-1 text-medium-emphasis mb-4">
          {{ $t('profile.adventures.empty') }}
        </p>
        <v-btn color="primary" variant="tonal" to="/store/upload" prepend-icon="mdi-plus">
          {{ $t('profile.adventures.createFirst') }}
        </v-btn>
      </div>

      <!-- Adventures List -->
      <v-list v-else class="adventures-list">
        <v-list-item
          v-for="adventure in adventures"
          :key="adventure.id"
          class="adventure-item mb-3"
          rounded
        >
          <template #prepend>
            <v-img
              v-if="adventure.coverImageUrl"
              :src="adventure.coverImageUrl"
              width="80"
              height="50"
              cover
              class="rounded mr-4"
            />
            <div
              v-else
              class="cover-placeholder rounded mr-4 d-flex align-center justify-center"
            >
              <v-icon icon="mdi-image" />
            </div>
          </template>

          <v-list-item-title class="font-weight-medium">
            {{ adventure.title }}
          </v-list-item-title>

          <v-list-item-subtitle class="d-flex align-center ga-3 mt-1">
            <span>
              <v-icon icon="mdi-download" size="x-small" />
              {{ adventure.downloadCount }}
            </span>
            <span>
              <v-icon icon="mdi-star" size="x-small" color="amber" />
              {{ adventure.avgRating?.toFixed(1) || '0.0' }}
            </span>
            <v-chip
              :color="getStatusColor(adventure.status)"
              size="x-small"
              variant="tonal"
            >
              {{ $t(`profile.adventures.status.${adventure.status}`) }}
            </v-chip>
          </v-list-item-subtitle>

          <template #append>
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-btn
                  icon="mdi-dots-vertical"
                  variant="text"
                  size="small"
                  v-bind="menuProps"
                />
              </template>
              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-eye"
                  :to="`/store/${adventure.slug}`"
                >
                  <v-list-item-title>{{ $t('profile.adventures.view') }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-pencil"
                  disabled
                >
                  <v-list-item-title>{{ $t('profile.adventures.edit') }}</v-list-item-title>
                  <v-list-item-subtitle>{{ $t('profile.adventures.comingSoon') }}</v-list-item-subtitle>
                </v-list-item>
                <v-divider />
                <v-list-item
                  prepend-icon="mdi-delete"
                  base-color="error"
                  @click="confirmDelete(adventure)"
                >
                  <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('profile.adventures.deleteConfirm.title') }}</v-card-title>
        <v-card-text>
          {{ $t('profile.adventures.deleteConfirm.message', { title: adventureToDelete?.title }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn color="error" variant="flat" @click="handleDelete">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
interface Adventure {
  id: number
  title: string
  slug: string
  coverImageUrl: string | null
  downloadCount: number
  avgRating: number | null
  status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
}

defineProps<{
  adventures: Adventure[]
  loading: boolean
}>()

const emit = defineEmits<{
  delete: [adventureId: number]
}>()

const deleteDialog = ref(false)
const adventureToDelete = ref<Adventure | null>(null)

function getStatusColor(status: string) {
  switch (status) {
    case 'published': return 'success'
    case 'draft': return 'grey'
    case 'pending_review': return 'warning'
    case 'rejected': return 'error'
    case 'archived': return 'grey'
    default: return 'grey'
  }
}

function confirmDelete(adventure: Adventure) {
  adventureToDelete.value = adventure
  deleteDialog.value = true
}

function handleDelete() {
  if (adventureToDelete.value) {
    emit('delete', adventureToDelete.value.id)
  }
  deleteDialog.value = false
  adventureToDelete.value = null
}
</script>

<style scoped>
.profile-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.adventures-list {
  background: transparent;
}

.adventure-item {
  background: rgba(var(--v-theme-surface), 0.5);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.cover-placeholder {
  width: 80px;
  height: 50px;
  background: rgba(var(--v-theme-surface-variant), 0.5);
}
</style>
