import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { THEME_NAMES, themes } from '../../app/composables/themes'

// Every theme the switcher offers is defined and has a name in every language
const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'zh-CN']

describe('themes', () => {
  it('every listed theme has a definition with the colors the app relies on', () => {
    for (const name of THEME_NAMES) {
      const colors = themes[name].colors as Record<string, string>
      for (const key of ['background', 'surface', 'primary', 'on-surface']) expect(colors[key], `${name}.${key}`).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('every theme has a label in all six languages', () => {
    for (const locale of LOCALES) {
      const labels = JSON.parse(readFileSync(join(__dirname, `../../i18n/locales/${locale}.json`), 'utf8')).themes as Record<string, string>
      for (const name of THEME_NAMES) expect(labels[name], `${locale}: themes.${name}`).toBeTruthy()
    }
  })
})
