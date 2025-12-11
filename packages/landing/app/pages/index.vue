<script setup lang="ts">
const { t } = useI18n()

// SEO Meta
useSeoMeta({
  title: () => t('meta.title'),
  description: () => t('meta.description'),
  ogTitle: () => t('meta.title'),
  ogDescription: () => t('meta.description'),
  ogType: 'website',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div class="landing-page">
    <HeroSection />
    <TestimonialsSection />
    <FeaturesSection />
    <ScreenshotsSection />
    <DownloadSection />
    <SupportSection />
    <FeedbackSection />
    <FooterSection />
  </div>
</template>

<style scoped>
.landing-page {
  background: rgb(var(--v-theme-background));
  min-height: 100vh;
}
</style>
