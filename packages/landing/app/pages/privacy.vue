<template>
  <v-container class="py-16 px-4 px-md-16" style="max-width: 800px">
    <NuxtLink to="/" class="back-link mb-8 d-inline-flex align-center">
      <v-icon size="small" class="mr-2">mdi-arrow-left</v-icon>
      {{ $t('legal.backToHome') }}
    </NuxtLink>

    <h1 class="text-h4 text-md-h3 font-weight-bold mb-8">
      {{ $t('legal.privacy.title') }}
    </h1>

    <p class="text-body-1 mb-6">{{ $t('legal.privacy.intro') }}</p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.controllerTitle') }}
    </h2>
    <p class="text-body-2 mb-6">
      {{ $t('legal.privacy.controller') }}<br>
      {{ $t('legal.privacy.name') }}<br>
      {{ $t('legal.privacy.address') }}<br>
      {{ $t('legal.privacy.email') }}
    </p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.hostingTitle') }}
    </h2>
    <p class="text-body-2 mb-6">{{ $t('legal.privacy.hosting') }}</p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.dataCollectionTitle') }}
    </h2>
    <p class="text-body-2 mb-6">{{ $t('legal.privacy.dataCollection') }}</p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.legalBasisTitle') }}
    </h2>
    <p class="text-body-2 mb-6">{{ $t('legal.privacy.legalBasis') }}</p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.externalTitle') }}
    </h2>
    <p class="text-body-2 mb-6">{{ $t('legal.privacy.external') }}</p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.githubTitle') }}
    </h2>
    <p class="text-body-2 mb-6">{{ $t('legal.privacy.github') }}</p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.rightsTitle') }}
    </h2>
    <p class="text-body-2 mb-6">{{ $t('legal.privacy.rights') }}</p>

    <h2 class="text-h6 font-weight-bold mb-2">
      {{ $t('legal.privacy.noteTitle') }}
    </h2>
    <p class="text-body-2">{{ $t('legal.privacy.note') }}</p>
  </v-container>
</template>

<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => `${t('legal.privacy.title')} - DM Hero`,
  robots: 'noindex',
})
</script>

<style scoped>
.back-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.back-link:hover {
  opacity: 0.8;
}
</style>
