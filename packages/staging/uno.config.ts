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
      danger: '#ff8a80',
      success: '#7bd88f',
    },
    font: {
      sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
  },
  shortcuts: {
    'focus-ring': 'outline-none focus-visible:ring-3 focus-visible:ring-primary/30',
    'field': 'flex-1 min-w-0 px-4.5 py-3.5 rounded-xl border border-line bg-surface/85 text-ink text-center text-lg font-bold tracking-[0.18em] transition placeholder:tracking-normal placeholder:font-normal placeholder:text-muted outline-none focus:border-primary focus:ring-3 focus:ring-primary/25',
    'btn-map': 'min-w-10 h-10 px-2 inline-flex items-center justify-center rounded-lg border border-line bg-surface/85 text-ink font-bold cursor-pointer transition hover:border-primary focus-ring',
    'btn-primary': 'px-5.5 py-3.5 rounded-xl border-none bg-primary text-bg font-bold cursor-pointer transition hover:enabled:bg-primary-hover active:enabled:scale-97 disabled:opacity-45 disabled:cursor-not-allowed focus-ring',
  },
  preflights: [
    {
      // Base colors + the slow background drift (no external fonts or assets)
      getCSS: () => `
        html, body { background: #1a1d29; color: #ece6da; -webkit-font-smoothing: antialiased; }
        @keyframes drift { from { transform: translate(0, 0) scale(1) } to { transform: translate(40px, 30px) scale(1.12) } }
        @keyframes reveal-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(212, 165, 116, 0) } 40% { box-shadow: 0 0 0 4px rgba(212, 165, 116, 0.55), 0 0 32px 6px rgba(212, 165, 116, 0.45) } }
        @keyframes reveal-in { from { opacity: 0; transform: translate(-50%, -12px) } to { opacity: 1; transform: translate(-50%, 0) } }
      `,
    },
  ],
})
