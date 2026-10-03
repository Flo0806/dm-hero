<template>
  <section class="w-full max-w-160" :aria-label="$t('play.sharedTitle')">
    <h2 class="m-0 mb-3 text-lg font-bold text-left">
      {{ $t('play.sharedTitle') }}
    </h2>
    <p v-if="!shares.length" class="m-0 text-left text-muted">
      {{ $t('play.nothingShared') }}
    </p>
    <ul v-else class="m-0 p-0 list-none flex flex-col gap-2.5">
      <li v-for="share in shares" :key="share.shareId">
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-line bg-surface/85 text-ink text-left cursor-pointer transition hover:border-primary focus-ring"
          @click="emit('open', share)"
        >
          <span class="flex-1 min-w-0">
            <span class="block font-semibold truncate">{{ share.title }}</span>
            <span class="block text-sm text-muted">
              {{ $t(`types.${share.type}`) }} · {{ new Date(share.updatedAt).toLocaleDateString(locale) }}
            </span>
          </span>
          <span aria-hidden="true" class="text-primary">›</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{ shares: ShareContent[] }>()
const emit = defineEmits<{ open: [ShareContent] }>()
const { locale } = useI18n()
</script>
