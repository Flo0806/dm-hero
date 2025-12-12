<script setup lang="ts">
const { t } = useI18n()

const currentYear = new Date().getFullYear()

const links = [
  {
    key: 'github',
    icon: 'mdi-github',
    href: 'https://github.com/Flo0806/dm-hero',
  },
  {
    key: 'issues',
    icon: 'mdi-bug',
    href: 'https://github.com/Flo0806/dm-hero/issues',
  },
  {
    key: 'releases',
    icon: 'mdi-tag-multiple',
    href: 'https://github.com/Flo0806/dm-hero/releases',
  },
  {
    key: 'license',
    icon: 'mdi-license',
    href: 'https://github.com/Flo0806/dm-hero/blob/main/LICENSE',
  },
]
</script>

<template>
  <footer class="footer-section py-12">
    <v-container>
      <v-row align="center" justify="space-between">
        <!-- Logo & Tagline -->
        <v-col cols="12" md="4" class="text-center text-md-start mb-6 mb-md-0">
          <div class="d-flex align-center justify-center justify-md-start mb-3">
            <v-icon size="40" color="primary" class="mr-3">mdi-shield-sword</v-icon>
            <span class="text-h5 font-weight-bold gradient-text">DM Hero</span>
          </div>
          <p class="text-body-2 text-medium-emphasis">
            {{ t('footer.tagline') }}
          </p>
        </v-col>

        <!-- Links -->
        <v-col cols="12" md="4" class="text-center mb-6 mb-md-0">
          <div class="d-flex justify-center ga-2 flex-wrap">
            <v-btn
              v-for="link in links"
              :key="link.key"
              :href="link.href"
              target="_blank"
              variant="tonal"
              color="primary"
              size="small"
            >
              <v-icon start size="small">{{ link.icon }}</v-icon>
              {{ t(`footer.links.${link.key}`) }}
            </v-btn>
          </div>
        </v-col>

        <!-- Made With -->
        <v-col cols="12" md="4" class="text-center text-md-end">
          <p class="text-body-2 text-medium-emphasis mb-2">
            {{ t('footer.madeWith') }}
            <v-icon size="small" color="error" class="mx-1">mdi-heart</v-icon>
            {{ t('footer.loveBy') }}
            <a
              href="https://github.com/Flo0806"
              target="_blank"
              class="text-primary text-decoration-none"
            >
              FH SoftDev
            </a>
          </p>
          <p class="text-caption text-disabled">
            {{ t('footer.copyright', { year: currentYear }) }}
          </p>
        </v-col>
      </v-row>

      <!-- Legal Links -->
      <div class="text-center mt-4">
        <NuxtLink to="/imprint" class="legal-link text-caption text-medium-emphasis mx-3">
          {{ t('legal.imprint.title') }}
        </NuxtLink>
        <NuxtLink to="/privacy" class="legal-link text-caption text-medium-emphasis mx-3">
          {{ t('legal.privacy.title') }}
        </NuxtLink>
      </div>

      <!-- Divider -->
      <v-divider class="my-8" color="primary" opacity="0.2" />

      <!-- Powered by Nuxt -->
      <div class="text-center">
        <a
          href="https://nuxt.com"
          target="_blank"
          class="powered-by-nuxt"
        >
          <span class="text-caption text-disabled">Powered by</span>
          <img src="/nuxt-icon.svg" alt="Nuxt" class="nuxt-logo" />
          <span class="nuxt-text">Nuxt</span>
        </a>
      </div>
    </v-container>
  </footer>
</template>

<style scoped>
.footer-section {
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.2) 100%);
  border-top: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.powered-by-nuxt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.powered-by-nuxt:hover {
  background-color: rgba(0, 220, 130, 0.1);
}

.nuxt-logo {
  width: 24px;
  height: 24px;
}

.nuxt-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: #00DC82;
}

.legal-link {
  text-decoration: none;
  transition: color 0.2s ease;
}

.legal-link:hover {
  color: rgb(var(--v-theme-primary)) !important;
}
</style>
