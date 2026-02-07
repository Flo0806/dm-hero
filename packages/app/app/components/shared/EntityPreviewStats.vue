<template>
  <div v-if="template" class="mt-4">
    <v-divider class="mb-3" />
    <div class="d-flex align-center ga-2 mb-2">
      <v-icon icon="mdi-clipboard-list-outline" size="small" />
      <span class="text-subtitle-2 font-weight-medium">{{ template.name }}</span>
    </div>

    <div v-for="group in template.groups" :key="group.id" class="mb-3">
      <div class="text-caption text-medium-emphasis mb-1">{{ resolveLabel(group.name) }}</div>

      <!-- Attributes: compact grid -->
      <v-row v-if="group.group_type === 'attributes'" dense>
        <v-col v-for="f in group.fields" :key="f.id" cols="4" sm="3" md="2">
          <div class="text-center pa-1 rounded stat-cell">
            <div class="text-caption text-medium-emphasis stat-label" :title="resolveLabel(f.label)">{{ resolveLabel(f.label) }}</div>
            <template v-if="f.field_type === 'number'">
              <div class="text-body-1 font-weight-bold">{{ getNumber(f.name) }}</div>
              <v-chip v-if="f.has_modifier" size="x-small" variant="tonal">{{ formatMod(getModifier(f.name)) }}</v-chip>
            </template>
            <template v-else-if="f.field_type === 'resource'">
              <div class="text-body-2 font-weight-bold">{{ getResource(f.name).current }}/{{ getResource(f.name).max }}</div>
              <v-progress-linear
                v-if="getResource(f.name).max"
                :model-value="(getResource(f.name).current / getResource(f.name).max) * 100"
                :color="resourceColor(f.name)"
                height="3"
                rounded
                class="mt-1"
              />
            </template>
            <template v-else-if="f.field_type === 'boolean'">
              <v-icon :icon="values[f.name] ? 'mdi-check' : 'mdi-close'" :color="values[f.name] ? 'success' : 'grey'" size="small" />
            </template>
            <div v-else class="text-body-2">{{ values[f.name] || '—' }}</div>
          </div>
        </v-col>
      </v-row>

      <!-- Resources -->
      <v-row v-else-if="group.group_type === 'resources'" dense>
        <v-col v-for="f in group.fields" :key="f.id" cols="6" sm="4">
          <div class="pa-2 rounded stat-cell">
            <div class="text-caption text-medium-emphasis stat-label" :title="resolveLabel(f.label)">{{ resolveLabel(f.label) }}</div>
            <template v-if="f.field_type === 'resource'">
              <div class="text-body-2 font-weight-bold">{{ getResource(f.name).current }} / {{ getResource(f.name).max }}</div>
              <v-progress-linear
                v-if="getResource(f.name).max"
                :model-value="(getResource(f.name).current / getResource(f.name).max) * 100"
                :color="resourceColor(f.name)"
                height="4"
                rounded
                class="mt-1"
              />
            </template>
            <div v-else class="text-body-2 font-weight-bold">{{ values[f.name] || '—' }}</div>
          </div>
        </v-col>
      </v-row>

      <!-- Other groups: compact rows -->
      <div v-else>
        <div v-for="f in group.fields" :key="f.id" class="d-flex align-center ga-2 py-1">
          <span class="text-caption text-medium-emphasis" style="min-width: 100px;">{{ resolveLabel(f.label) }}</span>
          <template v-if="f.field_type === 'number'">
            <span class="text-body-2 font-weight-bold">{{ getNumber(f.name) }}</span>
            <v-chip v-if="f.has_modifier" size="x-small" variant="tonal">{{ formatMod(getModifier(f.name)) }}</v-chip>
          </template>
          <template v-else-if="f.field_type === 'resource'">
            <span class="text-body-2 font-weight-bold">{{ getResource(f.name).current }}/{{ getResource(f.name).max }}</span>
          </template>
          <template v-else-if="f.field_type === 'boolean'">
            <v-icon :icon="values[f.name] ? 'mdi-check' : 'mdi-close'" :color="values[f.name] ? 'success' : 'grey'" size="small" />
          </template>
          <span v-else class="text-body-2">{{ values[f.name] || '—' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StatTemplate } from '~~/types/stat-template'

const { t } = useI18n()

const props = defineProps<{
  entityId: number
}>()

const template = ref<StatTemplate | null>(null)
const values = ref<Record<string, unknown>>({})

async function fetchStats(id: number) {
  try {
    const data = await $fetch<{ stats: { values: Record<string, unknown> }, template: StatTemplate } | null>(`/api/entity-stats/${id}`)
    if (data) {
      template.value = data.template
      values.value = data.stats.values
    }
    else {
      template.value = null
      values.value = {}
    }
  }
  catch {
    template.value = null
    values.value = {}
  }
}

// Always reload on mount (template may have changed externally)
onMounted(() => fetchStats(props.entityId))
watch(() => props.entityId, (id) => {
  if (id) fetchStats(id)
})

function resolveLabel(label: string): string {
  return label.startsWith('statPresets.') ? t(label) : label
}

function getNumber(name: string): number {
  const v = values.value[name]
  if (v && typeof v === 'object' && 'value' in v) return (v as { value: number }).value ?? 0
  return Number(v) || 0
}

function getModifier(name: string): number {
  const v = values.value[name]
  if (v && typeof v === 'object' && 'modifier' in v) return (v as { modifier: number }).modifier ?? 0
  return 0
}

function getResource(name: string): { current: number, max: number } {
  const v = values.value[name]
  if (v && typeof v === 'object' && 'current' in v) return v as { current: number, max: number }
  return { current: 0, max: 0 }
}

function resourceColor(name: string): string {
  const r = getResource(name)
  if (!r.max) return 'grey'
  const pct = r.current / r.max
  return pct > 0.5 ? 'success' : pct > 0.25 ? 'warning' : 'error'
}

function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : String(mod)
}
</script>

<style scoped>
.stat-cell {
  border: 1px solid rgba(var(--v-border-color), 0.12);
}
.stat-label {
  font-size: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
