import type { ThemeDefinition } from 'vuetify'

/**
 * DM Hero themes — 7 total: dark (default), hell, and 5 colored.
 * Each defines vuetify palette + md-editor-v3 css vars.
 */

// "Midnight Tavern" — default
const dark: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#1A1D29',
    'surface': '#232632',
    'surface-variant': '#2D3142',
    'on-surface-variant': '#C5B8A0',
    'primary': '#D4A574',
    'primary-darken-1': '#B8935F',
    'secondary': '#8B7355',
    'secondary-darken-1': '#6B5742',
    'accent': '#CC8844',
    'error': '#D32F2F',
    'info': '#7B92AB',
    'success': '#689F38',
    'warning': '#F9A825',
    'on-background': '#E8DCC4',
    'on-surface': '#E8DCC4',
    'on-primary': '#1A1D29',
    'on-secondary': '#E8DCC4',
  },
  variables: {
    'md-bg': '#1A1D29',
    'md-surface': '#232632',
    'md-text': '#E8DCC4',
    'md-muted': '#C5B8A0',
    'md-border': '#2D3142',
    'md-primary': '#D4A574',
    'md-code-bg': '#11151F',
    'md-quote-bg': '#202534',
    'md-table-stripe': '#1F2330',
  },
}

// "Aged Parchment" — light
const hell: ThemeDefinition = {
  dark: false,
  colors: {
    'background': '#F5F1E8',
    'surface': '#FFFFFF',
    'surface-variant': '#E8DCC4',
    'on-surface-variant': '#4A4035',
    'primary': '#8B4513',
    'primary-darken-1': '#654321',
    'secondary': '#B8860B',
    'secondary-darken-1': '#996515',
    'accent': '#8B0000',
    'error': '#C62828',
    'info': '#5B7C99',
    'success': '#558B2F',
    'warning': '#F57C00',
    'on-background': '#2C1810',
    'on-surface': '#2C1810',
    'on-primary': '#FFFFFF',
    'on-secondary': '#2C1810',
  },
  variables: {
    'md-bg': '#FFFFFF',
    'md-surface': '#F5F1E8',
    'md-text': '#2C1810',
    'md-muted': '#4A4035',
    'md-border': '#E8DCC4',
    'md-primary': '#8B4513',
    'md-code-bg': '#FAF6EE',
    'md-quote-bg': '#FFF9F0',
    'md-table-stripe': '#FAF2E3',
  },
}

// "Ubuntu" — pink/violet, warm dark base
const linux: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#2C001E',
    'surface': '#3D0B2C',
    'surface-variant': '#4B1639',
    'on-surface-variant': '#E8B8D8',
    'primary': '#E95420',
    'primary-darken-1': '#C44520',
    'secondary': '#AEA79F',
    'secondary-darken-1': '#7D7A78',
    'accent': '#DD4814',
    'error': '#DF382C',
    'info': '#19B6EE',
    'success': '#38B44A',
    'warning': '#EFB73E',
    'on-background': '#F7E8F0',
    'on-surface': '#F7E8F0',
    'on-primary': '#FFFFFF',
    'on-secondary': '#2C001E',
  },
  variables: {
    'md-bg': '#2C001E',
    'md-surface': '#3D0B2C',
    'md-text': '#F7E8F0',
    'md-muted': '#E8B8D8',
    'md-border': '#4B1639',
    'md-primary': '#E95420',
    'md-code-bg': '#1F0014',
    'md-quote-bg': '#350B26',
    'md-table-stripe': '#330620',
  },
}

// "Forest" — mint/green
const green: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#0F1F1A',
    'surface': '#172D26',
    'surface-variant': '#1F3D33',
    'on-surface-variant': '#B8D8C5',
    'primary': '#4CAF7C',
    'primary-darken-1': '#388E5B',
    'secondary': '#7CB89A',
    'secondary-darken-1': '#5A9577',
    'accent': '#FFCA28',
    'error': '#E57373',
    'info': '#64B5F6',
    'success': '#66BB6A',
    'warning': '#FFA726',
    'on-background': '#E0F2E9',
    'on-surface': '#E0F2E9',
    'on-primary': '#0F1F1A',
    'on-secondary': '#0F1F1A',
  },
  variables: {
    'md-bg': '#0F1F1A',
    'md-surface': '#172D26',
    'md-text': '#E0F2E9',
    'md-muted': '#B8D8C5',
    'md-border': '#1F3D33',
    'md-primary': '#4CAF7C',
    'md-code-bg': '#0A1612',
    'md-quote-bg': '#142822',
    'md-table-stripe': '#142823',
  },
}

// "Ocean" — cool blue
const blue: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#0D1B2A',
    'surface': '#16263A',
    'surface-variant': '#1E3149',
    'on-surface-variant': '#B0CCE0',
    'primary': '#4FC3F7',
    'primary-darken-1': '#0288D1',
    'secondary': '#5F8FB5',
    'secondary-darken-1': '#3D6B8C',
    'accent': '#FF9100',
    'error': '#EF5350',
    'info': '#42A5F5',
    'success': '#66BB6A',
    'warning': '#FFA726',
    'on-background': '#E1F0FA',
    'on-surface': '#E1F0FA',
    'on-primary': '#0D1B2A',
    'on-secondary': '#0D1B2A',
  },
  variables: {
    'md-bg': '#0D1B2A',
    'md-surface': '#16263A',
    'md-text': '#E1F0FA',
    'md-muted': '#B0CCE0',
    'md-border': '#1E3149',
    'md-primary': '#4FC3F7',
    'md-code-bg': '#0A1420',
    'md-quote-bg': '#142235',
    'md-table-stripe': '#142133',
  },
}

// "Arcane" — purple/mystic
const purple: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#1A0F2E',
    'surface': '#261943',
    'surface-variant': '#322355',
    'on-surface-variant': '#D0B8E8',
    'primary': '#B388FF',
    'primary-darken-1': '#7C4DFF',
    'secondary': '#9575CD',
    'secondary-darken-1': '#673AB7',
    'accent': '#FFD740',
    'error': '#FF5252',
    'info': '#7986CB',
    'success': '#69F0AE',
    'warning': '#FFAB40',
    'on-background': '#EDE0FA',
    'on-surface': '#EDE0FA',
    'on-primary': '#1A0F2E',
    'on-secondary': '#1A0F2E',
  },
  variables: {
    'md-bg': '#1A0F2E',
    'md-surface': '#261943',
    'md-text': '#EDE0FA',
    'md-muted': '#D0B8E8',
    'md-border': '#322355',
    'md-primary': '#B388FF',
    'md-code-bg': '#120A20',
    'md-quote-bg': '#22153D',
    'md-table-stripe': '#22153D',
  },
}

// "Ember" — warm orange, like a campfire
const orange: ThemeDefinition = {
  dark: true,
  colors: {
    'background': '#1F1410',
    'surface': '#2E1F18',
    'surface-variant': '#3E2A21',
    'on-surface-variant': '#E8C5B0',
    'primary': '#FF7043',
    'primary-darken-1': '#E64A19',
    'secondary': '#BCAAA4',
    'secondary-darken-1': '#8D6E63',
    'accent': '#FFCA28',
    'error': '#E53935',
    'info': '#5C6BC0',
    'success': '#66BB6A',
    'warning': '#FFB300',
    'on-background': '#FAE8DD',
    'on-surface': '#FAE8DD',
    'on-primary': '#1F1410',
    'on-secondary': '#1F1410',
  },
  variables: {
    'md-bg': '#1F1410',
    'md-surface': '#2E1F18',
    'md-text': '#FAE8DD',
    'md-muted': '#E8C5B0',
    'md-border': '#3E2A21',
    'md-primary': '#FF7043',
    'md-code-bg': '#170D0A',
    'md-quote-bg': '#2A1A13',
    'md-table-stripe': '#2A1A13',
  },
}

export const themes = {
  dark,
  hell,
  linux,
  green,
  blue,
  purple,
  orange,
} as const

export type ThemeName = keyof typeof themes

export const THEME_NAMES: ThemeName[] = ['dark', 'hell', 'linux', 'green', 'blue', 'purple', 'orange']

export const DEFAULT_THEME: ThemeName = 'dark'

/** Preview swatch picked from each theme's primary + background for the switcher UI */
export function getThemeSwatch(name: ThemeName): { primary: string, background: string } {
  const t = themes[name]
  return {
    primary: (t.colors?.primary as string) ?? '#D4A574',
    background: (t.colors?.background as string) ?? '#1A1D29',
  }
}
