<template>
  <div class="d-flex justify-space-between align-center mb-6">
    <div>
      <h1 class="text-display-small mb-2">
        {{ title }}
      </h1>
      <p class="text-body-large text-medium-emphasis">
        {{ subtitle }}
      </p>
    </div>
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
})
</script>
