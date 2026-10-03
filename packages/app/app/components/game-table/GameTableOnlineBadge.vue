<template>
  <!-- Online status of a player (live from the player relay) -->
  <span class="online-badge" :class="{ 'online-badge--on': online }">
    <span class="online-badge__dot" aria-hidden="true" />
    {{ online ? $t('gameTable.online') : $t('gameTable.offline') }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ online?: boolean }>()
</script>

<style scoped>
.online-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.online-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.3);
}

.online-badge--on .online-badge__dot {
  background: rgb(var(--v-theme-success));
}
</style>
