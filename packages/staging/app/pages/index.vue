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

      <form class="flex flex-col sm:flex-row gap-2.5 w-full max-w-105" @submit.prevent="join">
        <label for="game-code" class="sr-only">{{ $t('home.codeLabel') }}</label>
        <input
          id="game-code"
          v-model="code"
          :placeholder="$t('home.codeLabel')"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="12"
          class="flex-1 min-w-0 px-4.5 py-3.5 rounded-xl border border-line bg-surface/85 text-ink text-center text-lg font-bold uppercase tracking-[0.18em] transition placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-muted outline-none focus:border-primary focus:ring-3 focus:ring-primary/25"
        />
        <button
          type="submit"
          :disabled="!normalizedCode"
          class="px-5.5 py-3.5 rounded-xl border-none bg-primary text-bg font-bold cursor-pointer transition hover:enabled:bg-primary-hover active:enabled:scale-97 disabled:opacity-45 disabled:cursor-not-allowed focus-ring"
        >
          {{ $t('home.join') }}
        </button>
      </form>
    </main>

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
// QR codes / links from DM Hero carry the game code (?code=XXXXXX)
const route = useRoute()
const code = ref(typeof route.query.code === 'string' ? route.query.code : '')
const normalizedCode = computed(() => code.value.trim().toUpperCase())

function join() {
  // Next step: look up the game by code and enter it
}
</script>
