<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <div>
        <h1 class="text-h4">{{ $t('calendar.title') }}</h1>
        <p class="text-medium-emphasis">{{ $t('calendar.subtitle') }}</p>
      </div>
      <div class="d-flex ga-2 align-center">
        <v-btn-toggle v-model="showSessions" mandatory density="compact" class="mr-2">
          <v-btn :value="true" variant="tonal" size="small">
            <v-icon start>mdi-book-open-page-variant</v-icon>
            {{ $t('calendar.sessions') }}
            <v-chip size="x-small" class="ml-1" :color="showSessions ? 'primary' : undefined">
              {{ sessions.length }}
            </v-chip>
          </v-btn>
        </v-btn-toggle>
        <v-btn variant="tonal" prepend-icon="mdi-cog" @click="openSettingsDialog">
          {{ $t('calendar.settings') }}
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openNewEventDialog()">
          {{ $t('calendar.newEvent') }}
        </v-btn>
      </div>
    </div>

    <!-- Calendar not configured -->
    <v-card v-if="!isConfigured" class="pa-8 text-center">
      <v-icon size="64" color="grey">mdi-calendar-blank</v-icon>
      <h2 class="text-h5 mt-4">{{ $t('calendar.notConfigured') }}</h2>
      <p class="text-medium-emphasis mt-2">{{ $t('calendar.notConfiguredHint') }}</p>
      <v-btn color="primary" class="mt-4" @click="openSettingsDialog">
        {{ $t('calendar.setup') }}
      </v-btn>
    </v-card>

    <!-- Calendar View -->
    <template v-else>
      <!-- Current Date Display -->
      <v-card class="mb-4 pa-4">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center ga-4">
            <v-chip color="primary" size="large">
              <v-icon start>mdi-calendar-today</v-icon>
              {{ $t('calendar.today') }}: {{ currentDateFormatted }}
            </v-chip>
            <div v-for="moonPhase in currentMoonPhases" :key="moonPhase.name" class="d-flex align-center ga-2">
              <v-icon :color="getMoonColor(moonPhase.name)">{{ getMoonIconForPhase(moonPhase.phaseIndex) }}</v-icon>
              <span class="text-body-2">{{ moonPhase.name }}: {{ moonPhase.phase }}</span>
            </div>
          </div>
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-skip-next"
            :loading="advancingDay"
            @click="advanceDay"
          >
            {{ $t('calendar.advanceDay') }}
          </v-btn>
        </div>
      </v-card>

      <!-- Month Navigation -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center justify-space-between">
          <v-btn icon="mdi-chevron-left" variant="text" @click="prevMonth" />
          <div class="text-center">
            <span class="text-h5">{{ currentMonthName }}</span>
            <div class="d-flex align-center justify-center ga-2 mt-1">
              <v-btn icon="mdi-chevron-left" size="x-small" variant="text" @click="prevYear" />
              <span class="text-body-1">
                {{ $t('calendar.year') }} {{ viewYear }}
                <span v-if="calendarConfig.config.era_name">{{ calendarConfig.config.era_name }}</span>
              </span>
              <v-chip v-if="isLeapYear(viewYear)" size="x-small" color="info" class="ml-1">
                {{ $t('calendar.isLeapYear') }}
              </v-chip>
              <v-btn icon="mdi-chevron-right" size="x-small" variant="text" @click="nextYear" />
            </div>
          </div>
          <v-btn icon="mdi-chevron-right" variant="text" @click="nextMonth" />
        </v-card-title>

        <!-- Weekday Headers -->
        <v-card-text class="pa-2">
          <div class="calendar-grid" :style="calendarGridStyle">
            <div
              v-for="weekday in calendarConfig.weekdays"
              :key="weekday.id"
              class="calendar-header text-center text-caption font-weight-bold py-2"
            >
              {{ weekday.name }}
            </div>

            <!-- Empty cells before first day -->
            <div
              v-for="n in getFirstDayOffset()"
              :key="'empty-' + n"
              class="calendar-day empty"
            />

            <!-- Days -->
            <div
              v-for="day in currentMonthDays"
              :key="day"
              class="calendar-day"
              :class="{
                'is-today': isToday(day),
                'is-selected': selectedDay === day,
                'has-events': getEventsForDay(day).length > 0,
                'has-sessions': dayHasSessions(day),
              }"
              @click="selectDay(day)"
            >
              <div class="d-flex justify-space-between align-start">
                <div class="day-number">{{ day }}</div>
                <div v-if="calendarConfig.moons.length > 0" class="moon-phase">
                  <v-icon
                    v-for="moonPhase in getMoonPhasesForDay(day)"
                    :key="moonPhase.name"
                    size="14"
                    :color="getMoonColor(moonPhase.name)"
                    :title="moonPhase.name + ': ' + moonPhase.phase"
                  >
                    {{ getMoonIconForPhase(moonPhase.phaseIndex) }}
                  </v-icon>
                </div>
              </div>

              <!-- Sessions (shown before events) -->
              <div v-if="getSessionsForDay(day).length > 0" class="day-sessions">
                <v-tooltip
                  v-for="session in getSessionsForDay(day).slice(0, 2)"
                  :key="'session-' + session.id"
                  location="top"
                >
                  <template #activator="{ props: tooltipProps }">
                    <div
                      v-bind="tooltipProps"
                      class="session-item"
                      :class="{
                        'session-start': session.isStart,
                        'session-end': session.isEnd,
                        'session-continuation': session.isContinuation && !session.isEnd,
                        'session-single': session.isStart && session.isEnd,
                      }"
                      @click.stop="goToSession(session)"
                    >
                      <v-icon v-if="session.isStart" size="10" class="mr-1">mdi-book-open-page-variant</v-icon>
                      <v-icon v-else size="10" class="mr-1">mdi-arrow-right</v-icon>
                      <span class="session-title">
                        <template v-if="session.isStart">
                          #{{ session.session_number }} {{ session.title }}
                        </template>
                        <template v-else>
                          {{ $t('calendar.sessionContinues', { number: session.session_number }) }}
                        </template>
                      </span>
                    </div>
                  </template>
                  <div style="max-width: 300px">
                    <div class="d-flex align-center ga-2 mb-1">
                      <v-chip size="x-small" color="blue">
                        #{{ session.session_number }}
                      </v-chip>
                      <strong>{{ session.title }}</strong>
                    </div>
                    <div v-if="session.summary" class="text-caption mb-1">
                      {{ session.summary.slice(0, 150) }}{{ session.summary.length > 150 ? '...' : '' }}
                    </div>
                    <div class="d-flex ga-2 text-caption">
                      <span v-if="session.attendance_count > 0">
                        <v-icon size="12">mdi-account-group</v-icon> {{ session.attendance_count }}
                      </span>
                      <span v-if="session.duration_minutes">
                        <v-icon size="12">mdi-clock</v-icon> {{ Math.floor(session.duration_minutes / 60) }}h
                      </span>
                      <span v-if="session.date">
                        <v-icon size="12">mdi-calendar</v-icon> {{ session.date }}
                      </span>
                    </div>
                    <div v-if="!session.isStart && !session.isEnd" class="text-caption mt-1 text-warning">
                      {{ $t('calendar.multiDaySession') }}
                    </div>
                  </div>
                </v-tooltip>
                <div
                  v-if="getSessionsForDay(day).length > 2"
                  class="session-more text-caption text-medium-emphasis"
                >
                  +{{ getSessionsForDay(day).length - 2 }} {{ $t('calendar.sessions').toLowerCase() }}
                </div>
              </div>

              <!-- Events -->
              <div v-if="getEventsForDay(day).length > 0" class="day-events">
                <v-tooltip
                  v-for="event in getEventsForDay(day).slice(0, 3)"
                  :key="event.id"
                  location="top"
                >
                  <template #activator="{ props }">
                    <div
                      v-bind="props"
                      class="event-item"
                      :style="{ borderLeftColor: event.color || getEventTypeColor(event.event_type) }"
                    >
                      <v-icon size="10" class="mr-1">{{ getEventTypeIcon(event.event_type) }}</v-icon>
                      <span class="event-title">{{ event.title }}</span>
                      <v-icon v-if="event.is_recurring" size="10" class="ml-1">mdi-sync</v-icon>
                    </div>
                  </template>
                  <div>
                    <strong>{{ event.title }}</strong>
                    <div class="text-caption">{{ $t('calendar.eventTypes.' + event.event_type) }}</div>
                    <div v-if="event.entity_name" class="text-caption">{{ event.entity_name }}</div>
                  </div>
                </v-tooltip>
                <div
                  v-if="getEventsForDay(day).length > 3"
                  class="event-more text-caption text-medium-emphasis"
                >
                  +{{ getEventsForDay(day).length - 3 }} {{ $t('calendar.events').toLowerCase() }}
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Details for selected day -->
      <v-card v-if="selectedDay">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>{{ selectedDay }}. {{ currentMonthName }} {{ viewYear }}</span>
          <div class="d-flex ga-2">
            <v-btn
              size="small"
              variant="tonal"
              color="blue"
              prepend-icon="mdi-book-plus"
              @click="createSessionOnDay(selectedDay)"
            >
              {{ $t('calendar.newSession') }}
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-plus"
              @click="openNewEventDialog(selectedDay)"
            >
              {{ $t('calendar.newEvent') }}
            </v-btn>
          </div>
        </v-card-title>
        <v-card-text>
          <!-- Sessions for selected day -->
          <div v-if="selectedDaySessions.length > 0" class="mb-4">
            <div class="text-overline text-medium-emphasis mb-2">
              <v-icon size="16" class="mr-1">mdi-book-open-page-variant</v-icon>
              {{ $t('calendar.sessions') }} ({{ selectedDaySessions.length }})
            </div>
            <v-list density="compact">
              <v-list-item
                v-for="session in selectedDaySessions"
                :key="'selected-session-' + session.id"
                :class="{ 'session-continuation-item': session.isContinuation }"
                @click="goToSession(session)"
              >
                <template #prepend>
                  <v-avatar color="blue" size="40">
                    <span class="text-white font-weight-bold">#{{ session.session_number }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title>
                  {{ session.title }}
                  <v-chip v-if="session.isContinuation && !session.isStart" size="x-small" class="ml-2" color="info">
                    {{ $t('calendar.continues') }}
                  </v-chip>
                  <v-chip v-if="session.isEnd && !session.isStart" size="x-small" class="ml-1" color="success">
                    {{ $t('calendar.ends') }}
                  </v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>
                  <span v-if="session.summary">{{ session.summary.slice(0, 80) }}{{ session.summary.length > 80 ? '...' : '' }}</span>
                  <span v-else class="text-disabled font-italic">{{ $t('common.noDescription') }}</span>
                </v-list-item-subtitle>
                <template #append>
                  <div class="d-flex align-center ga-2">
                    <v-chip v-if="session.attendance_count > 0" size="x-small" variant="tonal">
                      <v-icon start size="12">mdi-account-group</v-icon>
                      {{ session.attendance_count }}
                    </v-chip>
                    <v-chip v-if="session.duration_minutes" size="x-small" variant="tonal">
                      <v-icon start size="12">mdi-clock</v-icon>
                      {{ Math.floor(session.duration_minutes / 60) }}h
                    </v-chip>
                    <v-btn icon="mdi-chevron-right" variant="text" size="small" />
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </div>

          <!-- Events for selected day -->
          <div v-if="selectedDayEvents.length > 0">
            <div class="text-overline text-medium-emphasis mb-2">
              <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
              {{ $t('calendar.events') }} ({{ selectedDayEvents.length }})
            </div>
            <v-list density="compact">
              <v-list-item
                v-for="event in selectedDayEvents"
                :key="event.id"
                @click="editEvent(event)"
              >
                <template #prepend>
                  <v-avatar :color="event.color || getEventTypeColor(event.event_type)" size="40">
                    <v-icon color="white">{{ getEventTypeIcon(event.event_type) }}</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title>{{ event.title }}</v-list-item-title>
                <v-list-item-subtitle>
                  <span>{{ $t('calendar.eventTypes.' + event.event_type) }}</span>
                  <span v-if="event.entity_name"> · {{ event.entity_name }}</span>
                  <v-chip v-if="event.is_recurring" size="x-small" class="ml-2">
                    {{ $t('calendar.isRecurring') }}
                  </v-chip>
                </v-list-item-subtitle>
                <template #append>
                  <v-btn icon="mdi-delete" variant="text" color="error" @click.stop="deleteEvent(event)" />
                </template>
              </v-list-item>
            </v-list>
          </div>

          <!-- Empty state -->
          <div v-if="selectedDayEvents.length === 0 && selectedDaySessions.length === 0" class="text-center text-medium-emphasis py-4">
            {{ $t('calendar.noEvents') }}
          </div>
        </v-card-text>
      </v-card>
    </template>

    <!-- Settings Dialog -->
    <CalendarSettingsDialog
      v-model="showSettingsDialog"
      :form="settingsForm"
      :saving="saving"
      @save="saveSettings"
    />

    <!-- Event Dialog -->
    <CalendarEventDialog
      v-model="showEventDialog"
      :form="eventForm"
      :is-editing="!!editingEvent"
      :saving="savingEvent"
      :month-options="calendarConfig.months.map((m, i) => ({ title: m.name, value: i + 1 }))"
      :entity-options="entityOptions"
      @save="saveEvent"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <v-icon color="error">mdi-alert-circle</v-icon>
          {{ $t('calendar.deleteEvent') }}
        </v-card-title>
        <v-card-text>
          <p>{{ $t('calendar.deleteEventConfirm') }}</p>
          <v-card v-if="eventToDelete" variant="tonal" class="mt-3 pa-3">
            <div class="d-flex align-center ga-3">
              <v-avatar :color="eventToDelete.color || getEventTypeColor(eventToDelete.event_type)" size="40">
                <v-icon color="white">{{ getEventTypeIcon(eventToDelete.event_type) }}</v-icon>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ eventToDelete.title }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ eventToDelete.day }}. {{ calendarConfig.months[eventToDelete.month - 1]?.name }}
                  <span v-if="!eventToDelete.is_recurring"> {{ eventToDelete.year }}</span>
                  <v-chip v-if="eventToDelete.is_recurring" size="x-small" class="ml-1">
                    {{ $t('calendar.isRecurring') }}
                  </v-chip>
                </div>
              </div>
            </div>
          </v-card>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDeleteEvent">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
interface CalendarMonth {
  id?: number
  name: string
  days: number
  sort_order: number
}

interface CalendarWeekday {
  id?: number
  name: string
  sort_order: number
}

interface CalendarMoon {
  id?: number
  name: string
  cycle_days: number
  full_moon_duration: number
  new_moon_duration: number
  phase_offset: number
}

interface CalendarEvent {
  id: number
  campaign_id: number
  title: string
  description: string | null
  event_type: string
  year: number | null
  month: number
  day: number
  is_recurring: number
  entity_id: number | null
  color: string | null
  entity_name?: string
  entity_type?: string
}

interface CalendarSession {
  id: number
  session_number: number | null
  title: string
  summary: string | null
  in_game_day_start: number | null
  in_game_day_end: number | null
  date: string | null
  duration_minutes: number | null
  attendance_count: number
  mentions_count: number
}

interface CalendarConfig {
  config: {
    current_year: number
    current_month: number
    current_day: number
    era_name: string
    leap_year_interval: number
    leap_year_month: number
    leap_year_extra_days: number
  }
  months: CalendarMonth[]
  weekdays: CalendarWeekday[]
  moons: CalendarMoon[]
}

const { t } = useI18n()
const campaignStore = useCampaignStore()

// State
const calendarConfig = ref<CalendarConfig>({
  config: {
    current_year: 1,
    current_month: 1,
    current_day: 1,
    era_name: '',
    leap_year_interval: 0,
    leap_year_month: 1,
    leap_year_extra_days: 1,
  },
  months: [],
  weekdays: [],
  moons: [],
})
const events = ref<CalendarEvent[]>([])
const sessions = ref<CalendarSession[]>([])
const showSessions = ref(true) // Toggle for session visibility
const viewYear = ref(1)
const viewMonth = ref(1)
const selectedDay = ref<number | null>(null)
const showSettingsDialog = ref(false)
const showEventDialog = ref(false)
const showDeleteDialog = ref(false)
const saving = ref(false)
const savingEvent = ref(false)
const deleting = ref(false)
const advancingDay = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)
const eventToDelete = ref<CalendarEvent | null>(null)
const router = useRouter()

// Settings form
const settingsForm = ref({
  currentYear: 1,
  currentMonth: 1,
  currentDay: 1,
  eraName: '',
  leapYearInterval: 0,
  leapYearMonth: 1,
  leapYearExtraDays: 1,
  months: [] as CalendarMonth[],
  weekdays: [] as CalendarWeekday[],
  moons: [] as CalendarMoon[],
})

// Event form
const eventForm = ref({
  title: '',
  description: '',
  eventType: 'custom',
  day: 1,
  month: 1,
  year: 1,
  isRecurring: false,
  entityId: null as number | null,
})

// Entity options for linking
const entityOptions = ref<Array<{ id: number; name: string; type: string }>>([])

// Computed
const isConfigured = computed(() => calendarConfig.value.months.length > 0)

const currentMonthName = computed(() => {
  const month = calendarConfig.value.months[viewMonth.value - 1]
  return month?.name || ''
})

const currentMonthDays = computed(() => {
  return getDaysInMonth(viewMonth.value, viewYear.value)
})

const currentDateFormatted = computed(() => {
  const config = calendarConfig.value.config
  const month = calendarConfig.value.months[config.current_month - 1]
  return `${config.current_day}. ${month?.name || ''} ${config.current_year}`
})

const selectedDayEvents = computed(() => {
  if (!selectedDay.value) return []
  return getEventsForDay(selectedDay.value)
})

const selectedDaySessions = computed(() => {
  if (!selectedDay.value) return []
  return getSessionsForDay(selectedDay.value)
})

// Get moon phases for current date (shown in header)
const currentMoonPhases = computed(() => {
  if (calendarConfig.value.moons.length === 0) return []
  const config = calendarConfig.value.config
  const totalDays = getTotalDays(config.current_year, config.current_month, config.current_day)

  const phases: Array<{ name: string; phase: string; phaseIndex: number }> = []
  for (const moon of calendarConfig.value.moons) {
    const dayInCycle = (totalDays + (moon.phase_offset || 0)) % moon.cycle_days
    const { phaseName, phaseIndex } = calculateMoonPhase(dayInCycle, moon)
    phases.push({ name: moon.name, phase: phaseName, phaseIndex })
  }
  return phases
})

// Dynamic grid style based on weekdays count
const calendarGridStyle = computed(() => {
  const weekdaysCount = calendarConfig.value.weekdays.length || 7
  return {
    gridTemplateColumns: `repeat(${weekdaysCount}, 1fr)`,
  }
})

// Functions
function getTotalDays(year: number, month: number, day: number): number {
  let total = 0
  const daysPerYear = calendarConfig.value.months.reduce((sum, m) => sum + m.days, 0)
  total += (year - 1) * daysPerYear
  for (let i = 0; i < month - 1; i++) {
    total += calendarConfig.value.months[i]?.days || 0
  }
  total += day
  return total
}

function getFirstDayOffset(): number {
  if (calendarConfig.value.weekdays.length === 0) return 0
  const totalDays = getTotalDays(viewYear.value, viewMonth.value, 1) - 1
  return totalDays % calendarConfig.value.weekdays.length
}

function isToday(day: number): boolean {
  const config = calendarConfig.value.config
  return (
    viewYear.value === config.current_year &&
    viewMonth.value === config.current_month &&
    day === config.current_day
  )
}

function getEventsForDay(day: number): CalendarEvent[] {
  return events.value.filter((e) => {
    if (e.month !== viewMonth.value || e.day !== day) return false
    if (e.is_recurring) return true
    return e.year === viewYear.value
  })
}

// Get sessions that are active on a specific day (supports multi-day sessions)
function getSessionsForDay(day: number): Array<CalendarSession & { isStart: boolean; isEnd: boolean; isContinuation: boolean }> {
  if (!showSessions.value) return []

  const absoluteDay = getTotalDays(viewYear.value, viewMonth.value, day)

  return sessions.value
    .filter((s) => {
      if (s.in_game_day_start === null) return false
      const endDay = s.in_game_day_end ?? s.in_game_day_start
      return absoluteDay >= s.in_game_day_start && absoluteDay <= endDay
    })
    .map((s) => ({
      ...s,
      isStart: s.in_game_day_start === absoluteDay,
      isEnd: (s.in_game_day_end ?? s.in_game_day_start) === absoluteDay,
      isContinuation: s.in_game_day_start !== null && s.in_game_day_start < absoluteDay,
    }))
    .sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0))
}

// Check if day has any sessions
function dayHasSessions(day: number): boolean {
  return getSessionsForDay(day).length > 0
}

// Navigate to session page
function goToSession(session: CalendarSession) {
  router.push(`/sessions?highlight=${session.id}`)
}

// Create new session on selected day
function createSessionOnDay(day: number) {
  const absoluteDay = getTotalDays(viewYear.value, viewMonth.value, day)
  router.push(`/sessions?newSession=true&inGameDay=${absoluteDay}`)
}

function getEventTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    custom: 'mdi-calendar',
    birthday: 'mdi-cake',
    death: 'mdi-skull',
    holiday: 'mdi-party-popper',
    session: 'mdi-book-open-page-variant',
    festival: 'mdi-firework',
    war: 'mdi-sword-cross',
    founding: 'mdi-castle',
  }
  return icons[type] || 'mdi-calendar'
}

function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    custom: 'grey',
    birthday: 'pink',
    death: 'red-darken-4',
    holiday: 'green',
    session: 'blue',
    festival: 'orange',
    war: 'red',
    founding: 'purple',
  }
  return colors[type] || 'grey'
}

// Check if year is leap year
function isLeapYear(year: number): boolean {
  const interval = calendarConfig.value.config.leap_year_interval
  if (!interval || interval <= 0) return false
  return year % interval === 0
}

// Calculate moon phase based on day in cycle and moon configuration
function calculateMoonPhase(dayInCycle: number, moon: CalendarMoon): { phaseName: string; phaseIndex: number } {
  const cycle = moon.cycle_days
  const newMoonDays = moon.new_moon_duration || 1
  const fullMoonDays = moon.full_moon_duration || 1

  // Remaining days for the 6 transitional phases
  const remainingDays = cycle - newMoonDays - fullMoonDays
  const transitionPhaseDays = remainingDays / 6

  // Calculate boundaries for each phase
  // Phase order: New Moon -> Waxing Crescent -> First Quarter -> Waxing Gibbous -> Full Moon -> Waning Gibbous -> Last Quarter -> Waning Crescent -> (back to New Moon)
  const boundaries = [
    newMoonDays, // End of New Moon
    newMoonDays + transitionPhaseDays, // End of Waxing Crescent
    newMoonDays + transitionPhaseDays * 2, // End of First Quarter
    newMoonDays + transitionPhaseDays * 3, // End of Waxing Gibbous
    newMoonDays + transitionPhaseDays * 3 + fullMoonDays, // End of Full Moon
    newMoonDays + transitionPhaseDays * 4 + fullMoonDays, // End of Waning Gibbous
    newMoonDays + transitionPhaseDays * 5 + fullMoonDays, // End of Last Quarter
    cycle, // End of Waning Crescent (back to New Moon)
  ]

  const phaseNames = [
    t('calendar.moonPhases.new'),
    t('calendar.moonPhases.waxingCrescent'),
    t('calendar.moonPhases.firstQuarter'),
    t('calendar.moonPhases.waxingGibbous'),
    t('calendar.moonPhases.full'),
    t('calendar.moonPhases.waningGibbous'),
    t('calendar.moonPhases.lastQuarter'),
    t('calendar.moonPhases.waningCrescent'),
  ]

  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i]
    if (boundary !== undefined && dayInCycle < boundary) {
      return { phaseName: phaseNames[i] ?? phaseNames[0] ?? '', phaseIndex: i }
    }
  }

  return { phaseName: phaseNames[0] ?? '', phaseIndex: 0 }
}

// Get moon phases for a specific day
function getMoonPhasesForDay(day: number): Array<{ name: string; phase: string; phasePercent: number; phaseIndex: number }> {
  const phases: Array<{ name: string; phase: string; phasePercent: number; phaseIndex: number }> = []
  const totalDays = getTotalDays(viewYear.value, viewMonth.value, day)

  for (const moon of calendarConfig.value.moons) {
    const dayInCycle = (totalDays + (moon.phase_offset || 0)) % moon.cycle_days
    const phasePercent = dayInCycle / moon.cycle_days
    const { phaseName, phaseIndex } = calculateMoonPhase(dayInCycle, moon)

    phases.push({ name: moon.name, phase: phaseName, phasePercent, phaseIndex })
  }

  return phases
}

// Get moon icon based on phase index (0-7)
function getMoonIconForPhase(phaseIndex: number): string {
  const icons = [
    'mdi-moon-new', // 0: New Moon
    'mdi-moon-waxing-crescent', // 1: Waxing Crescent
    'mdi-moon-first-quarter', // 2: First Quarter
    'mdi-moon-waxing-gibbous', // 3: Waxing Gibbous
    'mdi-moon-full', // 4: Full Moon
    'mdi-moon-waning-gibbous', // 5: Waning Gibbous
    'mdi-moon-last-quarter', // 6: Last Quarter
    'mdi-moon-waning-crescent', // 7: Waning Crescent
  ]
  return icons[phaseIndex] ?? 'mdi-moon-new'
}

// Moon colors palette for distinguishing multiple moons
const moonColors = [
  '#C0C0C0', // Silver (default moon)
  '#FFD700', // Gold
  '#E6A8D7', // Pink/Rose
  '#87CEEB', // Sky blue
  '#98FB98', // Pale green
  '#DDA0DD', // Plum
  '#F0E68C', // Khaki
  '#E0FFFF', // Light cyan
]

// Get color for a moon based on its index
function getMoonColor(moonName: string): string {
  const index = calendarConfig.value.moons.findIndex((m) => m.name === moonName)
  if (index < 0) return moonColors[0] ?? '#C0C0C0'
  return moonColors[index % moonColors.length] ?? '#C0C0C0'
}

// Get days in month (considering leap year)
function getDaysInMonth(month: number, year: number): number {
  const monthData = calendarConfig.value.months[month - 1]
  if (!monthData) return 30
  let days = monthData.days
  // Add leap day if this is the leap month and it's a leap year
  if (isLeapYear(year) && month === calendarConfig.value.config.leap_year_month) {
    days += calendarConfig.value.config.leap_year_extra_days
  }
  return days
}

function selectDay(day: number) {
  selectedDay.value = day
}

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = calendarConfig.value.months.length
    viewYear.value--
  } else {
    viewMonth.value--
  }
  selectedDay.value = null
  loadEvents()
}

function nextMonth() {
  if (viewMonth.value === calendarConfig.value.months.length) {
    viewMonth.value = 1
    viewYear.value++
  } else {
    viewMonth.value++
  }
  selectedDay.value = null
  loadEvents()
}

function prevYear() {
  viewYear.value--
  loadEvents()
}

function nextYear() {
  viewYear.value++
  loadEvents()
}

// Advance the current date by one day
async function advanceDay() {
  advancingDay.value = true
  try {
    const config = calendarConfig.value.config
    let newDay = config.current_day + 1
    let newMonth = config.current_month
    let newYear = config.current_year

    // Check if we need to advance to next month
    const daysInCurrentMonth = getDaysInMonth(newMonth, newYear)
    if (newDay > daysInCurrentMonth) {
      newDay = 1
      newMonth++

      // Check if we need to advance to next year
      if (newMonth > calendarConfig.value.months.length) {
        newMonth = 1
        newYear++
      }
    }

    // Save the new date via API
    await $fetch('/api/calendar/config', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        currentYear: newYear,
        currentMonth: newMonth,
        currentDay: newDay,
        yearZeroName: 'Jahr 0',
        eraName: config.era_name,
        leapYearInterval: config.leap_year_interval,
        leapYearMonth: config.leap_year_month,
        leapYearExtraDays: config.leap_year_extra_days,
        months: calendarConfig.value.months,
        weekdays: calendarConfig.value.weekdays,
        moons: calendarConfig.value.moons,
      },
    })

    // Reload config to update UI
    await loadConfig()

    // Navigate to new month/year if needed
    viewMonth.value = newMonth
    viewYear.value = newYear
    await loadEvents()
  } catch (error) {
    console.error('Failed to advance day:', error)
  } finally {
    advancingDay.value = false
  }
}

// Open settings dialog with a deep copy of current config
function openSettingsDialog() {
  // Create deep copy to avoid direct mutation
  settingsForm.value = {
    currentYear: calendarConfig.value.config.current_year,
    currentMonth: calendarConfig.value.config.current_month,
    currentDay: calendarConfig.value.config.current_day,
    eraName: calendarConfig.value.config.era_name || '',
    leapYearInterval: calendarConfig.value.config.leap_year_interval || 0,
    leapYearMonth: calendarConfig.value.config.leap_year_month || 1,
    leapYearExtraDays: calendarConfig.value.config.leap_year_extra_days || 1,
    months: calendarConfig.value.months.map((m) => ({ ...m })),
    weekdays: calendarConfig.value.weekdays.map((w) => ({ ...w })),
    moons: calendarConfig.value.moons.map((moon) => ({ ...moon })),
  }
  showSettingsDialog.value = true
}

async function saveSettings() {
  saving.value = true
  try {
    await $fetch('/api/calendar/config', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        currentYear: settingsForm.value.currentYear,
        currentMonth: settingsForm.value.currentMonth,
        currentDay: settingsForm.value.currentDay,
        yearZeroName: 'Jahr 0',
        eraName: settingsForm.value.eraName,
        leapYearInterval: settingsForm.value.leapYearInterval,
        leapYearMonth: settingsForm.value.leapYearMonth,
        leapYearExtraDays: settingsForm.value.leapYearExtraDays,
        months: settingsForm.value.months,
        weekdays: settingsForm.value.weekdays,
        moons: settingsForm.value.moons,
      },
    })
    await loadConfig()
    showSettingsDialog.value = false
  } catch (error) {
    console.error('Failed to save calendar config:', error)
  } finally {
    saving.value = false
  }
}

// Event functions
function openNewEventDialog(day?: number) {
  editingEvent.value = null
  eventForm.value = {
    title: '',
    description: '',
    eventType: 'custom',
    day: day || selectedDay.value || 1,
    month: viewMonth.value,
    year: viewYear.value,
    isRecurring: false,
    entityId: null,
  }
  showEventDialog.value = true
}

function editEvent(event: CalendarEvent) {
  editingEvent.value = event
  eventForm.value = {
    title: event.title,
    description: event.description || '',
    eventType: event.event_type,
    day: event.day,
    month: event.month,
    year: event.year || viewYear.value,
    isRecurring: !!event.is_recurring,
    entityId: event.entity_id,
  }
  showEventDialog.value = true
}

async function saveEvent() {
  savingEvent.value = true
  try {
    if (editingEvent.value) {
      await $fetch(`/api/calendar/events/${editingEvent.value.id}`, {
        method: 'PATCH',
        body: {
          title: eventForm.value.title,
          description: eventForm.value.description,
          eventType: eventForm.value.eventType,
          day: eventForm.value.day,
          month: eventForm.value.month,
          year: eventForm.value.isRecurring ? null : eventForm.value.year,
          isRecurring: eventForm.value.isRecurring,
          entityId: eventForm.value.entityId,
        },
      })
    } else {
      await $fetch('/api/calendar/events', {
        method: 'POST',
        body: {
          campaignId: campaignStore.activeCampaignId,
          title: eventForm.value.title,
          description: eventForm.value.description,
          eventType: eventForm.value.eventType,
          day: eventForm.value.day,
          month: eventForm.value.month,
          year: eventForm.value.isRecurring ? null : eventForm.value.year,
          isRecurring: eventForm.value.isRecurring,
          entityId: eventForm.value.entityId,
        },
      })
    }
    await loadEvents()
    showEventDialog.value = false
  } catch (error) {
    console.error('Failed to save event:', error)
  } finally {
    savingEvent.value = false
  }
}

function deleteEvent(event: CalendarEvent) {
  eventToDelete.value = event
  showDeleteDialog.value = true
}

async function confirmDeleteEvent() {
  if (!eventToDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/calendar/events/${eventToDelete.value.id}`, { method: 'DELETE' })
    await loadEvents()
    showDeleteDialog.value = false
    eventToDelete.value = null
  } catch (error) {
    console.error('Failed to delete event:', error)
  } finally {
    deleting.value = false
  }
}

// Load functions
async function loadConfig() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarConfig>('/api/calendar/config', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
    calendarConfig.value = data
    viewYear.value = data.config.current_year
    viewMonth.value = data.config.current_month
    // Note: settingsForm is populated in openSettingsDialog() with deep copies
    // to avoid direct mutation when user edits but cancels
  } catch (error) {
    console.error('Failed to load calendar config:', error)
  }
}

async function loadEvents() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarEvent[]>('/api/calendar/events', {
      query: {
        campaignId: campaignStore.activeCampaignId,
        year: viewYear.value,
        month: viewMonth.value,
      },
    })
    events.value = data
  } catch (error) {
    console.error('Failed to load events:', error)
  }
}

async function loadEntities() {
  if (!campaignStore.activeCampaignId) return
  try {
    // Load all entities for linking
    const [npcs, locations, factions, lore] = await Promise.all([
      $fetch<Array<{ id: number; name: string }>>('/api/npcs', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/locations', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/factions', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
      $fetch<Array<{ id: number; name: string }>>('/api/lore', {
        query: { campaignId: campaignStore.activeCampaignId },
      }),
    ])
    entityOptions.value = [
      ...npcs.map((n) => ({ ...n, type: 'NPC' })),
      ...locations.map((l) => ({ ...l, type: 'Location' })),
      ...factions.map((f) => ({ ...f, type: 'Faction' })),
      ...lore.map((l) => ({ ...l, type: 'Lore' })),
    ]
  } catch (error) {
    console.error('Failed to load entities:', error)
  }
}

async function loadSessions() {
  if (!campaignStore.activeCampaignId) return
  try {
    const data = await $fetch<CalendarSession[]>('/api/calendar/sessions', {
      query: { campaignId: campaignStore.activeCampaignId },
    })
    sessions.value = data
  } catch (error) {
    console.error('Failed to load sessions:', error)
  }
}

onMounted(async () => {
  await loadConfig()
  await Promise.all([loadEvents(), loadSessions(), loadEntities()])
})
</script>

<style scoped>
.calendar-grid {
  display: grid;
  /* grid-template-columns is set dynamically via :style binding */
  gap: 2px;
}

.calendar-header {
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 4px;
}

.calendar-day {
  min-height: 80px;
  padding: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.calendar-day:hover {
  background: rgba(var(--v-theme-primary), 0.05);
}

.calendar-day.empty {
  background: transparent;
  border: none;
  cursor: default;
}

.calendar-day.is-today {
  background: rgba(var(--v-theme-primary), 0.15);
  border-color: rgb(var(--v-theme-primary));
}

.calendar-day.is-selected {
  background: rgba(var(--v-theme-secondary), 0.2);
  border-color: rgb(var(--v-theme-secondary));
  border-width: 2px;
}

.calendar-day.is-today.is-selected {
  background: rgba(var(--v-theme-primary), 0.25);
  border-color: rgb(var(--v-theme-primary));
  border-width: 2px;
}

.calendar-day.has-events {
  background: rgba(var(--v-theme-secondary), 0.05);
}

.calendar-day.has-sessions {
  background: rgba(33, 150, 243, 0.08);
}

.calendar-day.has-sessions.is-today {
  background: rgba(33, 150, 243, 0.15);
}

.day-number {
  font-weight: 500;
  margin-bottom: 4px;
}

/* Sessions in calendar */
.day-sessions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgba(33, 150, 243, 0.2);
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s;
  overflow: hidden;
  border-left: 3px solid rgb(33, 150, 243);
}

.session-item:hover {
  background: rgba(33, 150, 243, 0.35);
}

.session-item.session-start {
  border-left: 3px solid rgb(33, 150, 243);
  border-radius: 4px 4px 4px 4px;
}

.session-item.session-continuation {
  border-left: 3px dashed rgba(33, 150, 243, 0.6);
  background: rgba(33, 150, 243, 0.1);
  opacity: 0.85;
}

.session-item.session-end {
  border-left: 3px solid rgb(76, 175, 80);
}

.session-item.session-single {
  border-left: 3px solid rgb(33, 150, 243);
}

.session-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.session-more {
  padding: 2px 4px;
  text-align: center;
}

.session-continuation-item {
  opacity: 0.8;
  border-left: 3px dashed rgba(33, 150, 243, 0.5);
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.event-item {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  border-left: 3px solid;
  border-radius: 0 4px 4px 0;
  background: rgba(var(--v-theme-on-surface), 0.05);
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s;
  overflow: hidden;
}

.event-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.1);
}

.event-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.event-more {
  padding: 2px 4px;
  text-align: center;
}
</style>
