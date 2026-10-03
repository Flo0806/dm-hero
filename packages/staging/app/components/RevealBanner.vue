<template>
  <!-- The reveal moment: one at a time, announced to screen readers too -->
  <div aria-live="polite" class="fixed left-1/2 top-4 z-50 w-[min(100%-2rem,30rem)] -translate-x-1/2">
    <div
      v-if="reveal"
      :key="reveal.shareId + reveal.kind + reveal.title"
      class="flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary bg-surface text-ink shadow-[0_12px_40px_rgba(0,0,0,0.55)] animate-[reveal-in_0.35s_ease-out] motion-reduce:animate-none"
    >
      <span aria-hidden="true" class="text-2xl">✨</span>
      <p class="flex-1 m-0 font-semibold leading-snug">
        {{ text }}
      </p>
      <button type="button" class="btn-primary !px-3 !py-2 text-sm" @click="emit('show', reveal.shareId)">
        {{ $t('play.revealShow') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ reveal: Reveal | null }>()
const emit = defineEmits<{ show: [shareId: string] }>()
const { t, locale } = useI18n()

const text = computed(() => {
  const r = props.reveal
  if (!r) return ''
  if (r.kind === 'name') return t('play.revealName', { previous: r.previousTitle, name: r.title })
  if (r.kind === 'info') return t('play.revealInfo', { name: r.title, fields: (r.newFields ?? []).map(f => pickText(f, locale.value)).join(', ') })
  return t('play.revealNew', { name: r.title })
})
</script>
