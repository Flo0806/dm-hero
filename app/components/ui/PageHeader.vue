<template>
  <div class="d-flex justify-space-between align-center mb-6">
    <div>
      <h1 class="text-h3 mb-2">
        {{ title }}
      </h1>
      <p class="text-body-1 text-medium-emphasis">
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
