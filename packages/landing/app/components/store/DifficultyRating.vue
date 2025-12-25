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

const { getDifficultyColor, getDifficultyLabel } = useDifficulty()

const difficultyColor = computed(() => getDifficultyColor(props.modelValue))
const difficultyLabel = computed(() => getDifficultyLabel(props.modelValue))
</script>

<style scoped>
.difficulty-rating .v-btn {
  min-width: 32px !important;
}

.difficulty-inactive {
  opacity: 0.3;
}
</style>
