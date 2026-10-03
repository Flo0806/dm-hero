<template>
  <div class="relative min-h-dvh flex flex-col overflow-hidden font-sans">
    <!-- Slowly drifting light behind the content -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute left-1/2 -top-40 size-130 -ml-65 rounded-full bg-primary opacity-35 blur-[90px] animate-[drift_18s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-30 -right-20 size-95 rounded-full bg-ember opacity-35 blur-[90px] animate-[drift_22s_ease-in-out_infinite_alternate-reverse] motion-reduce:animate-none"
    />

    <main class="relative flex-1 flex flex-col items-center justify-center px-5 py-12 text-center">
      <img
        src="/logo.png"
        alt="DM Hero"
        width="112"
        height="112"
        class="size-28 mb-7 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      />

      <h1 class="m-0 text-[clamp(2.2rem,7vw,3.4rem)] font-extrabold tracking-tight text-primary">
        {{ $t('home.greeting') }}
      </h1>
      <p class="mt-2 mb-0 text-[clamp(1.15rem,3.5vw,1.4rem)] font-semibold">
        {{ $t('home.welcome') }}
      </p>
      <p class="mt-5 mb-8 max-w-115 leading-relaxed text-muted">
        {{ $t('home.instruction') }}
      </p>

      <p v-if="notice" role="status" class="mt-0 mb-6 px-4 py-3 rounded-xl border border-line bg-surface/85 text-ink">
        {{ notice }}
      </p>

      <JoinForm @joined="gameId => navigateTo(`/play/${gameId}`)" />
    </main>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
// Set when a player is sent back here (game ended / removed from the game)
const route = useRoute()
const { t } = useI18n()
const notice = computed(() => {
  if (route.query.notice === 'ended') return t('home.noticeEnded')
  if (route.query.notice === 'removed') return t('home.noticeRemoved')
  return ''
})
</script>
