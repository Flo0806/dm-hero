<template>
  <div class="auth-page">
    <StoreBackground />
    <div class="auth-container">
      <!-- Logo -->
      <div class="text-center mb-8">
        <v-icon icon="mdi-dice-d20" size="64" color="primary" class="mb-4" />
        <h1 class="text-h4 font-weight-light">{{ $t('auth.verifyEmail.title') }}</h1>
      </div>

      <v-card class="auth-card" elevation="0">
        <v-card-text class="pa-8 text-center">
          <!-- Loading state -->
          <template v-if="loading">
            <v-progress-circular indeterminate size="64" color="primary" class="mb-6" />
            <p class="text-body-1">{{ $t('auth.verifyEmail.verifying') }}</p>
          </template>

          <!-- Success state -->
          <template v-else-if="success">
            <v-icon icon="mdi-check-circle" size="64" color="success" class="mb-6" />
            <h2 class="text-h5 mb-4">{{ $t('auth.verifyEmail.success') }}</h2>
            <p class="text-body-1 text-medium-emphasis mb-6">
              {{ $t('auth.verifyEmail.successMessage') }}
            </p>
            <v-btn color="primary" size="large" to="/store" prepend-icon="mdi-storefront">
              {{ $t('auth.verifyEmail.goToStore') }}
            </v-btn>
          </template>

          <!-- Error state -->
          <template v-else-if="error">
            <v-icon icon="mdi-alert-circle" size="64" color="error" class="mb-6" />
            <h2 class="text-h5 mb-4">{{ $t('auth.verifyEmail.error') }}</h2>
            <p class="text-body-1 text-medium-emphasis mb-6">
              {{ errorMessage }}
            </p>
            
            <!-- Resend form -->
            <div v-if="showResend" class="mt-6">
              <v-divider class="mb-6" />
              <p class="text-body-2 text-medium-emphasis mb-4">
                {{ $t('auth.verifyEmail.resendPrompt') }}
              </p>
              <v-text-field
                v-model="resendEmail"
                :label="$t('auth.email')"
                type="email"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="mdi-email-outline"
                class="mb-4"
              />
              <v-btn
                color="primary"
                variant="outlined"
                :loading="resending"
                @click="handleResend"
              >
                {{ $t('auth.verifyEmail.resendButton') }}
              </v-btn>
              <v-alert
                v-if="resendSuccess"
                type="success"
                variant="tonal"
                density="compact"
                class="mt-4"
              >
                {{ $t('auth.verifyEmail.resendSuccess') }}
              </v-alert>
            </div>
          </template>

          <!-- No token state -->
          <template v-else>
            <v-icon icon="mdi-email-alert" size="64" color="warning" class="mb-6" />
            <h2 class="text-h5 mb-4">{{ $t('auth.verifyEmail.noToken') }}</h2>
            <p class="text-body-1 text-medium-emphasis mb-6">
              {{ $t('auth.verifyEmail.noTokenMessage') }}
            </p>
            <v-btn color="primary" variant="outlined" to="/login">
              {{ $t('auth.verifyEmail.goToLogin') }}
            </v-btn>
          </template>
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
  layout: false,
})

const { t, locale } = useI18n()
const route = useRoute()

const loading = ref(false)
const success = ref(false)
const error = ref(false)
const errorMessage = ref('')
const showResend = ref(false)
const resendEmail = ref('')
const resending = ref(false)
const resendSuccess = ref(false)

async function verifyEmail(token: string) {
  loading.value = true
  
  try {
    await $fetch('/api/auth/verify-email', {
      method: 'POST',
      body: { token },
    })
    success.value = true
  } catch (err: unknown) {
    error.value = true
    const fetchError = err as { data?: { message?: string } }
    errorMessage.value = fetchError.data?.message || t('common.error')
    
    // Show resend option for expired/invalid tokens
    showResend.value = true
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (!resendEmail.value) return
  
  resending.value = true
  resendSuccess.value = false
  
  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: {
        email: resendEmail.value,
        locale: locale.value,
      },
    })
    resendSuccess.value = true
  } catch (err) {
    console.error('Failed to resend verification email:', err)
  } finally {
    resending.value = false
  }
}

onMounted(() => {
  const token = route.query.token as string
  if (token) {
    verifyEmail(token)
  }
})
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
