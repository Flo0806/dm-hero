import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { de, en, zhHans } from 'vuetify/locale'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { themes, DEFAULT_THEME, THEME_NAMES, type ThemeName } from '~/composables/themes'
import { THEME_COOKIE } from '~/composables/useThemePreference'

export default defineNuxtPlugin((nuxtApp) => {
  // Read the saved theme cookie so SSR renders with the correct theme from
  // the start — no flash of dark mode on first paint.
  const savedTheme = useCookie<ThemeName>(THEME_COOKIE, {
    default: () => DEFAULT_THEME,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const initialTheme = (THEME_NAMES as readonly string[]).includes(savedTheme.value)
    ? savedTheme.value
    : DEFAULT_THEME

  const vuetify = createVuetify({
    components,
    directives,
    locale: {
      locale: 'de',
      fallback: 'en',
      messages: { de, en, zhHans },
    },
    theme: {
      defaultTheme: initialTheme,
      themes,
    },
    // Pin the v3 breakpoint thresholds so layouts written against v3 still match v4.
    // v4 default breakpoints are smaller and shift everything down — see #301.
    display: {
      thresholds: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1280,
        xl: 1920,
        xxl: 2560,
      },
    },
    defaults: {
      global: {
        elevation: 0, // No elevation as requested
      },
      VCard: {
        elevation: 0,
      },
      VBtn: {
        elevation: 0,
      },
      VAppBar: {
        elevation: 0,
      },
      VNavigationDrawer: {
        elevation: 0,
      },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
