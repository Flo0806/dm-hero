<script setup lang="ts">
const { locale } = useI18n()

// Set HTML lang attribute
useHead({
  htmlAttrs: {
    lang: locale,
  },
})
</script>

<template>
  <v-app>
    <NavBar />

    <v-main>
      <NuxtPage />
    </v-main>

    <PrivacyInfoBanner />
  </v-app>
</template>

<style>
/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
  scroll-padding-top: 64px;
}
</style>
