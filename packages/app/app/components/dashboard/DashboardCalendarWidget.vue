<template>
  <v-card
    class="dashboard-card h-100"
    variant="outlined"
    :to="hasCalendar ? '/calendar' : undefined"
    :hover="hasCalendar"
  >
    <v-card-text class="pa-4">
      <div class="d-flex align-center justify-space-between mb-3">
        <div class="d-flex align-center">
          <v-icon icon="mdi-calendar" color="primary" size="24" class="mr-2" />
          <span class="text-subtitle-1 font-weight-medium">{{ $t('dashboard.calendar.title') }}</span>
        </div>
        <v-icon v-if="hasCalendar" icon="mdi-chevron-right" size="20" class="text-medium-emphasis" />
      </div>

      <div v-if="loading" class="text-center py-4">
        <v-progress-circular indeterminate size="24" color="primary" />
      </div>

      <div v-else-if="hasCalendar">
        <!-- Current Date -->
        <div class="current-date d-flex align-center ga-3 pa-3 rounded-lg mb-3">
          <div class="date-day text-h4 font-weight-bold text-primary text-center">{{ currentDay }}.</div>
          <div class="flex-grow-1">
            <div class="text-subtitle-1 font-weight-medium">{{ currentMonthName }}</div>
            <div class="text-caption text-medium-emphasis">{{ currentMonth }}. {{ $t('dashboard.calendar.month') }}, {{ $t('dashboard.calendar.year') }} {{ currentYear }}</div>
            <div v-if="eraName" class="text-caption text-medium-emphasis font-italic">{{ eraName }}</div>
          </div>
        </div>

        <!-- Days since first session -->
        <div v-if="daysSinceFirstSession !== null" class="dashboard-info-box d-flex align-center py-1 px-3 rounded mb-2">
          <v-icon icon="mdi-flag-checkered" size="16" class="mr-1" />
          <span class="text-body-2">
            {{ $t('dashboard.calendar.daysSinceStart', { days: daysSinceFirstSession }) }}
          </span>
        </div>

        <!-- Weather (if available) -->
        <div v-if="weather" class="dashboard-info-box d-flex align-center py-2 px-3 rounded">
          <v-icon :icon="weatherIcon" size="18" class="mr-1" />
          <span class="text-body-2">{{ weatherLabel }}</span>
          <span v-if="weather.temperature" class="text-body-2 ml-2">
            {{ weather.temperature }}°
          </span>
        </div>
      </div>

      <div v-else class="d-flex flex-column align-center text-center py-4">
        <v-icon icon="mdi-calendar-plus" size="32" class="text-medium-emphasis mb-2" />
        <p class="text-body-2 text-medium-emphasis mb-2">
          {{ $t('dashboard.calendar.notConfigured') }}
        </p>
        <v-btn size="small" color="primary" variant="tonal" to="/calendar">
          {{ $t('dashboard.calendar.setup') }}
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface CalendarData {
  currentDay: number
  currentMonth: number
  currentMonthName: string
  currentYear: number
  eraName: string
}

interface WeatherData {
  weatherType: string
  temperature?: number
}

const props = defineProps<{
  calendar: CalendarData | null
  weather: WeatherData | null
  loading: boolean
  daysSinceFirstSession: number | null
}>()

const { t } = useI18n()

const hasCalendar = computed(() => !!props.calendar)
const currentDay = computed(() => props.calendar?.currentDay || 1)
const currentMonth = computed(() => props.calendar?.currentMonth || 1)
const currentMonthName = computed(() => props.calendar?.currentMonthName || '')
const currentYear = computed(() => props.calendar?.currentYear || 1)
const eraName = computed(() => props.calendar?.eraName || '')

const weatherTypes: Record<string, { icon: string; key: string }> = {
  sunny: { icon: 'mdi-weather-sunny', key: 'sunny' },
  partlyCloudy: { icon: 'mdi-weather-partly-cloudy', key: 'partlyCloudy' },
  cloudy: { icon: 'mdi-weather-cloudy', key: 'cloudy' },
  rain: { icon: 'mdi-weather-rainy', key: 'rain' },
  heavyRain: { icon: 'mdi-weather-pouring', key: 'heavyRain' },
  thunderstorm: { icon: 'mdi-weather-lightning-rainy', key: 'thunderstorm' },
  snow: { icon: 'mdi-weather-snowy', key: 'snow' },
  heavySnow: { icon: 'mdi-weather-snowy-heavy', key: 'heavySnow' },
  fog: { icon: 'mdi-weather-fog', key: 'fog' },
  windy: { icon: 'mdi-weather-windy', key: 'windy' },
  hail: { icon: 'mdi-weather-hail', key: 'hail' },
}

const weatherIcon = computed(() => {
  const type = props.weather?.weatherType || 'sunny'
  return weatherTypes[type]?.icon || 'mdi-weather-sunny'
})

const weatherLabel = computed(() => {
  const type = props.weather?.weatherType || 'sunny'
  const key = weatherTypes[type]?.key || 'sunny'
  return t(`calendar.weather.types.${key}`)
})
</script>

<style scoped>
.current-date {
  background: rgba(var(--v-theme-primary), 0.1);
}

.date-day {
  min-width: 48px;
  line-height: 1;
}
</style>
