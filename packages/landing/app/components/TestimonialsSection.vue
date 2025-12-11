<script setup lang="ts">
import { testimonials } from '~/content-data/testimonials'

const { t } = useI18n()

// Current active testimonial index (Daniel Roe is first = featured)
const activeIndex = ref(0)

// Auto-rotate every 6 seconds
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  interval = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % testimonials.length
  }, 6000)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})

// Navigate to specific testimonial
function goTo(index: number) {
  activeIndex.value = index
  // Reset interval on manual navigation
  if (interval) clearInterval(interval)
  interval = setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % testimonials.length
  }, 6000)
}

// Get position class for each card
function getPosition(index: number): 'left' | 'center' | 'right' | 'hidden' {
  const total = testimonials.length
  const diff = (index - activeIndex.value + total) % total

  if (diff === 0) return 'center'
  if (diff === 1 || (diff === total - 1 && total === 2)) return 'right'
  if (diff === total - 1) return 'left'
  return 'hidden'
}

// Parse markdown italic (_text_ -> <em>text</em>)
function parseMarkdown(text: string): string {
  return text.replace(/_([^_]+)_/g, '<em>$1</em>')
}
</script>

<template>
  <section id="testimonials" class="testimonials-section py-16">
    <v-container>
      <!-- Section Header -->
      <div class="text-center mb-12">
        <h2
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0 }"
          class="section-title mb-4"
        >
          {{ t('testimonials.title') }}
        </h2>
        <p
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 200 } }"
          class="section-subtitle mx-auto"
          style="max-width: 600px"
        >
          {{ t('testimonials.subtitle') }}
        </p>
      </div>

      <!-- Carousel Container -->
      <div class="carousel-container">
        <div class="carousel-track">
          <div
            v-for="(testimonial, index) in testimonials"
            :key="testimonial.id"
            class="testimonial-card-wrapper"
            :class="`position-${getPosition(index)}`"
            @click="goTo(index)"
          >
            <v-card class="testimonial-card" :class="{ featured: getPosition(index) === 'center' }">
              <!-- Quote Icon -->
              <div class="quote-icon">
                <v-icon size="48" color="primary">mdi-format-quote-open</v-icon>
              </div>

              <!-- Quote Text -->
              <div class="quote-text" v-html="parseMarkdown(testimonial.quote)" />

              <!-- Author Info -->
              <div class="author-section">
                <a
                  :href="`https://github.com/${testimonial.githubUsername}`"
                  target="_blank"
                  rel="noopener"
                  class="author-link"
                  @click.stop
                >
                  <v-avatar size="56" class="author-avatar">
                    <v-img
                      :src="`https://github.com/${testimonial.githubUsername}.png`"
                      :alt="testimonial.githubUsername"
                    />
                  </v-avatar>
                </a>

                <div class="author-info">
                  <a
                    :href="`https://github.com/${testimonial.githubUsername}`"
                    target="_blank"
                    rel="noopener"
                    class="author-name"
                    @click.stop
                  >
                    @{{ testimonial.githubUsername }}
                    <v-icon size="14" class="ml-1">mdi-open-in-new</v-icon>
                  </a>
                  <div class="author-role">
                    {{ testimonial.role }}
                  </div>

                  <!-- Special Badge (e.g., Nuxt Core Team) -->
                  <v-chip
                    v-if="testimonial.badge"
                    size="small"
                    class="mt-2 badge-chip"
                    :style="{ backgroundColor: testimonial.badge.color + '20', color: testimonial.badge.color }"
                  >
                    <v-icon start size="16">{{ testimonial.badge.icon }}</v-icon>
                    {{ testimonial.badge.text }}
                  </v-chip>
                </div>
              </div>
            </v-card>
          </div>
        </div>

        <!-- Navigation Dots -->
        <div class="carousel-dots">
          <button
            v-for="(_, index) in testimonials"
            :key="index"
            class="carousel-dot"
            :class="{ active: index === activeIndex }"
            @click="goTo(index)"
          />
        </div>
      </div>
    </v-container>
  </section>
</template>

<style scoped>
.testimonials-section {
  position: relative;
  background: linear-gradient(180deg, transparent 0%, rgba(212, 165, 116, 0.05) 50%, transparent 100%);
  overflow: hidden;
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

.carousel-container {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.carousel-track {
  position: relative;
  height: 450px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.testimonial-card-wrapper {
  position: absolute;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.testimonial-card-wrapper.position-center {
  z-index: 3;
  transform: translateX(0) scale(1);
  opacity: 1;
}

.testimonial-card-wrapper.position-left {
  z-index: 2;
  transform: translateX(-85%) scale(0.85);
  opacity: 0.6;
  filter: brightness(0.7);
}

.testimonial-card-wrapper.position-right {
  z-index: 2;
  transform: translateX(85%) scale(0.85);
  opacity: 0.6;
  filter: brightness(0.7);
}

.testimonial-card-wrapper.position-hidden {
  z-index: 1;
  transform: translateX(0) scale(0.7);
  opacity: 0;
  pointer-events: none;
}

.testimonial-card {
  width: 500px;
  max-width: 90vw;
  padding: 40px;
  background: rgba(var(--v-theme-surface), 0.95);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 24px;
  transition: all 0.3s ease;
}

.testimonial-card.featured {
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.3),
    0 0 60px rgba(212, 165, 116, 0.15);
  border-color: rgba(var(--v-theme-primary), 0.4);
}

.testimonial-card.featured:hover {
  transform: translateY(-5px);
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.35),
    0 0 80px rgba(212, 165, 116, 0.2);
}

.quote-icon {
  margin-bottom: 20px;
  opacity: 0.6;
}

.quote-text {
  font-size: 1.15rem;
  line-height: 1.8;
  color: rgba(var(--v-theme-on-surface), 0.9);
  margin-bottom: 30px;
  font-style: italic;
}

.quote-text :deep(em) {
  font-style: normal;
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.author-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.author-link {
  text-decoration: none;
  transition: transform 0.3s ease;
}

.author-link:hover {
  transform: scale(1.1);
}

.author-avatar {
  border: 3px solid rgba(var(--v-theme-primary), 0.3);
  transition: border-color 0.3s ease;
}

.author-link:hover .author-avatar {
  border-color: rgb(var(--v-theme-primary));
}

.author-info {
  flex: 1;
}

.author-name {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: color 0.3s ease;
}

.author-name:hover {
  color: rgb(var(--v-theme-primary));
}

.author-role {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
}

.badge-chip {
  font-weight: 600;
  border: 1px solid currentColor;
}

.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 40px;
}

.carousel-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(var(--v-theme-primary), 0.5);
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
}

.carousel-dot:hover {
  border-color: rgb(var(--v-theme-primary));
  transform: scale(1.2);
}

.carousel-dot.active {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  transform: scale(1.3);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .carousel-track {
    height: 500px;
  }

  .testimonial-card {
    width: 340px;
    padding: 28px;
  }

  .testimonial-card-wrapper.position-left,
  .testimonial-card-wrapper.position-right {
    opacity: 0;
    pointer-events: none;
  }

  .quote-text {
    font-size: 1rem;
  }
}
</style>
