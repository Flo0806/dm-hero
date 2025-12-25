<template>
  <div class="auth-page">
    <StoreBackground />
    <div class="auth-container">
      <!-- Logo -->
      <div class="text-center mb-8">
        <v-icon icon="mdi-dice-d20" size="64" color="primary" class="mb-4" />
        <h1 class="text-h4 font-weight-light">
          {{ registrationComplete ? $t('auth.registrationComplete.title') : $t('auth.register.title') }}
        </h1>
        <p v-if="!registrationComplete" class="text-body-2 text-medium-emphasis mt-2">
          {{ $t('auth.register.subtitle') }}
        </p>
      </div>

      <!-- Registration Complete - Verification Notice -->
      <v-card v-if="registrationComplete" class="auth-card" elevation="0">
        <v-card-text class="pa-8 text-center">
          <v-icon icon="mdi-email-check" size="64" color="success" class="mb-6" />
          <p class="text-body-1 mb-4">
            {{ $t('auth.registrationComplete.message', { email: registeredEmail }) }}
          </p>
          <p class="text-body-2 text-medium-emphasis mb-6">
            {{ $t('auth.registrationComplete.spamHint') }}
          </p>
          <v-btn color="primary" variant="outlined" to="/store">
            {{ $t('auth.registrationComplete.continueToStore') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Register Form -->
      <v-card v-else class="auth-card" elevation="0">
        <v-card-text class="pa-8">
          <v-form ref="formRef" @submit.prevent="handleRegister">
            <v-text-field
              v-model="displayName"
              :label="$t('auth.displayName')"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.minLength(2), rules.maxLength(100)]"
              prepend-inner-icon="mdi-account-outline"
              class="mb-4"
              autocomplete="name"
            />

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
              :rules="[rules.required, rules.minLength(8)]"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              class="mb-4"
              autocomplete="new-password"
              @click:append-inner="showPassword = !showPassword"
            />

            <v-text-field
              v-model="confirmPassword"
              :label="$t('auth.confirmPassword')"
              :type="showPassword ? 'text' : 'password'"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.match]"
              prepend-inner-icon="mdi-lock-check-outline"
              class="mb-6"
              autocomplete="new-password"
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
              {{ $t('auth.register.button') }}
            </v-btn>

            <p class="text-caption text-medium-emphasis text-center mb-0">
              {{ $t('auth.register.terms') }}
              <NuxtLink to="/terms" class="text-primary">{{ $t('auth.register.termsLink') }}</NuxtLink>
              {{ $t('auth.register.and') }}
              <NuxtLink to="/privacy" class="text-primary">{{ $t('auth.register.privacyLink') }}</NuxtLink>
            </p>
          </v-form>

          <v-divider class="my-6">
            <span class="text-medium-emphasis text-body-2 px-4">{{ $t('auth.or') }}</span>
          </v-divider>

          <div class="text-center">
            <span class="text-medium-emphasis">{{ $t('auth.register.hasAccount') }}</span>
            <NuxtLink to="/login" class="text-primary text-decoration-none ml-1 font-weight-medium">
              {{ $t('auth.register.loginLink') }}
            </NuxtLink>
          </div>
        </v-card-text>
      </v-card>

      <!-- Back to home -->
      <div v-if="!registrationComplete" class="text-center mt-6">
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
const { register, loading, error } = useAuth()

const formRef = ref()
const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const registrationComplete = ref(false)
const registeredEmail = ref('')

const rules = {
  required: (v: string) => !!v || t('auth.validation.required'),
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || t('auth.validation.email'),
  minLength: (min: number) => (v: string) => v.length >= min || t('auth.validation.minLength', { min }),
  maxLength: (max: number) => (v: string) => v.length <= max || t('auth.validation.maxLength', { max }),
  match: (v: string) => v === password.value || t('auth.validation.passwordMatch'),
}

async function handleRegister() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  const success = await register(email.value, password.value, displayName.value, locale.value)
  if (success) {
    registeredEmail.value = email.value
    registrationComplete.value = true
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
