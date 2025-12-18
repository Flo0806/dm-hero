<template>
  <div class="in-game-date-picker">
    <!-- Loading State -->
    <div v-if="loading" class="d-flex align-center justify-center pa-4">
      <v-progress-circular indeterminate size="24" />
    </div>

    <!-- No Calendar Configured -->
    <div v-else-if="!calendarData || calendarData.months.length === 0" class="text-center pa-4">
      <v-icon size="48" color="warning" class="mb-2">mdi-calendar-alert</v-icon>
      <p class="text-body-2 text-medium-emphasis">
        {{ $t('calendar.noCalendarConfigured') }}
      </p>
    </div>

    <!-- Date Picker -->
    <div v-else>
      <v-row dense>
        <!-- Day Selector -->
        <v-col cols="12" sm="3">
          <v-label class="text-caption mb-1">{{ $t('calendar.day') }}</v-label>
          <v-select
            v-model="internalDay"
            :items="dayItems"
            density="compact"
            hide-details
            variant="outlined"
          />
        </v-col>

        <!-- Month Selector -->
        <v-col cols="12" sm="5">
          <v-label class="text-caption mb-1">{{ $t('calendar.month') }}</v-label>
          <v-select
            v-model="internalMonth"
            :items="monthItems"
            item-title="title"
            item-value="value"
            density="compact"
            hide-details
            variant="outlined"
          />
        </v-col>

        <!-- Year Selector -->
        <v-col cols="12" sm="4">
          <v-label class="text-caption mb-1">{{ $t('calendar.year') }}</v-label>
          <div class="d-flex align-center">
            <v-btn
              icon="mdi-minus"
              size="small"
              variant="outlined"
              density="compact"
              :disabled="internalYear <= 1"
              @click="internalYear--"
            />
            <v-text-field
              v-model.number="internalYear"
              type="number"
              density="compact"
              hide-details
              variant="outlined"
              class="mx-2 year-input"
              :min="1"
            />
            <v-btn
              icon="mdi-plus"
              size="small"
              variant="outlined"
              density="compact"
              @click="internalYear++"
            />
          </div>
        </v-col>
      </v-row>

      <!-- Current Selection Display -->
      <div v-if="formattedDate" class="mt-3 text-center">
        <v-chip color="primary" variant="tonal" size="large">
          <v-icon start>mdi-calendar</v-icon>
          {{ formattedDate }}
        </v-chip>
      </div>

      <!-- Quick Actions -->
      <div class="d-flex justify-center gap-2 mt-3">
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-calendar-today"
          @click="setToCurrentDate"
        >
          {{ $t('calendar.setToCurrent') }}
        </v-btn>
        <v-btn
          v-if="modelValue"
          size="small"
          variant="text"
          color="error"
          prepend-icon="mdi-close"
          @click="clearDate"
        >
          {{ $t('common.clear') }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useInGameCalendar,
  type CalendarData,
  type InGameDate,
} from '~/composables/useInGameCalendar'

// Date value object with year/month/day components
export interface InGameDateValue {
  year: number
  month: number
  day: number
}

interface Props {
  modelValue: InGameDateValue | null // Year/month/day object
  calendarData?: CalendarData | null // Optional: pass calendar data directly
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: InGameDateValue | null]
}>()

const {
  calendarData: loadedCalendarData,
  loading,
  loadCalendar,
  formatDate,
  getCurrentDate,
  getDaysInMonth,
} = useInGameCalendar()

// Use passed calendar data or load it
const calendarData = computed(() => props.calendarData || loadedCalendarData.value)

// Internal date components
const internalYear = ref(1)
const internalMonth = ref(1)
const internalDay = ref(1)

// Track if we're updating internally to prevent loops
let isUpdatingFromProp = false

// Month items for dropdown
const monthItems = computed(() => {
  if (!calendarData.value) return []
  return calendarData.value.months.map((m, i) => ({
    title: m.name,
    value: i + 1,
  }))
})

// Day items for dropdown (based on selected month)
const dayItems = computed(() => {
  if (!calendarData.value) return []
  const daysInMonth = getDaysInMonth(
    internalYear.value,
    internalMonth.value - 1,
    calendarData.value.months,
    calendarData.value.config,
  )
  return Array.from({ length: daysInMonth }, (_, i) => i + 1)
})

// Max days in current month
const maxDaysInMonth = computed(() => {
  if (!calendarData.value) return 30
  return getDaysInMonth(
    internalYear.value,
    internalMonth.value - 1,
    calendarData.value.months,
    calendarData.value.config,
  )
})

// Formatted date display
const formattedDate = computed(() => {
  if (!calendarData.value || !internalYear.value || !internalMonth.value || !internalDay.value) {
    return null
  }
  const monthData = calendarData.value.months[internalMonth.value - 1]
  const date: InGameDate = {
    year: internalYear.value,
    month: internalMonth.value,
    day: internalDay.value,
    monthName: monthData?.name || '',
  }
  return formatDate(date, calendarData.value)
})

// Watch for prop changes and update internal values
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      isUpdatingFromProp = true
      internalYear.value = newValue.year
      internalMonth.value = newValue.month
      internalDay.value = newValue.day
      nextTick(() => {
        isUpdatingFromProp = false
      })
    }
  },
  { immediate: true, deep: true },
)

// Watch internal values and emit updates
watch(
  [internalYear, internalMonth, internalDay],
  () => {
    if (isUpdatingFromProp) return
    if (!calendarData.value) return

    // Clamp day if it exceeds max days in month
    if (internalDay.value > maxDaysInMonth.value) {
      internalDay.value = maxDaysInMonth.value
    }

    emit('update:modelValue', {
      year: internalYear.value,
      month: internalMonth.value,
      day: internalDay.value,
    })
  },
  { deep: true },
)

// Watch month or year changes to clamp day (year matters for leap years)
watch([internalMonth, internalYear], () => {
  if (internalDay.value > maxDaysInMonth.value) {
    internalDay.value = maxDaysInMonth.value
  }
})

// Set to current campaign date
function setToCurrentDate() {
  const currentDate = getCurrentDate(calendarData.value || undefined)
  if (currentDate) {
    internalYear.value = currentDate.year
    internalMonth.value = currentDate.month
    internalDay.value = currentDate.day
  }
}

// Clear the date
function clearDate() {
  emit('update:modelValue', null)
}

// Load calendar on mount if not provided
onMounted(async () => {
  if (!props.calendarData) {
    await loadCalendar()
  }

  // Initialize from prop or use current date
  if (props.modelValue) {
    internalYear.value = props.modelValue.year
    internalMonth.value = props.modelValue.month
    internalDay.value = props.modelValue.day
  } else if (calendarData.value) {
    // Default to current campaign date
    setToCurrentDate()
  }
})
</script>

<style scoped>
.in-game-date-picker {
  min-width: 300px;
}

.year-input {
  max-width: 100px;
}

.year-input :deep(input) {
  text-align: center;
}
</style>
