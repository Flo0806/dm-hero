<template>
  <div class="auth-page">
    <StoreBackground />
    <div class="auth-container">
      <!-- Logo -->
      <div class="text-center mb-8">
        <v-icon icon="mdi-lock-reset" size="64" color="primary" class="mb-4" />
        <h1 class="text-h4 font-weight-light">{{ $t('auth.resetPassword.title') }}</h1>
        <p class="text-body-2 text-medium-emphasis mt-2">
          {{ $t('auth.resetPassword.subtitle') }}
        </p>
      </div>

      <!-- No Token Error -->
      <v-card v-if="!token" class="auth-card" elevation="0">
        <v-card-text class="pa-8 text-center">
          <v-icon icon="mdi-alert-circle" size="64" color="error" class="mb-4" />
          <h2 class="text-h6 mb-2">{{ $t('auth.resetPassword.invalidLink') }}</h2>
          <p class="text-body-2 text-medium-emphasis mb-6">
            {{ $t('auth.resetPassword.invalidLinkMessage') }}
          </p>
          <v-btn
            color="primary"
            to="/forgot-password"
          >
            {{ $t('auth.resetPassword.requestNew') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Success Message -->
      <v-card v-else-if="success" class="auth-card" elevation="0">
        <v-card-text class="pa-8 text-center">
          <v-icon icon="mdi-check-circle" size="64" color="success" class="mb-4" />
          <h2 class="text-h6 mb-2">{{ $t('auth.resetPassword.successTitle') }}</h2>
          <p class="text-body-2 text-medium-emphasis mb-6">
            {{ $t('auth.resetPassword.successMessage') }}
          </p>
          <v-btn
            color="primary"
            to="/login"
          >
            {{ $t('auth.resetPassword.goToLogin') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Reset Password Form -->
      <v-card v-else class="auth-card" elevation="0">
        <v-card-text class="pa-8">
          <v-form ref="formRef" @submit.prevent="handleSubmit">
            <v-text-field
              v-model="password"
              :label="$t('auth.resetPassword.newPassword')"
              :type="showPassword ? 'text' : 'password'"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.minLength]"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              class="mb-4"
              autocomplete="new-password"
              @click:append-inner="showPassword = !showPassword"
            />

            <v-text-field
              v-model="confirmPassword"
              :label="$t('auth.resetPassword.confirmPassword')"
              :type="showConfirmPassword ? 'text' : 'password'"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.passwordMatch]"
              prepend-inner-icon="mdi-lock-check-outline"
              :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
              class="mb-6"
              autocomplete="new-password"
              @click:append-inner="showConfirmPassword = !showConfirmPassword"
            />

            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-4"
              closable
              @click:close="error = null"
            >
              {{ error }}
            </v-alert>

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
            >
              {{ $t('auth.resetPassword.button') }}
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>

      <!-- Back to home -->
      <div class="text-center mt-6">
        <NuxtLink to="/" class="text-medium-emphasis text-decoration-none">
          <v-icon icon="mdi-arrow-left" size="small" class="mr-1" />
          {{ $t('auth.backToHome') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
  layout: false,
})

const { t } = useI18n()
const route = useRoute()

const formRef = ref()
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const token = computed(() => route.query.token as string | undefined)

const rules = {
  required: (v: string) => !!v || t('auth.validation.required'),
  minLength: (v: string) => v.length >= 8 || t('auth.validation.passwordLength'),
  passwordMatch: (v: string) => v === password.value || t('auth.validation.passwordMatch'),
}

async function handleSubmit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = null

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        password: password.value,
      },
    })
    success.value = true
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError.data?.message || t('auth.resetPassword.error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-container {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

.auth-card {
  background: rgba(var(--v-theme-surface-variant), 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
  border-radius: 16px;
}
</style>
