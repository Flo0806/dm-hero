<script setup lang="ts">
const { locale } = useI18n()
const { state: snackbar } = useSnackbar()

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

    <!-- Global Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      location="bottom"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">
          OK
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style>
/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
  scroll-padding-top: 64px;
}
</style>
