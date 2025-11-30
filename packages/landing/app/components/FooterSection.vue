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

      <!-- Divider -->
      <v-divider class="my-8" color="primary" opacity="0.2" />

      <!-- Tech Stack -->
      <div class="text-center">
        <p class="text-caption text-disabled mb-3">Built with</p>
        <div class="d-flex justify-center align-center ga-4 flex-wrap">
          <v-chip size="small" variant="outlined" color="primary">
            <v-icon start size="small">mdi-nuxt</v-icon>
            Nuxt 4
          </v-chip>
          <v-chip size="small" variant="outlined" color="primary">
            <v-icon start size="small">mdi-vuetify</v-icon>
            Vuetify 3
          </v-chip>
          <v-chip size="small" variant="outlined" color="primary">
            <v-icon start size="small">mdi-database</v-icon>
            SQLite
          </v-chip>
          <v-chip size="small" variant="outlined" color="primary">
            <v-icon start size="small">mdi-electron-framework</v-icon>
            Electron
          </v-chip>
        </div>
      </div>
    </v-container>
  </footer>
</template>

<style scoped>
.footer-section {
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.2) 100%);
  border-top: 1px solid rgba(var(--v-theme-primary), 0.1);
}
</style>
