import { useTheme } from 'vuetify'
import { THEME_NAMES, DEFAULT_THEME, type ThemeName } from './themes'

export const THEME_COOKIE = 'dm-hero-theme'

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return !!value && (THEME_NAMES as readonly string[]).includes(value)
}

/**
 * Theme preference persisted via Nuxt cookie — so the server can read it on
 * the first request and Vuetify boots straight into the right theme (no flash
 * of dark mode before hydration).
 */
export function useThemePreference() {
  const theme = useTheme()
  // 1y cookie, SameSite=Lax so cookie is sent on normal navigations
  const cookie = useCookie<ThemeName>(THEME_COOKIE, {
    default: () => DEFAULT_THEME,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  // Sync vuetify ↔ cookie if they diverge on first access (e.g. cookie set on
  // the server, vuetify still on its plugin default).
  if (isThemeName(cookie.value) && theme.global.name.value !== cookie.value) {
    theme.global.name.value = cookie.value
  }

  const current = computed<ThemeName>(() => {
    const name = theme.global.name.value
    return isThemeName(name) ? name : DEFAULT_THEME
  })

  function setTheme(name: ThemeName) {
    theme.global.name.value = name
    cookie.value = name
  }

  function reset() {
    setTheme(DEFAULT_THEME)
  }

  return {
    current,
    setTheme,
    reset,
    available: THEME_NAMES,
    defaultTheme: DEFAULT_THEME,
  }
}
