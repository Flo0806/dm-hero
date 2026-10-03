<template>
  <!-- One section per kind (NPCs, later locations, items ...) with a card grid -->
  <div class="flex flex-col gap-8">
    <section v-for="group in groups" :key="group.type" :aria-labelledby="`section-${group.type}`">
      <h2 :id="`section-${group.type}`" class="m-0 mb-3 text-lg font-bold">
        {{ pickText(group.label, locale) }}
        <span class="text-muted font-normal">({{ group.shares.length }})</span>
      </h2>
      <ul class="m-0 p-0 list-none grid gap-2.5 sm:grid-cols-2">
        <li v-for="share in group.shares" :key="share.shareId">
          <ShareCard :share="share" :is-new="isNew(share)" :active="openIds.includes(share.shareId)" :revealed="revealedIds.includes(share.shareId)" @open="emit('open', share)" />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ shares: ShareContent[], openIds: string[], revealedIds: string[], isNew: (share: ShareContent) => boolean }>()
const emit = defineEmits<{ open: [ShareContent] }>()

const { locale } = useI18n()

// Section name comes with the shares (from DM Hero) - new kinds need no update here
const groups = computed(() => {
  const byType = new Map<string, ShareContent[]>()
  for (const share of props.shares) byType.set(share.type, [...(byType.get(share.type) ?? []), share])
  return [...byType.entries()].map(([type, shares]) => ({ type, label: shares[0]!.typeLabel, shares }))
})
</script>
