<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <section id="support" class="support-section py-16">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="8" lg="6">
          <v-card
            v-motion
            :initial="{ opacity: 0, y: 30 }"
            :visible-once="{ opacity: 1, y: 0 }"
            class="support-card pa-8 text-center"
            color="surface"
          >
            <v-icon size="48" color="primary" class="mb-4">
              mdi-heart
            </v-icon>

            <h2 class="text-headline-large font-weight-bold mb-4 gradient-text">
              {{ t('support.title') }}
            </h2>

            <p class="text-body-large text-medium-emphasis mb-4">
              {{ t('support.description') }}
            </p>

            <p class="text-body-medium text-medium-emphasis mb-6">
              {{ t('support.whatIs') }}
            </p>

            <a
              href="https://buymeacoffee.com/flo0806"
              target="_blank"
              rel="noopener noreferrer"
              class="bmc-link"
            >
              <img
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                alt="Buy Me A Coffee"
                class="bmc-button"
              />
            </a>

            <p class="text-body-small text-medium-emphasis mt-6">
              {{ t('support.note') }}
            </p>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
.support-section {
  position: relative;
}

.support-card {
  border: 1px solid rgba(var(--v-theme-warning), 0.2);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.support-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.2),
    0 0 40px rgba(255, 193, 7, 0.1);
}

.bmc-link {
  display: inline-block;
  transition: transform 0.2s ease;
}

.bmc-link:hover {
  transform: scale(1.05);
}

.bmc-button {
  height: 60px;
  width: auto;
}
</style>
