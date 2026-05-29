<template>
  <v-dialog v-model="dialog" max-width="780" scrollable persistent>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon :icon="form.icon || 'mdi-earth'" :color="form.color || 'primary'" />
        {{ $t('calendar.editClimateZone') }}
      </v-card-title>

      <v-card-text style="max-height: 70vh">
        <!-- Zone metadata -->
        <v-text-field
          v-model="form.name"
          :label="$t('calendar.climateZoneName')"
          variant="outlined"
          density="comfortable"
          :rules="[v => !!v?.trim() || $t('calendar.seasonNameRequired')]"
        />

        <!-- Color: fixed palette, no free text -->
        <div class="text-body-small text-medium-emphasis mb-1">{{ $t('calendar.seasonColor') }}</div>
        <div class="d-flex flex-wrap ga-2 mb-3" role="radiogroup" :aria-label="$t('calendar.seasonColor')">
          <button
            v-for="c in CLIMATE_ZONE_COLORS"
            :key="c"
            type="button"
            class="zone-swatch"
            :class="{ 'zone-swatch--selected': form.color === c }"
            :style="{ background: c }"
            :aria-label="c"
            :aria-checked="form.color === c ? 'true' : 'false'"
            role="radio"
            @click="form.color = c"
          />
        </div>

        <!-- Icon: fixed set, no free text -->
        <div class="text-body-small text-medium-emphasis mb-1">{{ $t('calendar.seasonIcon') }}</div>
        <div class="d-flex flex-wrap ga-1 mb-2" role="radiogroup" :aria-label="$t('calendar.seasonIcon')">
          <v-btn
            v-for="ic in CLIMATE_ZONE_ICONS"
            :key="ic"
            :icon="ic"
            size="small"
            :variant="form.icon === ic ? 'flat' : 'text'"
            :color="form.icon === ic ? 'primary' : undefined"
            role="radio"
            :aria-checked="form.icon === ic ? 'true' : 'false'"
            @click="form.icon = ic"
          />
        </div>

        <v-divider class="my-3" />

        <!-- Per-season profiles -->
        <div v-if="seasons.length === 0" class="text-center text-medium-emphasis py-6">
          {{ $t('calendar.noSeasons') }}
        </div>
        <v-expansion-panels v-else v-model="openPanel" variant="accordion">
          <v-expansion-panel
            v-for="season in seasons"
            :key="season.id"
            :value="season.id"
          >
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 flex-grow-1">
                <strong>{{ season.name }}</strong>
                <span class="text-medium-emphasis text-body-small">
                  {{ profileSummary(season.id) }}
                </span>
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text v-if="profiles[season.id]">
              <!-- Temperature -->
              <v-row dense class="mt-1">
                <v-col cols="6">
                  <v-text-field
                    v-model.number="profiles[season.id]!.temp_min"
                    :label="$t('calendar.tempMin')"
                    type="number"
                    suffix="°"
                    variant="outlined"
                    density="comfortable"
                    :error="!tempValid(season.id)"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="profiles[season.id]!.temp_max"
                    :label="$t('calendar.tempMax')"
                    type="number"
                    suffix="°"
                    variant="outlined"
                    density="comfortable"
                    :error="!tempValid(season.id)"
                    :error-messages="tempValid(season.id) ? [] : [$t('calendar.tempRangeInvalid')]"
                  />
                </v-col>
              </v-row>

              <!-- Weather distribution -->
              <div class="text-overline mt-2 mb-1">
                {{ $t('calendar.weatherDistribution') }}
              </div>
              <v-row dense>
                <v-col
                  v-for="type in WEATHER_TYPES"
                  :key="type"
                  cols="12"
                  sm="6"
                >
                  <div class="d-flex align-center ga-2">
                    <span class="text-body-small" style="min-width: 120px">
                      {{ $t(`calendar.weather.types.${type}`) }}
                    </span>
                    <v-slider
                      v-model="profiles[season.id]!.distribution[type]"
                      :min="0"
                      :max="100"
                      :step="1"
                      hide-details
                      density="compact"
                      thumb-label
                      color="primary"
                      class="flex-grow-1"
                    />
                    <span class="text-body-small text-medium-emphasis" style="min-width: 36px; text-align: right">
                      {{ profiles[season.id]!.distribution[type] ?? 0 }}
                    </span>
                  </div>
                </v-col>
              </v-row>
              <div class="text-body-small text-medium-emphasis mt-2">
                {{ $t('calendar.weatherSum', { n: weatherSum(season.id) }) }}
                <span v-if="weatherSum(season.id) === 0" class="text-error ml-2">
                  {{ $t('calendar.weatherSumZero') }}
                </span>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="save">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { CalendarSeason } from '~~/types/calendar'
import type { ClimateZoneWithProfiles, WeatherDistribution, WeatherType } from '~~/types/climate-zone'
import {
  WEATHER_TYPES,
  CLIMATE_ZONE_COLORS,
  CLIMATE_ZONE_ICONS,
  DEFAULT_ZONE_COLOR,
  DEFAULT_ZONE_ICON,
  DEFAULT_TEMP_MIN,
  DEFAULT_TEMP_MAX,
} from '~~/types/climate-zone'

const props = defineProps<{
  show: boolean
  zone: ClimateZoneWithProfiles | null
  seasons: CalendarSeason[]
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  'saved': []
}>()

const { t } = useI18n()
const snackbarStore = useSnackbarStore()

const dialog = computed({
  get: () => props.show,
  set: v => emit('update:show', v),
})

interface ProfileForm {
  temp_min: number
  temp_max: number
  /** Keys are WeatherType, value is current slider weight 0-100 */
  distribution: Record<WeatherType, number>
}

const form = ref({ name: '', color: '', icon: '' })
const profiles = ref<Record<number, ProfileForm>>({})
const openPanel = ref<number | null>(null)
const saving = ref(false)

function blankDistribution(): Record<WeatherType, number> {
  const out = {} as Record<WeatherType, number>
  for (const t of WEATHER_TYPES) out[t] = 0
  return out
}

watch(
  () => [props.show, props.zone, props.seasons] as const,
  ([show, zone, seasons]) => {
    if (!show || !zone) return
    // Fall back to the defaults so color/icon are always a valid palette entry.
    form.value = {
      name: zone.name,
      color: zone.color ?? DEFAULT_ZONE_COLOR,
      icon: zone.icon ?? DEFAULT_ZONE_ICON,
    }
    // Build a form-shaped profile for every season — missing ones default to
    // zeros so the user can fill them in without an "add profile" step.
    const next: Record<number, ProfileForm> = {}
    for (const season of seasons) {
      const existing = zone.profiles.find(p => p.season_id === season.id)
      const dist = blankDistribution()
      if (existing) {
        for (const t of WEATHER_TYPES) {
          dist[t] = existing.weather_distribution[t] ?? 0
        }
      }
      next[season.id] = {
        temp_min: existing?.temp_min ?? DEFAULT_TEMP_MIN,
        temp_max: existing?.temp_max ?? DEFAULT_TEMP_MAX,
        distribution: dist,
      }
    }
    profiles.value = next
    openPanel.value = seasons[0]?.id ?? null
  },
  { immediate: true, deep: true },
)

function weatherSum(seasonId: number): number {
  const dist = profiles.value[seasonId]?.distribution
  if (!dist) return 0
  return WEATHER_TYPES.reduce((s, t) => s + (dist[t] ?? 0), 0)
}

// max must be strictly greater than min — never equal, never less.
function tempValid(seasonId: number): boolean {
  const p = profiles.value[seasonId]
  if (!p) return true
  return Number(p.temp_max) > Number(p.temp_min)
}

function profileSummary(seasonId: number): string {
  const p = profiles.value[seasonId]
  if (!p) return ''
  return t('calendar.profileSummary', {
    min: p.temp_min,
    max: p.temp_max,
    sum: weatherSum(seasonId),
  })
}

function close() {
  emit('update:show', false)
}

async function save() {
  if (!props.zone) return
  const name = form.value.name.trim()
  if (!name) {
    snackbarStore.error(t('calendar.seasonNameRequired'))
    return
  }
  // Block save if any season has an invalid temp range (max <= min).
  const invalidSeason = props.seasons.find(s => !tempValid(s.id))
  if (invalidSeason) {
    openPanel.value = invalidSeason.id
    snackbarStore.error(t('calendar.tempRangeInvalid'))
    return
  }

  saving.value = true
  try {
    // 1. Update zone metadata. color/icon come from fixed pickers so they're
    // always valid palette entries — no trimming/validation needed.
    await $fetch(`/api/climate-zones/${props.zone.id}`, {
      method: 'PATCH',
      body: {
        name,
        color: form.value.color,
        icon: form.value.icon,
      },
    })

    // 2. Upsert each profile that has a non-zero weather distribution. Empty
    // distributions are skipped so the user doesn't end up with all-zero rows
    // the generator can't use.
    for (const season of props.seasons) {
      const p = profiles.value[season.id]
      if (!p) continue
      const dist: WeatherDistribution = {}
      for (const type of WEATHER_TYPES) {
        if (p.distribution[type] > 0) dist[type] = p.distribution[type]
      }
      if (Object.keys(dist).length === 0) continue
      await $fetch(`/api/climate-zones/${props.zone.id}/profile`, {
        method: 'PATCH',
        body: {
          season_id: season.id,
          temp_min: p.temp_min,
          temp_max: p.temp_max,
          weather_distribution: dist,
        },
      })
    }

    snackbarStore.success(t('calendar.climateZoneSaved'))
    emit('saved')
    close()
  }
  catch (e) {
    console.error('[climate-zones] save failed', e)
    snackbarStore.error(t('calendar.climateZoneError'))
  }
  finally {
    saving.value = false
  }
}
</script>

<style scoped>
.zone-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 100ms ease, border-color 100ms ease;
}
.zone-swatch:hover {
  transform: scale(1.1);
}
.zone-swatch--selected {
  border-color: rgb(var(--v-theme-on-surface));
}
</style>
