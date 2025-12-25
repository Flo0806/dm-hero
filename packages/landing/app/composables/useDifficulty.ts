/**
 * Difficulty levels: 1-5
 * 1 = Easy, 2 = Moderate, 3 = Challenging, 4 = Hard, 5 = Deadly
 */

export interface DifficultyInfo {
  level: number
  key: string
  color: string
  icon: string
}

const DIFFICULTY_MAP: DifficultyInfo[] = [
  { level: 1, key: 'easy', color: 'success', icon: 'mdi-shield-outline' },
  { level: 2, key: 'moderate', color: 'light-green', icon: 'mdi-shield-half-full' },
  { level: 3, key: 'challenging', color: 'warning', icon: 'mdi-shield' },
  { level: 4, key: 'hard', color: 'orange', icon: 'mdi-sword-cross' },
  { level: 5, key: 'deadly', color: 'error', icon: 'mdi-skull' },
]

export function useDifficulty() {
  const { t } = useI18n()

  function getDifficultyInfo(level: number): DifficultyInfo {
    // Clamp level to 1-5 range
    const clampedLevel = Math.max(1, Math.min(5, Math.round(level) || 3))
    return DIFFICULTY_MAP[clampedLevel - 1]
  }

  function getDifficultyKey(level: number): string {
    return getDifficultyInfo(level).key
  }

  function getDifficultyColor(level: number): string {
    return getDifficultyInfo(level).color
  }

  function getDifficultyIcon(level: number): string {
    return getDifficultyInfo(level).icon
  }

  function getDifficultyLabel(level: number): string {
    const key = getDifficultyKey(level)
    return t(`store.difficulty.${key}`)
  }

  return {
    getDifficultyInfo,
    getDifficultyKey,
    getDifficultyColor,
    getDifficultyIcon,
    getDifficultyLabel,
    DIFFICULTY_MAP,
  }
}
