<script setup lang="ts">
const { t } = useI18n()

// Check if user has already seen the banner
const dismissed = ref(false)
const showBanner = ref(false)

onMounted(() => {
  const seen = localStorage.getItem('dm-hero-privacy-info-seen')
  if (!seen) {
    showBanner.value = true
  }
})

function dismiss() {
  dismissed.value = true
  localStorage.setItem('dm-hero-privacy-info-seen', 'true')
  setTimeout(() => {
    showBanner.value = false
  }, 300)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="showBanner && !dismissed" class="privacy-banner">
        <v-container class="py-0">
          <div class="banner-content">
            <div class="banner-icon">
              <v-icon color="primary" size="28">mdi-shield-check</v-icon>
            </div>
            <div class="banner-text">
              <p class="banner-title">{{ t('privacyBanner.title') }}</p>
              <p class="banner-message">{{ t('privacyBanner.message') }}</p>
            </div>
            <div class="banner-actions">
              <NuxtLink to="/privacy" class="privacy-link">
                {{ t('privacyBanner.learnMore') }}
              </NuxtLink>
              <v-btn
                color="primary"
                variant="flat"
                size="small"
                @click="dismiss"
              >
                {{ t('privacyBanner.ok') }}
              </v-btn>
            </div>
          </div>
        </v-container>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.privacy-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: rgba(var(--v-theme-surface), 0.98);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(var(--v-theme-primary), 0.2);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
  padding: 16px 0;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.banner-icon {
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
  min-width: 200px;
}

.banner-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 2px;
}

.banner-message {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.privacy-link {
  font-size: 0.85rem;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  white-space: nowrap;
}

.privacy-link:hover {
  text-decoration: underline;
}

/* Transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Mobile */
@media (max-width: 600px) {
  .banner-content {
    flex-direction: column;
    text-align: center;
  }

  .banner-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
