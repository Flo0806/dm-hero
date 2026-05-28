<template>
  <FeatureTooltip
    feature-key="theme-switcher-v1"
    :text="$t('featureTooltips.themeSwitcher')"
    location="end"
  >
    <v-list-item
      :id="ACTIVATOR_ID"
      prepend-icon="mdi-palette"
      :title="rail ? '' : $t('nav.theme')"
    >
      <template v-if="!rail" #append>
        <div class="d-flex align-center ga-1">
          <span
            class="swatch swatch--primary"
            :style="{ background: swatch.primary }"
          />
          <span
            class="swatch swatch--bg"
            :style="{ background: swatch.background }"
          />
        </div>
      </template>
    </v-list-item>

    <v-menu
      :activator="`#${ACTIVATOR_ID}`"
      :close-on-content-click="false"
      location="end"
      offset="8"
    >
      <v-card min-width="220">
        <v-list density="compact" nav>
          <v-list-subheader>{{ $t('nav.themePickerTitle') }}</v-list-subheader>
          <v-list-item
            v-for="name in available"
            :key="name"
            :active="current === name"
            @click="setTheme(name)"
          >
            <template #prepend>
              <div class="d-flex align-center ga-1 mr-2">
                <span
                  class="swatch swatch--primary"
                  :style="{ background: swatches[name].primary }"
                />
                <span
                  class="swatch swatch--bg"
                  :style="{ background: swatches[name].background }"
                />
              </div>
            </template>
            <v-list-item-title>{{ $t(`themes.${name}`) }}</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1" />
          <v-list-item
            prepend-icon="mdi-restore"
            :disabled="current === defaultTheme"
            @click="reset"
          >
            <v-list-item-title>{{ $t('common.reset') }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>
  </FeatureTooltip>
</template>

<script setup lang="ts">
import FeatureTooltip from '~/components/shared/FeatureTooltip.vue'
import { useThemePreference } from '~/composables/useThemePreference'
import { getThemeSwatch, THEME_NAMES, type ThemeName } from '~/composables/themes'

defineProps<{ rail: boolean }>()

const ACTIVATOR_ID = 'theme-switcher-activator'

const { current, setTheme, reset, available, defaultTheme } = useThemePreference()

const swatches = Object.fromEntries(
  THEME_NAMES.map(name => [name, getThemeSwatch(name)]),
) as Record<ThemeName, { primary: string, background: string }>

const swatch = computed(() => swatches[current.value])
</script>

<style scoped>
.swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.swatch--primary {
  border-radius: 3px 0 0 3px;
}
.swatch--bg {
  border-radius: 0 3px 3px 0;
  margin-inline-start: -1px;
}
</style>
