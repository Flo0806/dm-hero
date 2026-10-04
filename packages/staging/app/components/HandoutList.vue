<template>
  <!-- Documents the DM handed out (to everyone or to this player): text opens right here, PDFs in a new tab -->
  <section v-if="handouts.length" :aria-labelledby="headingId">
    <h2 :id="headingId" class="sr-only">
      {{ $t('play.handouts.title') }}
    </h2>
    <ul class="m-0 p-0 list-none flex flex-col gap-3">
      <li v-for="handout in handouts" :key="handout.handoutId" class="rounded-xl border border-line bg-surface/85">
        <details v-if="handout.format === 'markdown'" class="group">
          <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer font-semibold focus-ring rounded-xl list-none">
            <span aria-hidden="true">📜</span>
            <span class="flex-1 min-w-0 truncate">{{ handout.title }}</span>
            <span class="text-sm text-muted group-open:hidden">{{ $t('play.handouts.read') }}</span>
          </summary>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="markdown px-4 pb-4 leading-relaxed" v-html="renderMarkdown(handout.text ?? '')" />
        </details>
        <button
          v-else
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3 border-none bg-transparent text-ink text-left font-semibold cursor-pointer focus-ring rounded-xl"
          :aria-busy="opening === handout.handoutId"
          @click="openPdf(handout)"
        >
          <span aria-hidden="true">📄</span>
          <span class="flex-1 min-w-0 truncate">{{ handout.title }}</span>
          <span class="text-sm text-muted">{{ opening === handout.handoutId ? $t('play.handouts.opening') : $t('play.handouts.openPdf') }}</span>
        </button>
      </li>
    </ul>
    <p v-if="failed" role="alert" class="m-0 mt-2 text-sm text-primary">
      {{ $t('play.handouts.failed') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import type { HandoutContent } from '@dm-hero/seal'

defineProps<{ handouts: HandoutContent[] }>()

const headingId = useId()
const gameId = String(useRoute().params.gameId)
const opening = ref<string | null>(null)
const failed = ref(false)

// Fetched + decrypted here, opened as a local blob - the readable PDF never leaves the device
async function openPdf(handout: HandoutContent) {
  if (!handout.file) return
  opening.value = handout.handoutId
  failed.value = false
  // Open the tab right in the click - opened after the download, browsers block it as a popup
  const tab = window.open('', '_blank')
  try {
    const url = await loadSharedFile(gameId, handout.file)
    if (tab) tab.location.href = url
    else window.location.href = url
  }
  catch (error) {
    console.error('[E2E] Handout file failed:', error)
    tab?.close()
    failed.value = true
  }
  finally {
    opening.value = null
  }
}
</script>
