<template>
  <v-chip
    :color="statusColor"
    :variant="variant"
    :size="size"
    :prepend-icon="statusIcon"
    :class="{
      'status-pulse': isPending,
      'status-clickable': clickable,
    }"
  >
    {{ statusLabel }}
  </v-chip>
</template>

<script setup lang="ts">
import type { AdventureStatus } from '~/stores/profileStore'

const props = withDefaults(defineProps<{
  status: AdventureStatus
  size?: 'x-small' | 'small' | 'default' | 'large'
  variant?: 'flat' | 'tonal' | 'outlined' | 'text'
  clickable?: boolean
}>(), {
  size: 'small',
  variant: 'tonal',
  clickable: false,
})

const { t } = useI18n()

const statusConfig: Record<AdventureStatus, { color: string; icon: string; labelKey: string }> = {
  draft: { color: 'grey', icon: 'mdi-pencil-outline', labelKey: 'store.status.draft' },
  pending_review: { color: 'warning', icon: 'mdi-clock-outline', labelKey: 'store.status.pendingReview' },
  validating: { color: 'info', icon: 'mdi-sync', labelKey: 'store.status.validating' },
  published: { color: 'success', icon: 'mdi-check-circle', labelKey: 'store.status.published' },
  rejected: { color: 'error', icon: 'mdi-alert-circle', labelKey: 'store.status.rejected' },
  archived: { color: 'grey', icon: 'mdi-archive', labelKey: 'store.status.archived' },
}

const statusColor = computed(() => statusConfig[props.status]?.color || 'grey')
const statusIcon = computed(() => statusConfig[props.status]?.icon || 'mdi-help-circle')
const statusLabel = computed(() => t(statusConfig[props.status]?.labelKey || 'store.status.unknown'))

const isPending = computed(() =>
  props.status === 'pending_review' || props.status === 'validating',
)
</script>

<style scoped>
.status-pulse {
  animation: pulse 2s ease-in-out infinite;
}

.status-clickable {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.status-clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
