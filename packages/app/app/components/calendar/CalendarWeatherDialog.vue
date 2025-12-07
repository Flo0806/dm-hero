<template>
  <v-dialog v-model="dialogVisible" max-width="450">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon :color="form.weatherType === 'sunny' ? 'amber' : 'blue-grey'">
          {{ getWeatherIcon(form.weatherType) }}
        </v-icon>
        {{ $t('calendar.weather.editWeather') }}
      </v-card-title>
      <v-card-subtitle>
        {{ day }}. {{ monthName }} {{ year }}
      </v-card-subtitle>

      <v-card-text class="pt-4">
        <!-- Weather Type Selection -->
        <v-select
          v-model="form.weatherType"
          :label="$t('calendar.weather.title')"
          :items="weatherTypes"
          item-title="title"
          item-value="value"
          variant="outlined"
          class="mb-3"
        >
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <v-icon :color="item.value === 'sunny' ? 'amber' : 'blue-grey'">
                  {{ getWeatherIcon(item.value) }}
                </v-icon>
              </template>
            </v-list-item>
          </template>
          <template #selection="{ item }">
            <v-icon :color="item.value === 'sunny' ? 'amber' : 'blue-grey'" class="mr-2">
              {{ getWeatherIcon(item.value) }}
            </v-icon>
            {{ item.title }}
          </template>
        </v-select>

        <!-- Temperature -->
        <v-text-field
          v-model.number="form.temperature"
          :label="$t('calendar.weather.temperature')"
          type="number"
          suffix="°C"
          variant="outlined"
          class="mb-3"
        />

        <!-- Notes -->
        <v-textarea
          v-model="form.notes"
          :label="$t('calendar.weather.notes')"
          variant="outlined"
          rows="2"
          auto-grow
        />
      </v-card-text>

      <v-card-actions>
        <v-btn
          v-if="hasExistingWeather"
          color="error"
          variant="text"
          :loading="deleting"
          @click="clearWeather"
        >
          {{ $t('calendar.weather.clearWeather') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="dialogVisible = false">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" :loading="saving" @click="save">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface WeatherData {
  id: number
  campaign_id: number
  year: number
  month: number
  day: number
  weather_type: string
  temperature: number | null
  notes: string | null
}

const { t } = useI18n()

const props = defineProps<{
  show: boolean
  campaignId: number | string
  year: number
  month: number
  day: number
  monthName: string
  weather?: WeatherData | null
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  saved: [WeatherData]
  cleared: []
}>()

const dialogVisible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const saving = ref(false)
const deleting = ref(false)

const form = ref({
  weatherType: 'sunny',
  temperature: null as number | null,
  notes: '',
})

// Weather type options
const weatherTypes = computed(() => [
  { value: 'sunny', title: t('calendar.weather.types.sunny') },
  { value: 'partlyCloudy', title: t('calendar.weather.types.partlyCloudy') },
  { value: 'cloudy', title: t('calendar.weather.types.cloudy') },
  { value: 'rain', title: t('calendar.weather.types.rain') },
  { value: 'heavyRain', title: t('calendar.weather.types.heavyRain') },
  { value: 'thunderstorm', title: t('calendar.weather.types.thunderstorm') },
  { value: 'snow', title: t('calendar.weather.types.snow') },
  { value: 'heavySnow', title: t('calendar.weather.types.heavySnow') },
  { value: 'fog', title: t('calendar.weather.types.fog') },
  { value: 'windy', title: t('calendar.weather.types.windy') },
  { value: 'hail', title: t('calendar.weather.types.hail') },
])

const hasExistingWeather = computed(() => !!props.weather?.id)

// Get weather icon for type
function getWeatherIcon(type: string): string {
  const icons: Record<string, string> = {
    sunny: 'mdi-weather-sunny',
    partlyCloudy: 'mdi-weather-partly-cloudy',
    cloudy: 'mdi-weather-cloudy',
    rain: 'mdi-weather-rainy',
    heavyRain: 'mdi-weather-pouring',
    thunderstorm: 'mdi-weather-lightning-rainy',
    snow: 'mdi-weather-snowy',
    heavySnow: 'mdi-weather-snowy-heavy',
    fog: 'mdi-weather-fog',
    windy: 'mdi-weather-windy',
    hail: 'mdi-weather-hail',
  }
  return icons[type] || 'mdi-weather-cloudy'
}

// Watch for dialog open to populate form
watch(
  () => props.show,
  (show) => {
    if (show) {
      if (props.weather) {
        form.value = {
          weatherType: props.weather.weather_type,
          temperature: props.weather.temperature,
          notes: props.weather.notes || '',
        }
      } else {
        // Default for new weather
        form.value = {
          weatherType: 'sunny',
          temperature: 20,
          notes: '',
        }
      }
    }
  },
  { immediate: true },
)

async function save() {
  saving.value = true
  try {
    const result = await $fetch<WeatherData>('/api/calendar/weather', {
      method: 'POST',
      body: {
        campaignId: props.campaignId,
        year: props.year,
        month: props.month,
        day: props.day,
        weatherType: form.value.weatherType,
        temperature: form.value.temperature,
        notes: form.value.notes || null,
      },
    })
    emit('saved', result)
    dialogVisible.value = false
  } catch (error) {
    console.error('Failed to save weather:', error)
  } finally {
    saving.value = false
  }
}

async function clearWeather() {
  if (!props.weather?.id) return

  deleting.value = true
  try {
    await $fetch(`/api/calendar/weather/${props.weather.id}`, {
      method: 'DELETE',
    })
    emit('cleared')
    dialogVisible.value = false
  } catch (error) {
    console.error('Failed to clear weather:', error)
  } finally {
    deleting.value = false
  }
}
</script>
