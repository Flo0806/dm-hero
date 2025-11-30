<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        {{ message }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="$emit('cancel')" />
        <v-btn icon="mdi-delete" color="error" :loading="loading" @click="$emit('confirm')" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title: string
  message: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

defineEmits<{
  'update:model-value': [value: boolean]
  confirm: []
  cancel: []
}>()
</script>
