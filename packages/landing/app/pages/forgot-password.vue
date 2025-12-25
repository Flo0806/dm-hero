<template>
  <div class="auth-page">
    <StoreBackground />
    <div class="auth-container">
      <!-- Logo -->
      <div class="text-center mb-8">
        <v-icon icon="mdi-lock-reset" size="64" color="primary" class="mb-4" />
        <h1 class="text-h4 font-weight-light">{{ $t('auth.forgotPassword.title') }}</h1>
        <p class="text-body-2 text-medium-emphasis mt-2">
          {{ $t('auth.forgotPassword.subtitle') }}
        </p>
      </div>

      <!-- Success Message -->
      <v-card v-if="success" class="auth-card" elevation="0">
        <v-card-text class="pa-8 text-center">
          <v-icon icon="mdi-email-check" size="64" color="success" class="mb-4" />
          <h2 class="text-h6 mb-2">{{ $t('auth.forgotPassword.successTitle') }}</h2>
          <p class="text-body-2 text-medium-emphasis mb-6">
            {{ $t('auth.forgotPassword.successMessage') }}
          </p>
          <v-btn
            color="primary"
            variant="outlined"
            to="/login"
          >
            {{ $t('auth.forgotPassword.backToLogin') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Forgot Password Form -->
      <v-card v-else class="auth-card" elevation="0">
        <v-card-text class="pa-8">
          <v-form ref="formRef" @submit.prevent="handleSubmit">
            <v-text-field
              v-model="email"
              :label="$t('auth.email')"
              type="email"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.email]"
              prepend-inner-icon="mdi-email-outline"
              class="mb-6"
              autocomplete="email"
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
              class="mb-4"
            >
              {{ $t('auth.forgotPassword.button') }}
            </v-btn>
          </v-form>

          <div class="text-center">
            <NuxtLink to="/login" class="text-primary text-decoration-none">
              <v-icon icon="mdi-arrow-left" size="small" class="mr-1" />
              {{ $t('auth.forgotPassword.backToLogin') }}
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

const formRef = ref()
const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const rules = {
  required: (v: string) => !!v || t('auth.validation.required'),
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || t('auth.validation.email'),
}

async function handleSubmit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = null

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: {
        email: email.value,
        locale: locale.value,
      },
    })
    success.value = true
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError.data?.message || t('auth.forgotPassword.error')
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
