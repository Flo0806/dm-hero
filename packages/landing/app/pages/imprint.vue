<template>
  <v-container class="py-16 px-4 px-md-16" style="max-width: 800px">
    <NuxtLink to="/" class="back-link mb-8 d-inline-flex align-center">
      <v-icon size="small" class="mr-2">mdi-arrow-left</v-icon>
      {{ $t('legal.backToHome') }}
    </NuxtLink>

    <h1 class="text-h4 text-md-h3 font-weight-bold mb-8">
      {{ $t('legal.imprint.title') }}
    </h1>

    <p class="text-body-1 mb-4">
      {{ $t('legal.imprint.info') }}<br>
      {{ $t('legal.imprint.owner') }}<br>
      {{ $t('legal.imprint.address') }}
    </p>

    <p class="text-body-1 mb-4">
      {{ $t('legal.imprint.contact') }}:
      <a href="mailto:info@fh-softdev.de" class="text-primary">info@fh-softdev.de</a>
    </p>

    <p class="text-body-1 mb-4">
      {{ $t('legal.imprint.vat') }}: DE265013614
    </p>

    <p class="text-body-1 mb-8">
      {{ $t('legal.imprint.responsible') }}:<br>
      Florian Heuberger
    </p>

    <p class="text-caption text-medium-emphasis">
      {{ $t('legal.imprint.note') }}
    </p>
  </v-container>
</template>

<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => `${t('legal.imprint.title')} - DM Hero`,
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
