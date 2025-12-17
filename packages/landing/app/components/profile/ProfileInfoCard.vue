<template>
  <v-card elevation="0" class="profile-card">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-account-edit" class="mr-2" />
      {{ $t('profile.info.title') }}
    </v-card-title>

    <v-card-text>
      <!-- Avatar Upload -->
      <div class="text-center mb-6">
        <div class="avatar-upload-container">
          <v-avatar size="100" color="primary" class="avatar-preview">
            <v-img v-if="user?.avatarUrl" :src="user.avatarUrl" />
            <span v-else class="text-h4">{{ initials }}</span>
          </v-avatar>
          <v-btn
            icon="mdi-camera"
            size="small"
            color="primary"
            variant="elevated"
            elevation="4"
            class="avatar-upload-btn"
            @click="triggerFileInput"
          />
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            hidden
            @change="onFileSelected"
          />
        </div>
        <p class="text-caption text-medium-emphasis mt-2">
          {{ $t('profile.info.avatarHint') }}
        </p>
      </div>

      <v-divider class="mb-4" />

      <!-- Display Name -->
      <v-text-field
        v-model="displayName"
        :label="$t('auth.displayName')"
        variant="outlined"
        density="comfortable"
        prepend-inner-icon="mdi-account"
        class="mb-4"
      />

      <!-- Email (readonly) -->
      <v-text-field
        :model-value="user?.email"
        :label="$t('auth.email')"
        variant="outlined"
        density="comfortable"
        prepend-inner-icon="mdi-email"
        readonly
        disabled
        class="mb-2"
      />
      <p class="text-caption text-medium-emphasis mb-4">
        <v-icon icon="mdi-information" size="x-small" />
        {{ $t('profile.info.emailReadonly') }}
      </p>

      <!-- Save Button -->
      <v-btn
        color="primary"
        block
        :loading="loading"
        :disabled="!hasChanges"
        @click="handleSave"
      >
        {{ $t('common.save') }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { AuthUser } from '~/stores/authStore'

const props = defineProps<{
  user: AuthUser | null
  loading: boolean
}>()

const emit = defineEmits<{
  update: [data: { displayName: string }]
  uploadAvatar: [file: File]
}>()

const fileInputRef = ref<HTMLInputElement>()
const displayName = ref(props.user?.displayName || '')

const initials = computed(() => {
  if (!props.user?.displayName) return '?'
  return props.user.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const hasChanges = computed(() => {
  return displayName.value !== props.user?.displayName
})

watch(() => props.user?.displayName, (newVal) => {
  if (newVal) displayName.value = newVal
})

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('uploadAvatar', file)
  }
  // Reset input so same file can be selected again
  input.value = ''
}

function handleSave() {
  emit('update', { displayName: displayName.value })
}
</script>

<style scoped>
.profile-card {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.avatar-upload-container {
  position: relative;
  display: inline-block;
}

.avatar-preview {
  border: 3px solid rgb(var(--v-theme-primary));
}

.avatar-upload-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  border: 2px solid rgb(var(--v-theme-surface)) !important;
}
</style>
