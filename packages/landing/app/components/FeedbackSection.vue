<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <section id="feedback" class="feedback-section py-12">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="8" lg="6">
          <v-card
            v-motion
            :initial="{ opacity: 0, y: 30 }"
            :visible-once="{ opacity: 1, y: 0 }"
            class="feedback-card pa-8 text-center"
            color="surface"
          >
            <v-icon size="48" color="info" class="mb-4">
              mdi-message-text-outline
            </v-icon>

            <h2 class="text-headline-medium font-weight-bold mb-4">
              {{ t('feedback.title') }}
            </h2>

            <p class="text-body-large text-medium-emphasis mb-6">
              {{ t('feedback.description') }}
            </p>

            <v-btn
              href="https://github.com/Flo0806/dm-hero/discussions"
              target="_blank"
              color="info"
              size="large"
              variant="tonal"
              class="feedback-btn"
            >
              <v-icon start>mdi-github</v-icon>
              {{ t('feedback.button') }}
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
.feedback-section {
  position: relative;
}

.feedback-card {
  border: 1px solid rgba(var(--v-theme-info), 0.2);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.feedback-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.2),
    0 0 40px rgba(33, 150, 243, 0.1);
}

.feedback-btn {
  text-transform: none;
  font-weight: 600;
}
</style>
