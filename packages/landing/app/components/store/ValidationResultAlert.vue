<template>
  <div v-if="hasContent" class="validation-result">
    <!-- Errors -->
    <v-alert
      v-if="errors.length"
      type="error"
      variant="tonal"
      :title="$t('store.validation.errorsTitle', { count: errors.length })"
      class="mb-3"
      :closable="closable"
    >
      <v-list density="compact" bg-color="transparent" class="pa-0">
        <v-list-item
          v-for="(error, index) in displayedErrors"
          :key="`error-${index}`"
          class="px-0"
        >
          <template #prepend>
            <v-icon :icon="getErrorIcon(error.type)" size="small" color="error" class="mr-2" />
          </template>
          <v-list-item-title class="text-body-2">
            {{ error.message }}
          </v-list-item-title>
          <v-list-item-subtitle v-if="error.field" class="text-caption">
            {{ error.field }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>

      <!-- Show more button -->
      <div v-if="errors.length > maxErrors && !showAllErrors" class="mt-2">
        <v-btn
          variant="text"
          size="small"
          color="error"
          @click="showAllErrors = true"
        >
          {{ $t('store.validation.showMore', { count: errors.length - maxErrors }) }}
        </v-btn>
      </div>
    </v-alert>

    <!-- Warnings -->
    <v-alert
      v-if="warnings.length"
      type="warning"
      variant="tonal"
      :title="$t('store.validation.warningsTitle', { count: warnings.length })"
      :closable="closable"
    >
      <v-list density="compact" bg-color="transparent" class="pa-0">
        <v-list-item
          v-for="(warning, index) in warnings"
          :key="`warning-${index}`"
          class="px-0"
        >
          <template #prepend>
            <v-icon icon="mdi-alert-outline" size="small" color="warning" class="mr-2" />
          </template>
          <v-list-item-title class="text-body-2">
            {{ warning.message }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import type { ValidationError, ValidationWarning } from '~/stores/profileStore'

const props = withDefaults(defineProps<{
  errors: ValidationError[]
  warnings: ValidationWarning[]
  maxErrors?: number
  closable?: boolean
}>(), {
  maxErrors: 5,
  closable: false,
})

const showAllErrors = ref(false)

const hasContent = computed(() => props.errors.length > 0 || props.warnings.length > 0)

const displayedErrors = computed(() => {
  if (showAllErrors.value || props.errors.length <= props.maxErrors) {
    return props.errors
  }
  return props.errors.slice(0, props.maxErrors)
})

function getErrorIcon(type: ValidationError['type']): string {
  switch (type) {
    case 'structure':
      return 'mdi-folder-alert'
    case 'filetype':
      return 'mdi-file-alert'
    case 'size':
      return 'mdi-file-document-alert'
    case 'content':
      return 'mdi-shield-alert'
    case 'format':
      return 'mdi-code-json'
    default:
      return 'mdi-alert-circle'
  }
}
</script>

<style scoped>
.validation-result :deep(.v-alert__content) {
  width: 100%;
}
</style>
