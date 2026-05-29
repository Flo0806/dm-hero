import type { ThemeName } from './themes'

/**
 * Per-theme dashboard ambience (#322). Each theme gets its own subtle background
 * animation that fits its mood. Most themes use the generic AmbientParticles
 * component (a parameterised particle field); 'emily' is special and uses its
 * bespoke lightning instead (see DashboardAmbient).
 *
 * All ambience is purely decorative, behind the content, and gated on the
 * "Spielereien" toggle + prefers-reduced-motion.
 */
export type AmbientMode = 'rise' | 'drift' | 'fall' | 'twinkle' | 'firefly' | 'streak'

export interface AmbientConfig {
  /** How the particles move. */
  mode: AmbientMode
  /** Particle colours, picked at random per particle. */
  colors: string[]
  /** How many particles. */
  count: number
  /** Particle size range, px. */
  sizeMin: number
  sizeMax: number
  /** Animation cycle range, seconds. */
  durationMin: number
  durationMax: number
  /** Soft glow halo around each particle. */
  glow?: boolean
}

// 'emily' is intentionally absent — it keeps its bespoke lightning.
export const THEME_AMBIENT: Partial<Record<ThemeName, AmbientConfig>> = {
  // Candlelit tavern — warm gold embers drifting up.
  dark: { mode: 'rise', colors: ['#D4A574', '#CC8844', '#E0B080'], count: 22, sizeMin: 2, sizeMax: 4, durationMin: 8, durationMax: 16, glow: true },
  // Daylit parchment — dust settling down through a sunbeam (darker motes so
  // they read on the light background).
  hell: { mode: 'fall', colors: ['#8B4513', '#B8860B', '#A9791C'], count: 26, sizeMin: 3, sizeMax: 6, durationMin: 9, durationMax: 16 },
  // Ubuntu — energetic orange sparks streaking across.
  linux: { mode: 'streak', colors: ['#E95420', '#DD4814', '#F0824E'], count: 14, sizeMin: 2, sizeMax: 4, durationMin: 4, durationMax: 8, glow: true },
  // Forest — fireflies blinking and drifting.
  green: { mode: 'firefly', colors: ['#7CFFB0', '#4CAF7C', '#FFE082'], count: 16, sizeMin: 2, sizeMax: 4, durationMin: 5, durationMax: 11, glow: true },
  // Deep ocean — bubbles rising.
  blue: { mode: 'rise', colors: ['#4FC3F7', '#81D4FA', '#B3E5FC'], count: 18, sizeMin: 3, sizeMax: 7, durationMin: 10, durationMax: 20, glow: true },
  // Arcane — magic sparkles twinkling.
  purple: { mode: 'twinkle', colors: ['#B388FF', '#D1C4E9', '#FFD740'], count: 26, sizeMin: 2, sizeMax: 4, durationMin: 4, durationMax: 9, glow: true },
  // Forge fire — embers rising.
  orange: { mode: 'rise', colors: ['#FF7043', '#FFCA28', '#FF8A65'], count: 24, sizeMin: 2, sizeMax: 4, durationMin: 6, durationMax: 13, glow: true },
}
