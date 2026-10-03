<template>
  <!-- Everything shared with the players - edit (fields) or stop sharing -->
  <v-card class="pa-6 mt-6">
    <h2 class="text-title-large mb-2">
      {{ $t('gameTable.sharing') }}
    </h2>
    <p v-if="!store.shares.length" class="text-medium-emphasis mb-0">
      {{ $t('gameTable.share.empty') }}
    </p>
    <v-list v-else bg-color="transparent">
      <v-list-item v-for="share in store.shares" :key="share.id" class="px-0">
        <template #prepend>
          <v-icon :icon="TYPE_ICONS[share.entity_type]" color="primary" class="me-3" />
        </template>
        <v-list-item-title>
          {{ share.display_name ?? share.title ?? '?' }}
          <span v-if="share.display_name" class="text-medium-emphasis">({{ share.title }})</span>
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ $t('gameTable.share.fieldCount', { count: share.fields.length }) }} · {{ formatDate(share.created_at) }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn icon="mdi-pencil" variant="text" size="small" :aria-label="$t('common.edit')" @click="store.openShareDialog(share.entity_type, share.entity_id, share.title ?? '')" />
          <v-btn icon="mdi-close" variant="text" size="small" color="error" :aria-label="$t('gameTable.share.stop')" @click="stop(share.id)" />
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script setup lang="ts">
import type { ShareType } from '~~/types/share'

const TYPE_ICONS: Record<ShareType, string> = { npc: 'mdi-account', location: 'mdi-map-marker', item: 'mdi-sword', lore: 'mdi-book-open-variant' }

const { t, locale } = useI18n()
const store = useGameTableStore()
const snackbarStore = useSnackbarStore()

const formatDate = (value: string) => new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString(locale.value)

async function stop(shareId: number) {
  try {
    await store.unshare(shareId)
    snackbarStore.success(t('gameTable.share.stopped'))
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
}
</script>
