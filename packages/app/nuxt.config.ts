// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/test-utils', '@nuxtjs/i18n', '@pinia/nuxt'],

  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.css',
    '@/assets/md-editor-theme.css',
    '@/assets/css/animations.css',
  ],

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
    ],
    defaultLocale: 'de',
    langDir: 'locales',
    strategy: 'no_prefix',
  },

  build: {
    transpile: ['vuetify'],
  },

  vite: {
    ssr: {
      noExternal: ['vuetify'],
    },
  },

  nitro: {
    storage: {
      pictures: {
        driver: 'fs',
        base: './uploads',
      },
    },
    // Mark better-sqlite3 as external to preserve native bindings
    rollupConfig: {
      external: ['better-sqlite3'],
    },
  },
  hooks: {
    'vite:extendConfig': extendViteConfig,
  },
})

function extendViteConfig(config: import('vite').UserConfig) {
  const plugin = config.plugins?.find((p: unknown) => isPlugin(p, 'nuxt:environments'))
  if (plugin) plugin.enforce = 'pre'
}

function isPlugin(plugin: unknown, name: string): plugin is import('vite').Plugin {
  return !!(plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === name)
}
