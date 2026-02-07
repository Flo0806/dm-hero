<template>
  <div class="field-row d-flex align-center ga-2 pa-2 rounded">
    <!-- Drag handle -->
    <v-icon class="field-drag-handle cursor-grab" size="small">
      mdi-drag-vertical
    </v-icon>

    <!-- Display mode -->
    <template v-if="!editing">
      <div class="flex-grow-1 d-flex align-center ga-2">
        <span class="text-body-2 font-weight-medium">{{ displayLabel }}</span>
        <v-chip size="x-small" variant="tonal" :color="fieldTypeColor">
          {{ $t(`statTemplates.fields.types.${field.field_type}`) }}
        </v-chip>
        <v-chip v-if="field.has_modifier" size="x-small" variant="outlined" color="info">
          {{ $t('statTemplates.fields.modifier') }}
        </v-chip>
      </div>
      <v-btn icon="mdi-pencil" variant="text" size="x-small" @click="startEdit" />
      <v-btn icon="mdi-delete" variant="text" size="x-small" color="error" @click="$emit('delete')" />
    </template>

    <!-- Edit mode -->
    <template v-else>
      <div class="flex-grow-1">
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="localField.label"
              :label="$t('statTemplates.fields.label')"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="localField.name"
              :label="$t('statTemplates.fields.name')"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="localField.field_type"
              :items="fieldTypeItems"
              :label="$t('statTemplates.fields.type')"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="2" class="d-flex align-center ga-1">
            <v-btn icon="mdi-check" variant="text" size="x-small" color="success" @click="saveEdit" />
            <v-btn icon="mdi-close" variant="text" size="x-small" @click="cancelEdit" />
          </v-col>
        </v-row>

        <!-- Modifier toggle (only for number type) -->
        <v-row v-if="localField.field_type === 'number'" dense class="mt-1">
          <v-col>
            <v-checkbox
              v-model="localField.has_modifier"
              :label="$t('statTemplates.fields.hasModifier')"
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { STAT_FIELD_TYPES } from '~~/types/stat-template'
import type { StatFieldType } from '~~/types/stat-template'

interface FieldData {
  name: string
  label: string
  field_type: StatFieldType
  has_modifier: boolean
}

const props = defineProps<{
  field: FieldData
}>()

const emit = defineEmits<{
  update: [field: FieldData]
  delete: []
}>()

const { t } = useI18n()

const editing = ref(false)
const localField = ref<FieldData>({ ...props.field })

const fieldTypeItems = STAT_FIELD_TYPES.map(type => ({
  value: type,
  title: t(`statTemplates.fields.types.${type}`),
}))

// i18n keys (from presets) → translate, plain text (user-created) → show as-is
const displayLabel = computed(() => {
  const label = props.field.label
  return label.startsWith('statPresets.') ? t(label) : label
})

const fieldTypeColor = computed(() => {
  const colors: Record<string, string> = {
    string: 'blue',
    number: 'green',
    resource: 'orange',
    boolean: 'purple',
  }
  return colors[props.field.field_type] || 'grey'
})

function startEdit() {
  localField.value = { ...props.field }
  editing.value = true
}

function saveEdit() {
  emit('update', { ...localField.value })
  editing.value = false
}

function cancelEdit() {
  localField.value = { ...props.field }
  editing.value = false
}

watch(() => props.field, (newField) => {
  if (!editing.value) {
    localField.value = { ...newField }
  }
}, { deep: true })
</script>

<style scoped>
.field-row {
  border: 1px solid rgba(var(--v-border-color), 0.12);
  transition: background-color 0.2s;
}

.field-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.field-drag-handle {
  opacity: 0.4;
  cursor: grab;
}

.field-drag-handle:hover {
  opacity: 1;
}

.field-drag-handle:active {
  cursor: grabbing;
}
</style>
