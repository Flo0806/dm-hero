import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// DnD-inspired theme colors
const lightTheme = {
  dark: false,
  colors: {
    // "Aged Parchment" theme
    background: '#F5F1E8', // Warm parchment white
    surface: '#FFFFFF',
    'surface-variant': '#E8DCC4',
    'on-surface-variant': '#4A4035',
    primary: '#8B4513', // Saddle brown (leather binding)
    'primary-darken-1': '#654321',
    secondary: '#B8860B', // Dark goldenrod (old gold)
    'secondary-darken-1': '#996515',
    accent: '#8B0000', // Burgundy (sealing wax)
    error: '#C62828',
    info: '#5B7C99', // Gray-blue (ink)
    success: '#558B2F',
    warning: '#F57C00',
    'on-background': '#2C1810',
    'on-surface': '#2C1810',
    'on-primary': '#FFFFFF',
    'on-secondary': '#2C1810',
  },
}

const darkTheme = {
  dark: true,
  colors: {
    // "Midnight Tavern" theme
    background: '#1A1D29', // Dark tavern
    surface: '#232632',
    'surface-variant': '#2D3142',
    'on-surface-variant': '#C5B8A0',
    primary: '#D4A574', // Warm gold
    'primary-darken-1': '#B8935F',
    secondary: '#8B7355', // Dark leather
    'secondary-darken-1': '#6B5742',
    accent: '#CC8844', // Amber
    error: '#D32F2F',
    info: '#7B92AB', // Moonlight blue
    success: '#689F38',
    warning: '#F57C00',
    'on-background': '#E8DCC4',
    'on-surface': '#E8DCC4',
    'on-primary': '#1A1D29',
    'on-secondary': '#E8DCC4',
  },
}

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'dark',
      themes: {
        light: lightTheme,
        dark: darkTheme,
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
