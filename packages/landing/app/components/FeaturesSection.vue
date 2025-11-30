<script setup lang="ts">
const { t } = useI18n()

const features = [
  {
    key: 'entities',
    icon: 'mdi-account-group',
    color: 'primary',
  },
  {
    key: 'search',
    icon: 'mdi-magnify',
    color: 'info',
  },
  {
    key: 'linking',
    icon: 'mdi-link-variant',
    color: 'secondary',
  },
  {
    key: 'calendar',
    icon: 'mdi-calendar-month',
    color: 'success',
  },
  {
    key: 'ai',
    icon: 'mdi-robot-happy',
    color: 'warning',
  },
  {
    key: 'local',
    icon: 'mdi-shield-lock',
    color: 'error',
  },
  {
    key: 'chaos',
    icon: 'mdi-graph',
    color: 'purple',
  },
  {
    key: 'markdown',
    icon: 'mdi-language-markdown',
    color: 'teal',
  },
]
</script>

<template>
  <section id="features" class="features-section py-16">
    <v-container>
      <!-- Section Header -->
      <div class="text-center mb-12">
        <h2
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0 }"
          class="section-title mb-4"
        >
          {{ t('features.title') }}
        </h2>
        <p
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 200 } }"
          class="section-subtitle mx-auto"
          style="max-width: 600px"
        >
          {{ t('features.subtitle') }}
        </p>
      </div>

      <!-- Features Grid -->
      <v-row>
        <v-col
          v-for="(feature, index) in features"
          :key="feature.key"
          cols="12"
          sm="6"
          lg="3"
        >
          <v-card
            v-motion
            :initial="{ opacity: 0, y: 30 }"
            :visible-once="{ opacity: 1, y: 0, transition: { delay: 100 * index } }"
            class="feature-card h-100 pa-6"
            color="surface"
          >
            <div class="feature-icon-wrapper mb-4">
              <div class="feature-icon" :class="`feature-icon--${feature.color}`">
                <v-icon size="32">{{ feature.icon }}</v-icon>
              </div>
            </div>

            <h3 class="feature-title mb-3">
              {{ t(`features.items.${feature.key}.title`) }}
            </h3>

            <p class="feature-description">
              {{ t(`features.items.${feature.key}.description`) }}
            </p>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
.features-section {
  position: relative;
  background: linear-gradient(180deg, transparent 0%, rgba(36, 40, 54, 0.3) 50%, transparent 100%);
}

.section-title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: rgb(var(--v-theme-on-background));
}

.section-subtitle {
  font-size: 1.1rem;
  color: rgba(var(--v-theme-on-background), 0.7);
  line-height: 1.6;
}

.feature-card {
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
  cursor: default;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.2),
    0 0 30px rgba(212, 165, 116, 0.1);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.feature-icon-wrapper {
  display: inline-block;
}

.feature-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  transition: all 0.3s ease;
}

.feature-icon--primary {
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.2) 0%, rgba(212, 165, 116, 0.05) 100%);
  color: rgb(var(--v-theme-primary));
}

.feature-icon--info {
  background: linear-gradient(135deg, rgba(100, 181, 246, 0.2) 0%, rgba(100, 181, 246, 0.05) 100%);
  color: rgb(var(--v-theme-info));
}

.feature-icon--secondary {
  background: linear-gradient(135deg, rgba(139, 115, 85, 0.2) 0%, rgba(139, 115, 85, 0.05) 100%);
  color: rgb(var(--v-theme-secondary));
}

.feature-icon--success {
  background: linear-gradient(135deg, rgba(129, 199, 132, 0.2) 0%, rgba(129, 199, 132, 0.05) 100%);
  color: rgb(var(--v-theme-success));
}

.feature-icon--warning {
  background: linear-gradient(135deg, rgba(255, 183, 77, 0.2) 0%, rgba(255, 183, 77, 0.05) 100%);
  color: rgb(var(--v-theme-warning));
}

.feature-icon--error {
  background: linear-gradient(135deg, rgba(207, 102, 121, 0.2) 0%, rgba(207, 102, 121, 0.05) 100%);
  color: rgb(var(--v-theme-error));
}

.feature-icon--purple {
  background: linear-gradient(135deg, rgba(186, 104, 200, 0.2) 0%, rgba(186, 104, 200, 0.05) 100%);
  color: #ba68c8;
}

.feature-icon--teal {
  background: linear-gradient(135deg, rgba(77, 182, 172, 0.2) 0%, rgba(77, 182, 172, 0.05) 100%);
  color: #4db6ac;
}

.feature-card:hover .feature-icon {
  transform: scale(1.1);
  box-shadow: 0 0 30px currentColor;
}

.feature-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.feature-description {
  font-size: 0.95rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.6;
  margin: 0;
}
</style>
