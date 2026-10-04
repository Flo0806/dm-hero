<template>
  <footer class="relative flex flex-col items-center gap-3 px-4 pt-8 pb-7 border-t border-white/6 text-center text-[13px] text-muted">
    <p class="m-0 max-w-110 leading-normal">
      {{ $t('footer.tagline') }}
    </p>

    <nav :aria-label="$t('footer.legalNav')" class="flex flex-wrap justify-center gap-x-4.5 gap-y-1">
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center min-h-6 py-1 text-muted no-underline transition-colors hover:text-primary focus-ring"
      >
        {{ link.label }}<span class="sr-only"> ({{ $t('footer.newTab') }})</span>
      </a>
    </nav>

    <label>
      <span class="sr-only">{{ $t('footer.language') }}</span>
      <select
        :value="locale"
        class="appearance-none min-h-8 px-4 py-1.5 rounded-full border border-white/10 bg-surface text-ink font-inherit cursor-pointer focus-ring"
        @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)"
      >
        <option v-for="l in locales" :key="l.code" :value="l.code">
          {{ l.name }}
        </option>
      </select>
    </label>
  </footer>
</template>

<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()

const links = computed(() => [
  { href: 'https://dm-hero.com/imprint', label: t('footer.imprint') },
  { href: 'https://dm-hero.com/privacy#game-table', label: t('footer.privacy') },
  { href: 'https://dm-hero.com/terms', label: t('footer.terms') },
  { href: 'https://dm-hero.com', label: 'dm-hero.com' },
])
</script>
