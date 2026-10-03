<template>
  <!-- One section per kind (NPCs, later locations, items ...) with a card grid -->
  <div class="flex flex-col gap-8">
    <section v-for="group in groups" :key="group.type" :aria-labelledby="`section-${group.type}`">
      <h2 :id="`section-${group.type}`" class="m-0 mb-3 text-lg font-bold">
        {{ $t(`typesPlural.${group.type}`) }}
        <span class="text-muted font-normal">({{ group.shares.length }})</span>
      </h2>
      <ul class="m-0 p-0 list-none grid gap-2.5 sm:grid-cols-2">
        <li v-for="share in group.shares" :key="share.shareId">
          <ShareCard :share="share" :is-new="isNew(share)" :active="openIds.includes(share.shareId)" @open="emit('open', share)" />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ shares: ShareContent[], openIds: string[], isNew: (share: ShareContent) => boolean }>()
const emit = defineEmits<{ open: [ShareContent] }>()

const groups = computed(() => {
  const byType = new Map<string, ShareContent[]>()
  for (const share of props.shares) byType.set(share.type, [...(byType.get(share.type) ?? []), share])
  return [...byType.entries()].map(([type, shares]) => ({ type, shares }))
})
</script>
