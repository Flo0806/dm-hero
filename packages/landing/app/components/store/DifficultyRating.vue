<template>
  <div class="difficulty-rating d-flex align-center ga-1">
    <v-btn
      v-for="level in 5"
      :key="level"
      :icon="level <= modelValue ? 'mdi-sword' : 'mdi-sword'"
      :color="level <= modelValue ? difficultyColor : undefined"
      :variant="level <= modelValue ? 'flat' : 'text'"
      size="small"
      density="compact"
      :class="{ 'difficulty-inactive': level > modelValue }"
      @click="emit('update:modelValue', level)"
    />
    <span v-if="showLabel" class="text-body-2 ml-2" :style="{ color: `rgb(var(--v-theme-${difficultyColor}))` }">
      {{ difficultyLabel }}
    </span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number
  showLabel?: boolean
  readonly?: boolean
}>(), {
  showLabel: true,
  readonly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const { t } = useI18n()

const difficultyColor = computed(() => {
  if (props.modelValue <= 1) return 'success'
  if (props.modelValue <= 2) return 'light-green'
  if (props.modelValue <= 3) return 'warning'
  if (props.modelValue <= 4) return 'orange'
  return 'error'
})

const difficultyLabel = computed(() => {
  const labels = [
    t('store.difficulty.easy'),
    t('store.difficulty.moderate'),
    t('store.difficulty.challenging'),
    t('store.difficulty.hard'),
    t('store.difficulty.deadly'),
  ]
  return labels[props.modelValue - 1] || ''
})
</script>

<style scoped>
.difficulty-rating .v-btn {
  min-width: 32px !important;
}

.difficulty-inactive {
  opacity: 0.3;
}
</style>
