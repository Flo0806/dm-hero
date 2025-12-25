/**
 * Smart playtime formatter
 * Displays time intelligently based on magnitude:
 * - < 1 hour: "45 min"
 * - < 24 hours: "5h 30min"
 * - < 7 days: "2d 5h"
 * - < 30 days: "2w 3d"
 * - < 365 days: "3mo 2w"
 * - >= 365 days: "1y 3mo"
 */
export function usePlaytime() {
  const { t } = useI18n()

  function formatPlaytime(totalMinutes: number): string {
    if (!totalMinutes || totalMinutes <= 0) {
      return '-'
    }

    const minutes = totalMinutes % 60
    const totalHours = Math.floor(totalMinutes / 60)
    const hours = totalHours % 24
    const totalDays = Math.floor(totalHours / 24)
    const days = totalDays % 7
    const totalWeeks = Math.floor(totalDays / 7)
    const weeks = totalWeeks % 4
    const totalMonths = Math.floor(totalDays / 30)
    const months = totalMonths % 12
    const years = Math.floor(totalMonths / 12)

    // Less than 1 hour
    if (totalHours < 1) {
      return t('dashboard.playtime.minutes', { count: totalMinutes })
    }

    // Less than 24 hours
    if (totalHours < 24) {
      if (minutes > 0) {
        return t('dashboard.playtime.hoursMinutes', { hours: totalHours, minutes })
      }
      return t('dashboard.playtime.hours', { count: totalHours })
    }

    // Less than 7 days
    if (totalDays < 7) {
      if (hours > 0) {
        return t('dashboard.playtime.daysHours', { days: totalDays, hours })
      }
      return t('dashboard.playtime.days', { count: totalDays })
    }

    // Less than ~30 days (show weeks)
    if (totalDays < 30) {
      if (days > 0) {
        return t('dashboard.playtime.weeksDays', { weeks: totalWeeks, days })
      }
      return t('dashboard.playtime.weeks', { count: totalWeeks })
    }

    // Less than a year
    if (years < 1) {
      if (weeks > 0) {
        return t('dashboard.playtime.monthsWeeks', { months: totalMonths, weeks })
      }
      return t('dashboard.playtime.months', { count: totalMonths })
    }

    // A year or more
    if (months > 0) {
      return t('dashboard.playtime.yearsMonths', { years, months })
    }
    return t('dashboard.playtime.years', { count: years })
  }

  // Get a short summary like "47h" for compact display
  function formatPlaytimeShort(totalMinutes: number): string {
    if (!totalMinutes || totalMinutes <= 0) {
      return '0h'
    }

    const totalHours = Math.floor(totalMinutes / 60)
    const totalDays = Math.floor(totalHours / 24)

    if (totalHours < 1) {
      return `${totalMinutes}m`
    }

    if (totalDays < 1) {
      return `${totalHours}h`
    }

    return `${totalDays}d`
  }

  return {
    formatPlaytime,
    formatPlaytimeShort,
  }
}
