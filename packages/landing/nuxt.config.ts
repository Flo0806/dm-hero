// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  modules: ['@nuxt/eslint', '@nuxtjs/i18n', '@vueuse/motion/nuxt', '@nuxt/content', '@pinia/nuxt'],

  eslint: {
    config: {
      stylistic: false,
    },
  },

  css: [
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
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    },
  },

  nitro: {
    // No preset = node-server for API routes
    storage: {
      uploads: {
        driver: 'fs',
        base: './uploads',
      },
    },
    // Serve uploads directory
    publicAssets: [
      {
        dir: 'uploads',
        baseURL: '/uploads',
        maxAge: 60 * 60 * 24 * 7, // 1 week cache
      },
    ],
  },

  runtimeConfig: {
    // Server-only env vars
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || '3306',
    dbName: process.env.DB_NAME || 'dmhero',
    dbUser: process.env.DB_USER || 'dmhero_user',
    dbPassword: process.env.DB_PASSWORD || '',
    jwtSecret: process.env.JWT_SECRET || 'change_me_in_production',
    // SMTP config for email
    smtpHost: process.env.SMTP_HOST || 'smtp.ionos.de',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER || 'noreply@dm-hero.com',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    smtpFrom: process.env.SMTP_FROM || 'DM Hero <noreply@dm-hero.com>',
    // Admin email for validation notifications
    adminEmail: process.env.ADMIN_EMAIL || 'fh@flogersoft.de',
    // Uploads directory
    uploadsDir: process.env.UPLOADS_DIR || './uploads',
    // Public env vars (exposed to client)
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3001',
    },
  },
})
