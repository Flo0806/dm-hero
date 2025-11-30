<template>
  <v-dialog v-model="modelValue" max-width="900" scrollable>
    <v-card>
      <v-card-title>{{ $t('calendar.settings') }}</v-card-title>
      <v-card-text style="max-height: 70vh">
        <v-tabs v-model="activeTab">
          <v-tab value="months">{{ $t('calendar.months') }}</v-tab>
          <v-tab value="weekdays">{{ $t('calendar.weekdays') }}</v-tab>
          <v-tab value="moons">{{ $t('calendar.moons') }}</v-tab>
          <v-tab value="current">{{ $t('calendar.currentDate') }}</v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="mt-4">
          <!-- Months Tab -->
          <v-window-item value="months">
            <v-btn color="secondary" class="mb-4" @click="useDefaultCalendar">
              {{ $t('calendar.useDefaults') }}
            </v-btn>
            <v-table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ $t('calendar.monthName') }}</th>
                  <th>{{ $t('calendar.daysInMonth') }}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(month, index) in form.months" :key="index">
                  <td>{{ index + 1 }}</td>
                  <td>
                    <v-text-field
                      v-model="month.name"
                      density="compact"
                      hide-details
                      variant="outlined"
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="month.days"
                      type="number"
                      density="compact"
                      hide-details
                      variant="outlined"
                      style="max-width: 100px"
                    />
                  </td>
                  <td>
                    <v-btn icon="mdi-delete" variant="text" size="small" @click="removeMonth(index)" />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-btn class="mt-2" variant="tonal" @click="addMonth">
              <v-icon start>mdi-plus</v-icon>
              {{ $t('calendar.addMonth') }}
            </v-btn>
          </v-window-item>

          <!-- Weekdays Tab -->
          <v-window-item value="weekdays">
            <v-table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ $t('calendar.weekdayName') }}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(weekday, index) in form.weekdays" :key="index">
                  <td>{{ index + 1 }}</td>
                  <td>
                    <v-text-field
                      v-model="weekday.name"
                      density="compact"
                      hide-details
                      variant="outlined"
                    />
                  </td>
                  <td>
                    <v-btn icon="mdi-delete" variant="text" size="small" @click="removeWeekday(index)" />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-btn class="mt-2" variant="tonal" @click="addWeekday">
              <v-icon start>mdi-plus</v-icon>
              {{ $t('calendar.addWeekday') }}
            </v-btn>
          </v-window-item>

          <!-- Moons Tab -->
          <v-window-item value="moons">
            <v-table>
              <thead>
                <tr>
                  <th>{{ $t('calendar.moonName') }}</th>
                  <th>{{ $t('calendar.cycleDays') }}</th>
                  <th>{{ $t('calendar.phaseOffset') }}</th>
                  <th>{{ $t('calendar.fullMoonDuration') }}</th>
                  <th>{{ $t('calendar.newMoonDuration') }}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(moon, index) in form.moons" :key="index">
                  <td>
                    <v-text-field
                      v-model="moon.name"
                      density="compact"
                      hide-details
                      variant="outlined"
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="moon.cycle_days"
                      type="number"
                      density="compact"
                      hide-details
                      variant="outlined"
                      style="max-width: 100px"
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="moon.phase_offset"
                      type="number"
                      density="compact"
                      hide-details
                      variant="outlined"
                      style="max-width: 80px"
                      :hint="$t('calendar.phaseOffsetHint')"
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="moon.full_moon_duration"
                      type="number"
                      density="compact"
                      hide-details
                      variant="outlined"
                      style="max-width: 80px"
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="moon.new_moon_duration"
                      type="number"
                      density="compact"
                      hide-details
                      variant="outlined"
                      style="max-width: 80px"
                    />
                  </td>
                  <td>
                    <v-btn icon="mdi-delete" variant="text" size="small" @click="removeMoon(index)" />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-btn class="mt-2" variant="tonal" @click="addMoon">
              <v-icon start>mdi-plus</v-icon>
              {{ $t('calendar.addMoon') }}
            </v-btn>
          </v-window-item>

          <!-- Current Date Tab -->
          <v-window-item value="current">
            <h3 class="text-h6 mb-4">{{ $t('calendar.currentDate') }}</h3>
            <v-row>
              <v-col cols="4">
                <v-text-field
                  v-model.number="form.currentYear"
                  :label="$t('calendar.year')"
                  type="number"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="form.currentMonth"
                  :label="$t('calendar.month')"
                  :items="form.months.map((m, i) => ({ title: m.name, value: i + 1 }))"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model.number="form.currentDay"
                  :label="$t('calendar.day')"
                  type="number"
                  variant="outlined"
                  :min="1"
                  :max="maxDaysInCurrentMonth"
                  :hint="`1 - ${maxDaysInCurrentMonth}`"
                  persistent-hint
                />
              </v-col>
            </v-row>

            <v-divider class="my-4" />
            <h3 class="text-h6 mb-4">{{ $t('calendar.eraName') }}</h3>
            <v-text-field
              v-model="form.eraName"
              :label="$t('calendar.eraName')"
              :hint="$t('calendar.eraNameHint')"
              variant="outlined"
              persistent-hint
            />

            <v-divider class="my-4" />
            <h3 class="text-h6 mb-4">{{ $t('calendar.leapYear') }}</h3>
            <v-row>
              <v-col cols="4">
                <v-text-field
                  v-model.number="form.leapYearInterval"
                  :label="$t('calendar.leapYearInterval')"
                  :hint="$t('calendar.leapYearIntervalHint')"
                  type="number"
                  variant="outlined"
                  persistent-hint
                />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="form.leapYearMonth"
                  :label="$t('calendar.leapYearMonth')"
                  :items="form.months.map((m, i) => ({ title: m.name, value: i + 1 }))"
                  variant="outlined"
                  :disabled="!form.leapYearInterval"
                />
              </v-col>
              <v-col cols="4">
                <v-text-field
                  v-model.number="form.leapYearExtraDays"
                  :label="$t('calendar.leapYearExtraDays')"
                  type="number"
                  variant="outlined"
                  :disabled="!form.leapYearInterval"
                />
              </v-col>
            </v-row>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="modelValue = false">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="emit('save')">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
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

interface SettingsForm {
  currentYear: number
  currentMonth: number
  currentDay: number
  eraName: string
  leapYearInterval: number
  leapYearMonth: number
  leapYearExtraDays: number
  months: CalendarMonth[]
  weekdays: CalendarWeekday[]
  moons: CalendarMoon[]
}

defineProps<{
  saving: boolean
}>()

const emit = defineEmits<{
  save: []
}>()

// Two-way binding for dialog visibility
const modelValue = defineModel<boolean>({ required: true })

// Two-way binding for form data - allows mutation
const form = defineModel<SettingsForm>('form', { required: true })

const { t } = useI18n()

const activeTab = ref('months')

// Computed: Max days in currently selected month
const maxDaysInCurrentMonth = computed(() => {
  if (!form.value.months || form.value.months.length === 0) return 30
  const monthIndex = form.value.currentMonth - 1
  const month = form.value.months[monthIndex]
  return month?.days || 30
})

// Watch for month changes and clamp day if needed
watch(
  () => form.value.currentMonth,
  () => {
    if (form.value.currentDay > maxDaysInCurrentMonth.value) {
      form.value.currentDay = maxDaysInCurrentMonth.value
    }
  },
)

// Also watch for month days changes (user editing month config)
watch(
  () => form.value.months.map((m) => m.days),
  () => {
    if (form.value.currentDay > maxDaysInCurrentMonth.value) {
      form.value.currentDay = maxDaysInCurrentMonth.value
    }
  },
  { deep: true },
)

// Settings functions
function useDefaultCalendar() {
  form.value.months = [
    { name: t('calendar.defaultMonths.1'), days: 30, sort_order: 0 },
    { name: t('calendar.defaultMonths.2'), days: 30, sort_order: 1 },
    { name: t('calendar.defaultMonths.3'), days: 30, sort_order: 2 },
    { name: t('calendar.defaultMonths.4'), days: 30, sort_order: 3 },
    { name: t('calendar.defaultMonths.5'), days: 30, sort_order: 4 },
    { name: t('calendar.defaultMonths.6'), days: 30, sort_order: 5 },
    { name: t('calendar.defaultMonths.7'), days: 30, sort_order: 6 },
    { name: t('calendar.defaultMonths.8'), days: 30, sort_order: 7 },
    { name: t('calendar.defaultMonths.9'), days: 30, sort_order: 8 },
    { name: t('calendar.defaultMonths.10'), days: 30, sort_order: 9 },
    { name: t('calendar.defaultMonths.11'), days: 30, sort_order: 10 },
    { name: t('calendar.defaultMonths.12'), days: 30, sort_order: 11 },
  ]
  form.value.weekdays = [
    { name: t('calendar.defaultWeekdays.1'), sort_order: 0 },
    { name: t('calendar.defaultWeekdays.2'), sort_order: 1 },
    { name: t('calendar.defaultWeekdays.3'), sort_order: 2 },
    { name: t('calendar.defaultWeekdays.4'), sort_order: 3 },
    { name: t('calendar.defaultWeekdays.5'), sort_order: 4 },
    { name: t('calendar.defaultWeekdays.6'), sort_order: 5 },
    { name: t('calendar.defaultWeekdays.7'), sort_order: 6 },
  ]
}

function addMonth() {
  form.value.months.push({
    name: '',
    days: 30,
    sort_order: form.value.months.length,
  })
}

function removeMonth(index: number) {
  form.value.months.splice(index, 1)
}

function addWeekday() {
  form.value.weekdays.push({
    name: '',
    sort_order: form.value.weekdays.length,
  })
}

function removeWeekday(index: number) {
  form.value.weekdays.splice(index, 1)
}

function addMoon() {
  form.value.moons.push({
    name: '',
    cycle_days: 30,
    full_moon_duration: 1,
    new_moon_duration: 1,
    phase_offset: 0,
  })
}

function removeMoon(index: number) {
  form.value.moons.splice(index, 1)
}
</script>
