import { defineConfig, presetIcons, presetWind4 } from 'unocss'

/**
 * DM Hero dark theme. Components use these semantic names, never raw
 * palette values, so the scheme can change in one place.
 */
export default defineConfig({
  presets: [
    presetWind4(),
    presetIcons({
      scale: 1.15,
      extraProperties: { 'display': 'inline-block', 'vertical-align': '-0.15em' },
    }),
  ],
  theme: {
    colors: {
      bg: '#1a1d29',
      surface: '#232736',
      line: '#d4a57447',
      ink: '#ece6da',
      // Solid (not alpha) so contrast stays ≥ 6:1 even over the background glow
      muted: '#aaa7a2',
      primary: { DEFAULT: '#d4a574', hover: '#e8bd8c' },
      ember: '#8b4513',
    },
    font: {
      sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
  },
  shortcuts: {
    'focus-ring': 'outline-none focus-visible:ring-3 focus-visible:ring-primary/30',
  },
  preflights: [
    {
      // Base colors + the slow background drift (no external fonts or assets)
      getCSS: () => `
        html, body { background: #1a1d29; color: #ece6da; -webkit-font-smoothing: antialiased; }
        @keyframes drift { from { transform: translate(0, 0) scale(1) } to { transform: translate(40px, 30px) scale(1.12) } }
      `,
    },
  ],
})
