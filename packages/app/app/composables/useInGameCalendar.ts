/**
 * Composable for In-Game Calendar operations
 * Handles conversion between absolute day numbers and calendar dates
 */

export interface CalendarMonth {
  id: number
  name: string
  days: number
  sort_order: number
}

export interface CalendarConfig {
  id: number
  campaign_id: number
  current_year: number
  current_month: number
  current_day: number
  year_zero_name: string
  era_name: string
  leap_year_interval: number
  leap_year_month: number
  leap_year_extra_days: number
}

export interface CalendarData {
  config: CalendarConfig
  months: CalendarMonth[]
  weekdays: Array<{ id: number; name: string; sort_order: number }>
  moons: Array<{
    id: number
    name: string
    cycle_days: number
    full_moon_duration: number
    new_moon_duration: number
    phase_offset: number
  }>
}

export interface InGameDate {
  year: number
  month: number // 1-based index
  day: number
  monthName: string
}

export function useInGameCalendar() {
  const campaignStore = useCampaignStore()
  const calendarData = ref<CalendarData | null>(null)
  const loading = ref(false)

  /**
   * Load calendar configuration for current campaign
   */
  async function loadCalendar(): Promise<CalendarData | null> {
    if (!campaignStore.activeCampaignId) return null

    loading.value = true
    try {
      const data = await $fetch<CalendarData>('/api/calendar/config', {
        query: { campaignId: campaignStore.activeCampaignId },
      })
      calendarData.value = data
      return data
    } catch (error) {
      console.error('Failed to load calendar:', error)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Calculate total days in a year (accounting for leap years)
   */
  function getDaysInYear(year: number, months: CalendarMonth[], config: CalendarConfig): number {
    let totalDays = months.reduce((sum, m) => sum + m.days, 0)

    // Add leap year days if applicable
    if (config.leap_year_interval > 0 && year % config.leap_year_interval === 0) {
      totalDays += config.leap_year_extra_days
    }

    return totalDays
  }

  /**
   * Check if a year is a leap year
   */
  function isLeapYear(year: number, config: CalendarConfig): boolean {
    return config.leap_year_interval > 0 && year % config.leap_year_interval === 0
  }

  /**
   * Get days in a specific month (accounting for leap year extra days)
   */
  function getDaysInMonth(
    year: number,
    monthIndex: number,
    months: CalendarMonth[],
    config: CalendarConfig,
  ): number {
    const month = months[monthIndex]
    if (!month) return 30

    let days = month.days

    // Add leap year extra days to the designated month
    if (
      isLeapYear(year, config) &&
      config.leap_year_month > 0 &&
      monthIndex === config.leap_year_month - 1
    ) {
      days += config.leap_year_extra_days
    }

    return days
  }

  /**
   * Convert a calendar date to absolute day number
   * Day 1 = Year 1, Month 1, Day 1
   */
  function dateToAbsoluteDay(
    year: number,
    month: number,
    day: number,
    calendar?: CalendarData,
  ): number {
    const cal = calendar || calendarData.value
    if (!cal || cal.months.length === 0) return 0

    let totalDays = 0

    // Add days for complete years (year 1 to year-1)
    for (let y = 1; y < year; y++) {
      totalDays += getDaysInYear(y, cal.months, cal.config)
    }

    // Add days for complete months in current year
    for (let m = 0; m < month - 1; m++) {
      totalDays += getDaysInMonth(year, m, cal.months, cal.config)
    }

    // Add days in current month
    totalDays += day

    return totalDays
  }

  /**
   * Convert absolute day number to calendar date
   */
  function absoluteDayToDate(absoluteDay: number, calendar?: CalendarData): InGameDate | null {
    const cal = calendar || calendarData.value
    if (!cal || cal.months.length === 0 || absoluteDay <= 0) return null

    let remainingDays = absoluteDay
    let year = 1

    // Find the year
    while (true) {
      const daysInYear = getDaysInYear(year, cal.months, cal.config)
      if (remainingDays <= daysInYear) break
      remainingDays -= daysInYear
      year++
    }

    // Find the month
    let month = 1
    for (let m = 0; m < cal.months.length; m++) {
      const daysInMonth = getDaysInMonth(year, m, cal.months, cal.config)
      if (remainingDays <= daysInMonth) {
        month = m + 1
        break
      }
      remainingDays -= daysInMonth
      month = m + 2
    }

    // Remaining days is the day of the month
    const day = remainingDays

    const monthData = cal.months[month - 1]

    return {
      year,
      month,
      day,
      monthName: monthData?.name || `Month ${month}`,
    }
  }

  /**
   * Format a date for display
   */
  function formatDate(date: InGameDate, calendar?: CalendarData): string {
    const cal = calendar || calendarData.value
    const eraName = cal?.config.era_name || ''
    const suffix = eraName ? ` ${eraName}` : ''
    return `${date.day}. ${date.monthName}, Jahr ${date.year}${suffix}`
  }

  /**
   * Format absolute day for display
   */
  function formatAbsoluteDay(absoluteDay: number, calendar?: CalendarData): string {
    const date = absoluteDayToDate(absoluteDay, calendar)
    if (!date) return ''
    return formatDate(date, calendar)
  }

  /**
   * Get current in-game date from calendar config
   */
  function getCurrentDate(calendar?: CalendarData): InGameDate | null {
    const cal = calendar || calendarData.value
    if (!cal) return null

    const monthData = cal.months[cal.config.current_month - 1]
    return {
      year: cal.config.current_year,
      month: cal.config.current_month,
      day: cal.config.current_day,
      monthName: monthData?.name || `Month ${cal.config.current_month}`,
    }
  }

  /**
   * Get current date as absolute day
   */
  function getCurrentAbsoluteDay(calendar?: CalendarData): number {
    const cal = calendar || calendarData.value
    if (!cal) return 0

    return dateToAbsoluteDay(
      cal.config.current_year,
      cal.config.current_month,
      cal.config.current_day,
      cal,
    )
  }

  return {
    calendarData,
    loading,
    loadCalendar,
    dateToAbsoluteDay,
    absoluteDayToDate,
    formatDate,
    formatAbsoluteDay,
    getCurrentDate,
    getCurrentAbsoluteDay,
    getDaysInMonth,
    getDaysInYear,
    isLeapYear,
  }
}
