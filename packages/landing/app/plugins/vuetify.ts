import { createVuetify, type ThemeDefinition } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

const dmHeroDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#1A1D29',
    surface: '#242836',
    'surface-bright': '#2E3344',
    'surface-light': '#363C50',
    'surface-variant': '#424659',
    primary: '#D4A574',
    'primary-darken-1': '#B8956A',
    secondary: '#8B7355',
    'secondary-darken-1': '#6B5A45',
    accent: '#FFD700',
    error: '#CF6679',
    info: '#64B5F6',
    success: '#81C784',
    warning: '#FFB74D',
    'on-background': '#E8E6E3',
    'on-surface': '#E8E6E3',
    'on-primary': '#1A1D29',
    'on-secondary': '#1A1D29',
  },
}

const dmHeroLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#F5F1E8',
    surface: '#FFFFFF',
    'surface-bright': '#FAFAFA',
    'surface-light': '#F0EDE6',
    'surface-variant': '#E8E4DB',
    primary: '#8B4513',
    'primary-darken-1': '#6B3410',
    secondary: '#B8860B',
    'secondary-darken-1': '#8B6508',
    accent: '#DAA520',
    error: '#B00020',
    info: '#1976D2',
    success: '#388E3C',
    warning: '#F57C00',
    'on-background': '#2C2C2C',
    'on-surface': '#2C2C2C',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
  },
}

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    components,
    directives,
    ssr: true,
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi,
      },
    },
    theme: {
      defaultTheme: 'dmHeroDark',
      themes: {
        dmHeroDark,
        dmHeroLight,
      },
    },
    defaults: {
      VBtn: {
        elevation: 0,
        rounded: 'lg',
      },
      VCard: {
        elevation: 0,
        rounded: 'lg',
      },
      VSheet: {
        elevation: 0,
      },
    },
  })
  app.vueApp.use(vuetify)
})
