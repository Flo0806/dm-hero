<template>
  <div class="auth-page">
    <StoreBackground />
    <div class="auth-container">
      <!-- Logo -->
      <div class="text-center mb-8">
        <v-icon icon="mdi-dice-d20" size="64" color="primary" class="mb-4" />
        <h1 class="text-h4 font-weight-light">{{ $t('auth.login.title') }}</h1>
        <p class="text-body-2 text-medium-emphasis mt-2">
          {{ $t('auth.login.subtitle') }}
        </p>
      </div>

      <!-- Login Form -->
      <v-card class="auth-card" elevation="0">
        <v-card-text class="pa-8">
          <v-form ref="formRef" @submit.prevent="handleLogin">
            <v-text-field
              v-model="email"
              :label="$t('auth.email')"
              type="email"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.email]"
              prepend-inner-icon="mdi-email-outline"
              class="mb-4"
              autocomplete="email"
            />

            <v-text-field
              v-model="password"
              :label="$t('auth.password')"
              :type="showPassword ? 'text' : 'password'"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              class="mb-2"
              autocomplete="current-password"
              @click:append-inner="showPassword = !showPassword"
            />

            <div class="d-flex justify-end mb-6">
              <NuxtLink to="/forgot-password" class="text-primary text-decoration-none text-body-2">
                {{ $t('auth.forgotPassword.link') }}
              </NuxtLink>
            </div>

            <!-- Email not verified error -->
            <v-alert
              v-if="emailNotVerified"
              type="warning"
              variant="tonal"
              class="mb-4"
            >
              <div class="mb-2">{{ $t('auth.login.emailNotVerified') }}</div>
              <v-btn
                size="small"
                variant="outlined"
                color="warning"
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
                class="mt-2"
              >
                {{ $t('auth.verifyEmail.resendSuccess') }}
              </v-alert>
            </v-alert>

            <!-- Other errors -->
            <v-alert
              v-else-if="error"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-4"
              closable
              @click:close="clearError"
            >
              {{ error }}
            </v-alert>

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
              class="mb-4"
            >
              {{ $t('auth.login.button') }}
            </v-btn>
          </v-form>

          <v-divider class="my-6">
            <span class="text-medium-emphasis text-body-2 px-4">{{ $t('auth.or') }}</span>
          </v-divider>

          <div class="text-center">
            <span class="text-medium-emphasis">{{ $t('auth.login.noAccount') }}</span>
            <NuxtLink to="/register" class="text-primary text-decoration-none ml-1 font-weight-medium">
              {{ $t('auth.login.registerLink') }}
            </NuxtLink>
          </div>
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

const { t, locale } = useI18n()
const router = useRouter()
const { login, loading, error, clearError } = useAuth()

const formRef = ref()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const emailNotVerified = ref(false)
const resending = ref(false)
const resendSuccess = ref(false)

const rules = {
  required: (v: string) => !!v || t('auth.validation.required'),
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || t('auth.validation.email'),
}

async function handleLogin() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  emailNotVerified.value = false
  resendSuccess.value = false

  try {
    const success = await login(email.value, password.value)
    if (success) {
      router.push('/store')
    }
  } catch {
    // Error is handled by useAuth
  }

  // Check if it's an email verification error
  if (error.value?.includes('verify your email')) {
    emailNotVerified.value = true
    clearError()
  }
}

async function handleResend() {
  if (!email.value) return

  resending.value = true
  resendSuccess.value = false

  try {
    await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: email.value, locale: locale.value },
    })
    resendSuccess.value = true
  } catch (err) {
    console.error('Failed to resend verification email:', err)
  } finally {
    resending.value = false
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
