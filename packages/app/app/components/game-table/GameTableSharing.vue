<template>
  <!-- Everything shared with the players - edit (fields) or stop sharing -->
  <v-card class="pa-6 mt-6">
    <h2 class="text-title-large mb-2">
      {{ $t('gameTable.sharing') }}
    </h2>
    <!-- Rows slide out when sharing stops (and in when added) - no silent "puff".
         The list stays mounted, so even the last row gets its exit animation. -->
    <v-list bg-color="transparent" class="share-list pa-0">
      <TransitionGroup name="share-row">
        <v-list-item v-for="share in store.shares" :key="share.id" class="px-0">
          <template #prepend>
            <v-icon :icon="SHARE_TYPE_CONFIG[share.entity_type].icon" color="primary" class="me-3" />
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
      </TransitionGroup>
    </v-list>
    <Transition name="share-empty">
      <p v-if="!store.shares.length" class="text-medium-emphasis mb-0">
        {{ $t('gameTable.share.empty') }}
      </p>
    </Transition>
  </v-card>
</template>

<script setup lang="ts">
import { SHARE_TYPE_CONFIG } from '~~/types/share'

const { t, locale } = useI18n()
const store = useGameTableStore()
const snackbarStore = useSnackbarStore()

const formatDate = (value: string) => parseSqliteDate(value).toLocaleDateString(locale.value)

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

<style scoped>
.share-list {
  position: relative;
  /* The leaving row slides past the edge - clip it instead of showing scrollbars */
  overflow: hidden;
}

.share-row-move,
.share-row-enter-active,
.share-row-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.share-row-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.share-row-leave-to {
  opacity: 0;
  transform: translateX(32px);
}

/* Leaving row is taken out of the flow, so the others slide up smoothly */
.share-row-leave-active {
  position: absolute;
  width: 100%;
}

.share-empty-enter-active {
  transition: opacity 0.3s ease 0.3s;
}

.share-empty-enter-from {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .share-empty-enter-active,
  .share-row-move,
  .share-row-enter-active,
  .share-row-leave-active {
    transition: none;
  }
}
</style>
