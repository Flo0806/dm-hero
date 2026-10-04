// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@unocss/nuxt', '@nuxtjs/i18n'],
  devtools: { enabled: true },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
      meta: [
        { name: 'theme-color', content: '#1A1D29' },
        // Player pages are private game rooms - keep them out of search engines
        { name: 'robots', content: 'noindex' },
      ],
    },
  },

  runtimeConfig: {
    // Relay database (node:sqlite). Override with NUXT_DATABASE_PATH
    databasePath: '.data/staging.db',
    // Encrypted files (images ...). Override with NUXT_FILES_DIR
    filesDir: '.data/files',
    // Behind a reverse proxy (FRP, nginx): trust X-Forwarded-For for rate limits. NUXT_TRUST_PROXY
    trustProxy: false,
    // Cleanup: a game without contact from DM Hero is removed after this many days
    // (NUXT_GAME_TTL_DAYS); a player session unused this long ends (NUXT_SESSION_TTL_DAYS)
    gameTtlDays: 30,
    sessionTtlDays: 90,
  },

  // Live game pages need the browser (EventSource) - no server rendering
  routeRules: {
    '/play/**': { ssr: false },
  },

  compatibilityDate: '2025-07-15',

  // Same code style as the DM Hero app
  eslint: {
    config: {
      stylistic: {
        indent: 2,
        quotes: 'single',
        semi: false,
      },
    },
  },

  // Same languages as the DM Hero app. Default = browser language, fallback English.
  i18n: {
    locales: [
      { code: 'de', name: 'Deutsch', file: 'de.json' },
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'it', name: 'Italiano', file: 'it.json' },
      { code: 'zh-CN', name: '简体中文', file: 'zh-CN.json' },
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'dm_hero_player_lang',
      fallbackLocale: 'en',
    },
  },
})
