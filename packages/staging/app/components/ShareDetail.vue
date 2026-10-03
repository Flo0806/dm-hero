<template>
  <!-- Phones: details full screen (native <dialog>: focus trap + Esc for free) -->
  <dialog
    ref="dialogRef"
    class="m-0 w-full max-w-none h-dvh max-h-none p-0 border-none bg-bg text-ink backdrop:bg-black/60"
    :aria-label="share?.title"
    @close="emit('close')"
  >
    <div v-if="share" class="p-4">
      <button type="button" class="mb-3 px-1 py-2 border-none bg-transparent text-primary font-semibold cursor-pointer focus-ring" @click="dialogRef?.close()">
        ‹ {{ $t('play.back') }}
      </button>
      <ShareDetailPanel :share="share" @close="dialogRef?.close()" />
    </div>
  </dialog>
</template>

<script setup lang="ts">
const props = defineProps<{ share: ShareContent | null }>()
const emit = defineEmits<{ close: [] }>()
const dialogRef = ref<HTMLDialogElement>()

watch(() => props.share, (share) => {
  if (share && !dialogRef.value?.open) dialogRef.value?.showModal()
  if (!share && dialogRef.value?.open) dialogRef.value.close()
})
</script>
