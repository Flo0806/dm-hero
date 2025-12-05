// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  modules: ['@nuxt/eslint', '@nuxtjs/i18n', '@vueuse/motion/nuxt', '@nuxt/content'],

  css: [
    'vuetify/styles',
    '@mdi/font/css/materialdesignicons.css',
    '@/assets/css/main.css',
    '@/assets/css/animations.css',
  ],

  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
    ],
    defaultLocale: 'en',
    langDir: '../i18n/locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'dm_hero_lang',
      fallbackLocale: 'en',
    },
  },

  build: {
    transpile: ['vuetify'],
  },

  vite: {
    ssr: {
      noExternal: ['vuetify'],
    },
  },

  app: {
    head: {
      title: 'DM Hero - Your D&D Campaign Companion',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'The ultimate campaign management tool for Dungeon Masters. Track NPCs, locations, items, and sessions with powerful search and AI features.',
        },
        { name: 'theme-color', content: '#1A1D29' },
        { property: 'og:title', content: 'DM Hero - Your D&D Campaign Companion' },
        {
          property: 'og:description',
          content:
            'The ultimate campaign management tool for Dungeon Masters. Track NPCs, locations, items, and sessions.',
        },
        { property: 'og:type', content: 'website' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },

  nitro: {
    preset: 'static',
  },
})
