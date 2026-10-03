<template>
  <NuxtPage />
</template>

<script setup lang="ts">
const { t, locale } = useI18n()

useHead(() => ({ htmlAttrs: { lang: locale.value } }))
useSeoMeta({
  title: () => t('meta.title'),
  description: () => t('meta.description'),
})
</script>
