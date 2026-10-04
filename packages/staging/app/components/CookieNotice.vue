<template>
  <!-- Information only: just technically necessary cookies, so no consent to ask for -->
  <section
    v-if="visible"
    :aria-label="$t('cookieNotice.label')"
    class="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 rounded-xl border border-line bg-surface/95 shadow-lg text-sm"
  >
    <p class="m-0 flex-1 min-w-55">
      {{ $t('cookieNotice.message') }}
    </p>
    <div class="flex items-center gap-3">
      <a
        href="https://dm-hero.com/privacy#game-table"
        target="_blank"
        rel="noopener"
        class="text-primary underline focus-ring"
      >
        {{ $t('cookieNotice.more') }}<span class="sr-only"> ({{ $t('footer.newTab') }})</span>
      </a>
      <button type="button" class="btn-primary px-4 py-2" @click="dismiss">
        {{ $t('cookieNotice.ok') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'dm-hero-table-cookie-notice'
const visible = ref(false)

// Browser only (SSR would always show it) - storage may be blocked, then it just shows again
onMounted(() => {
  try {
    visible.value = !localStorage.getItem(STORAGE_KEY)
  }
  catch {
    visible.value = true
  }
})

function dismiss() {
  visible.value = false
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  }
  catch {
    // Not stored - shown again next time
  }
}
</script>
