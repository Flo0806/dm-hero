<template>
  <div class="min-h-dvh flex flex-col font-sans">
    <main class="flex-1 flex flex-col items-center justify-center px-5 py-12 text-center">
      <img src="/logo.png" alt="DM Hero" width="72" height="72" class="size-18 mb-6 rounded-2xl" />

      <template v-if="status === 'denied'">
        <h1 class="m-0 text-2xl font-bold">
          {{ $t('play.denied') }}
        </h1>
        <NuxtLink to="/" class="btn-primary inline-block mt-6 no-underline">
          {{ $t('play.backToStart') }}
        </NuxtLink>
      </template>

      <template v-else>
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
      </template>
    </main>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { connect } = usePlayerSession()
const { status, name } = connect(String(route.params.gameId))
</script>
