<template>
  <button
    type="button"
    class="relative w-full flex items-center gap-3 p-3 rounded-xl border bg-surface/85 text-ink text-left cursor-pointer transition hover:border-primary focus-ring"
    :class="[active ? 'border-primary' : 'border-line', { 'animate-[reveal-glow_1.6s_ease-out_2] motion-reduce:animate-none': revealed }]"
    :aria-pressed="active"
    @click="emit('open')"
  >
    <!-- Preview image if one is shared, otherwise a monogram -->
    <img v-if="thumb" :src="thumb" alt="" class="shrink-0 size-14 rounded-lg object-cover" />
    <span v-else aria-hidden="true" class="shrink-0 size-14 rounded-lg bg-primary/15 text-primary grid place-items-center text-2xl font-bold">
      {{ share.title.charAt(0).toUpperCase() }}
    </span>
    <span class="flex-1 min-w-0">
      <span class="block font-semibold truncate">{{ share.title }}</span>
      <span class="block text-sm text-muted">{{ new Date(share.updatedAt).toLocaleDateString(locale) }}</span>
    </span>
    <span v-if="isNew" class="absolute top-2.5 right-2.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
      <span aria-hidden="true" class="size-2 rounded-full bg-primary" />
      {{ $t('play.new') }}
    </span>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{ share: ShareContent, isNew: boolean, active: boolean, revealed?: boolean }>()
const emit = defineEmits<{ open: [] }>()
const { locale } = useI18n()
const thumb = useSharedImage(() => imageOf(props.share)?.image.thumb)
</script>
