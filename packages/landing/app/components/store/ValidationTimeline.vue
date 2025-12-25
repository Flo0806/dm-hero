<template>
  <div class="validation-timeline">
    <div
      v-for="(step, index) in steps"
      :key="step.key"
      class="timeline-step"
      :class="{
        'step-completed': step.completed,
        'step-active': step.active,
        'step-error': step.error,
        'step-pending': !step.completed && !step.active && !step.error,
      }"
    >
      <!-- Connector line (not on first) -->
      <div v-if="index > 0" class="timeline-connector" :class="{ 'connector-completed': step.completed || step.active || step.error }" />

      <!-- Step indicator -->
      <div class="step-indicator">
        <v-icon
          v-if="step.completed && !step.error"
          icon="mdi-check"
          size="small"
          color="white"
        />
        <v-icon
          v-else-if="step.error"
          icon="mdi-close"
          size="small"
          color="white"
        />
        <v-progress-circular
          v-else-if="step.active"
          :size="16"
          :width="2"
          indeterminate
          color="white"
        />
        <span v-else class="step-number">{{ index + 1 }}</span>
      </div>

      <!-- Step content -->
      <div class="step-content">
        <div class="step-title" :class="{ 'text-medium-emphasis': !step.completed && !step.active && !step.error }">
          {{ step.title }}
        </div>
        <div v-if="step.subtitle" class="step-subtitle text-caption text-medium-emphasis">
          {{ step.subtitle }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdventureStatus } from '~/stores/profileStore'

const props = defineProps<{
  status: AdventureStatus
  validatedAt?: string | null
  createdAt?: string | null
}>()

const { t, locale } = useI18n()

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value === 'de' ? 'de-DE' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface TimelineStep {
  key: string
  title: string
  subtitle?: string
  completed: boolean
  active: boolean
  error: boolean
}

const steps = computed<TimelineStep[]>(() => {
  const status = props.status

  // Step 1: Uploaded
  const uploadStep: TimelineStep = {
    key: 'upload',
    title: t('store.timeline.uploaded'),
    subtitle: props.createdAt ? formatDate(props.createdAt) : undefined,
    completed: true,
    active: false,
    error: false,
  }

  // Step 2: In review
  const reviewStep: TimelineStep = {
    key: 'review',
    title: t('store.timeline.inReview'),
    subtitle: status === 'pending_review' || status === 'validating'
      ? t('store.timeline.reviewingNow')
      : undefined,
    completed: ['published', 'rejected'].includes(status),
    active: status === 'pending_review' || status === 'validating',
    error: false,
  }

  // Step 3: Result (published or rejected)
  const resultStep: TimelineStep = {
    key: 'result',
    title: status === 'rejected'
      ? t('store.timeline.rejected')
      : t('store.timeline.published'),
    subtitle: props.validatedAt && (status === 'published' || status === 'rejected')
      ? formatDate(props.validatedAt)
      : status === 'rejected'
        ? t('store.timeline.actionRequired')
        : undefined,
    completed: status === 'published',
    active: false,
    error: status === 'rejected',
  }

  return [uploadStep, reviewStep, resultStep]
})
</script>

<style scoped>
.validation-timeline {
  display: flex;
  align-items: flex-start;
  padding: 1rem 0;
}

.timeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 80px;
}

.timeline-connector {
  position: absolute;
  top: 14px;
  right: 50%;
  width: 100%;
  height: 3px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  z-index: 0;
  transition: background 0.3s ease;
}

.connector-completed {
  background: rgb(var(--v-theme-primary));
}

.step-indicator {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.12);
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 12px;
  font-weight: 600;
  z-index: 1;
  transition: all 0.3s ease;
}

.step-completed .step-indicator {
  background: rgb(var(--v-theme-success));
  color: white;
  box-shadow: 0 2px 8px rgba(var(--v-theme-success), 0.4);
}

.step-active .step-indicator {
  background: rgb(var(--v-theme-primary));
  color: white;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.4);
  animation: pulse-glow 2s ease-in-out infinite;
}

.step-error .step-indicator {
  background: rgb(var(--v-theme-error));
  color: white;
  box-shadow: 0 2px 8px rgba(var(--v-theme-error), 0.4);
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.4);
  }
  50% {
    box-shadow: 0 2px 16px rgba(var(--v-theme-primary), 0.6);
  }
}

.step-content {
  margin-top: 0.75rem;
  text-align: center;
}

.step-title {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
}

.step-subtitle {
  margin-top: 0.25rem;
  line-height: 1.2;
}

.step-error .step-title {
  color: rgb(var(--v-theme-error));
}

.step-completed .step-title {
  color: rgb(var(--v-theme-success));
}

.step-active .step-title {
  color: rgb(var(--v-theme-primary));
}

/* Responsive */
@media (max-width: 400px) {
  .step-content {
    display: none;
  }

  .timeline-step {
    min-width: 60px;
  }
}
</style>
