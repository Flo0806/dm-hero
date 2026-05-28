<template>
  <v-chip
    :color="tag.color || undefined"
    :size="size"
    :variant="variant"
    :closable="closable"
    :class="['tag-chip', { 'tag-chip--clickable': clickable }]"
    @click="onClick"
    @click:close="$emit('remove')"
  >
    <span class="tag-chip__hash">#</span>{{ tag.name }}
  </v-chip>
</template>

<script setup lang="ts">
import type { Tag } from '~~/types/tag'

const props = withDefaults(defineProps<{
  tag: Tag
  size?: 'x-small' | 'small' | 'default'
  variant?: 'flat' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'plain'
  closable?: boolean
  clickable?: boolean
}>(), {
  size: 'x-small',
  variant: 'tonal',
  closable: false,
  clickable: false,
})

const emit = defineEmits<{
  remove: []
  click: []
}>()

function onClick() {
  if (props.clickable) emit('click')
}
</script>

<style scoped>
.tag-chip__hash {
  opacity: 0.6;
  margin-right: 1px;
}
.tag-chip--clickable {
  cursor: pointer;
}
</style>
