<template>
  <div class="min-h-dvh flex flex-col font-sans">
    <main class="flex-1 flex flex-col items-center px-5 py-12 text-center">
      <img src="/logo.png" alt="DM Hero" width="72" height="72" class="size-18 mb-6 rounded-2xl" />

      <h1 class="m-0 text-[clamp(1.8rem,6vw,2.6rem)] font-extrabold text-primary">
        {{ name ? $t('play.welcome', { name }) : $t('play.connecting') }}
      </h1>
      <p class="mt-4 mb-6 max-w-105 leading-relaxed text-muted">
        {{ $t('play.waiting') }}
      </p>
      <p role="status" class="m-0 inline-flex items-center gap-2 text-sm text-muted">
        <span class="size-2.5 rounded-full" :class="status === 'live' ? 'bg-success' : 'bg-primary animate-pulse motion-reduce:animate-none'" aria-hidden="true" />
        {{ status === 'live' ? $t('play.connected') : $t('play.reconnecting') }}
      </p>
      <p v-if="encrypted" role="status" class="mt-3 mb-0 inline-flex items-center gap-2 text-sm text-success">
        <span aria-hidden="true">🔒</span>
        {{ $t('play.encrypted') }}
      </p>
      <!-- Waiting for the DM to approve this device: show the symbols to compare -->
      <div v-else role="status" class="mt-6 px-5 py-4 rounded-xl border border-line bg-surface/85 max-w-105">
        <p class="m-0 font-semibold">
          {{ $t('play.waitingApproval') }}
        </p>
        <p class="mt-1 mb-2 text-sm text-muted">
          {{ $t('play.compareSymbols') }}
        </p>
        <p class="m-0 text-4xl tracking-widest">
          {{ symbols.join(' ') }}
        </p>
      </div>

      <ShareList v-if="encrypted" :shares="shares" class="mt-10" @open="openShare = $event" />
      <ShareDetail :share="openShare" @close="openShare = null" />
    </main>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { connect } = usePlayerSession()
const { status, name, encrypted, symbols, shares } = connect(String(route.params.gameId))
const openShare = ref<ShareContent | null>(null)

// Keep an open share up to date (live edits) - or close it if the DM stopped sharing
watch(shares, (list) => {
  if (!openShare.value) return
  openShare.value = list.find(s => s.shareId === openShare.value!.shareId) ?? null
})

// Game over or kicked: back to the start page, which explains what happened
watch(status, (value) => {
  if (value === 'ended') navigateTo({ path: '/', query: { notice: 'ended' } })
  else if (value === 'denied') navigateTo({ path: '/', query: { notice: 'removed' } })
})
</script>
