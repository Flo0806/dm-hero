<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="d-flex align-center ga-2 py-2 px-4">
      <v-icon class="group-drag-handle cursor-grab" size="small">
        mdi-drag-horizontal
      </v-icon>

      <span class="text-subtitle-1 font-weight-medium flex-grow-1">
        {{ displayName }}
      </span>

      <v-chip size="x-small" variant="tonal">
        {{ $t(`statTemplates.groups.types.${group.group_type}`, group.group_type) }}
      </v-chip>

      <v-chip size="x-small" variant="text">
        {{ group.fields.length }}
      </v-chip>

      <v-btn
        :icon="collapsed ? 'mdi-chevron-down' : 'mdi-chevron-up'"
        variant="text"
        size="x-small"
        @click="collapsed = !collapsed"
      />

      <v-btn icon="mdi-pencil" variant="text" size="x-small" @click="editingHeader = true" />

      <v-btn icon="mdi-delete" variant="text" size="x-small" color="error" @click="$emit('delete')" />
    </v-card-title>

    <!-- Inline header edit -->
    <div v-if="editingHeader" class="px-4 pb-2">
      <v-row dense>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="localName"
            :label="$t('statTemplates.groups.name')"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="localGroupType"
            :items="groupTypeItems"
            :label="$t('statTemplates.groups.type')"
            variant="outlined"
            density="compact"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="2" class="d-flex align-center ga-1">
          <v-btn icon="mdi-check" variant="text" size="x-small" color="success" @click="saveHeader" />
          <v-btn icon="mdi-close" variant="text" size="x-small" @click="cancelHeader" />
        </v-col>
      </v-row>
    </div>

    <v-divider />

    <v-card-text v-if="!collapsed" class="pa-2">
      <!-- Fields with drag & drop -->
      <draggable
        v-model="localFields"
        item-key="name"
        handle=".field-drag-handle"
        :animation="200"
        ghost-class="field-ghost"
        @end="onFieldsReorder"
      >
        <template #item="{ element, index }">
          <StatTemplatesFieldRow
            :field="element"
            @update="(updated) => updateField(index, updated)"
            @delete="deleteField(index)"
          />
        </template>
      </draggable>

      <div v-if="localFields.length === 0" class="text-center text-medium-emphasis py-4">
        {{ $t('statTemplates.groups.empty') }}
      </div>

      <!-- Add field button -->
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-plus"
        class="mt-2"
        @click="addField"
      >
        {{ $t('statTemplates.fields.add') }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { STAT_GROUP_TYPES } from '~~/types/stat-template'
import type { StatFieldType, StatGroupType } from '~~/types/stat-template'

interface FieldData {
  name: string
  label: string
  field_type: StatFieldType
  has_modifier: boolean
}

interface GroupData {
  name: string
  group_type: StatGroupType
  fields: FieldData[]
}

const props = defineProps<{
  group: GroupData
}>()

const emit = defineEmits<{
  update: [group: GroupData]
  delete: []
}>()

const { t } = useI18n()

const collapsed = ref(false)
const editingHeader = ref(false)
const localName = ref(props.group.name)
const localGroupType = ref(props.group.group_type)
const localFields = ref<FieldData[]>([...props.group.fields])

// i18n keys (from presets) → translate, plain text (user-created) → show as-is
const displayName = computed(() => {
  const name = props.group.name
  return name.startsWith('statPresets.') ? t(name) : name
})

const groupTypeItems = STAT_GROUP_TYPES.map(type => ({
  value: type,
  title: t(`statTemplates.groups.types.${type}`),
}))

function emitUpdate() {
  emit('update', {
    name: localName.value,
    group_type: localGroupType.value,
    fields: [...localFields.value],
  })
}

function saveHeader() {
  editingHeader.value = false
  emitUpdate()
}

function cancelHeader() {
  localName.value = props.group.name
  localGroupType.value = props.group.group_type
  editingHeader.value = false
}

function onFieldsReorder() {
  emitUpdate()
}

function updateField(index: number, updated: FieldData) {
  localFields.value[index] = updated
  emitUpdate()
}

function deleteField(index: number) {
  localFields.value.splice(index, 1)
  emitUpdate()
}

function addField() {
  const fieldNum = localFields.value.length + 1
  localFields.value.push({
    name: `field_${fieldNum}`,
    label: `Field ${fieldNum}`,
    field_type: 'number',
    has_modifier: false,
  })
  emitUpdate()
}

watch(() => props.group, (newGroup) => {
  localName.value = newGroup.name
  localGroupType.value = newGroup.group_type
  localFields.value = [...newGroup.fields]
}, { deep: true })
</script>

<style scoped>
.group-drag-handle {
  opacity: 0.4;
  cursor: grab;
}

.group-drag-handle:hover {
  opacity: 1;
}

.group-drag-handle:active {
  cursor: grabbing;
}

.field-ghost {
  opacity: 0.4;
}
</style>
