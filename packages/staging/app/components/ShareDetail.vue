<template>
  <!-- Native <dialog>: focus trap, Esc to close and a backdrop for free -->
  <dialog
    ref="dialogRef"
    aria-labelledby="share-detail-title"
    class="w-[min(100%-2rem,36rem)] max-h-[85dvh] p-0 rounded-2xl border border-line bg-surface text-ink backdrop:bg-black/60"
    @close="emit('close')"
  >
    <div v-if="share" class="p-6">
      <div class="flex items-start gap-3 mb-4">
        <h2 id="share-detail-title" class="flex-1 m-0 text-2xl font-bold text-primary">
          {{ share.title }}
        </h2>
        <button type="button" class="p-1 border-none bg-transparent text-muted text-2xl leading-none cursor-pointer focus-ring" :aria-label="$t('play.close')" @click="dialogRef?.close()">
          ×
        </button>
      </div>
      <dl class="m-0 flex flex-col gap-4">
        <div v-for="field in share.fields" :key="field.key">
          <dt class="text-sm text-muted">
            {{ pickText(field.label, locale) }}
          </dt>
          <dd class="m-0 mt-0.5 leading-relaxed whitespace-pre-wrap">
            {{ pickText(field.value, locale) }}
          </dd>
        </div>
      </dl>
    </div>
  </dialog>
</template>

<script setup lang="ts">
const props = defineProps<{ share: ShareContent | null }>()
const emit = defineEmits<{ close: [] }>()
const { locale } = useI18n()
const dialogRef = ref<HTMLDialogElement>()

watch(() => props.share, (share) => {
  if (share && !dialogRef.value?.open) dialogRef.value?.showModal()
})
</script>
