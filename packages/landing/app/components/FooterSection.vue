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
            <!-- Discord with custom SVG icon -->
            <v-btn
              href="https://discord.gg/66JKJQEcSx"
              target="_blank"
              variant="tonal"
              color="primary"
              size="small"
            >
              <svg class="discord-icon mr-2" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/>
              </svg>
              {{ t('footer.links.discord') }}
            </v-btn>
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
        <NuxtLink to="/terms" class="legal-link text-caption text-medium-emphasis mx-3">
          {{ t('legal.terms.title') }}
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
  background: linear-gradient(180deg, rgba(26, 29, 41, 0.95) 0%, rgba(19, 21, 29, 1) 100%);
  border-top: 1px solid rgba(var(--v-theme-primary), 0.2);
  position: relative;
  z-index: 2;
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

.discord-icon {
  vertical-align: middle;
}
</style>
