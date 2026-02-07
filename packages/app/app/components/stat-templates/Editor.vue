<template>
  <div>
    <!-- Top bar: Template select + New button + Save/Delete -->
    <div class="d-flex align-center ga-3 mb-6">
      <v-select
        v-model="selectedTemplateId"
        :items="templateSelectItems"
        :label="$t('statTemplates.title')"
        variant="outlined"
        density="compact"
        hide-details
        class="flex-grow-1"
        style="max-width: 500px;"
        :disabled="isDirty"
      >
        <template #item="{ item, props: itemProps }">
          <v-list-item v-bind="itemProps">
            <template v-if="item.raw.systemKey || item.raw.isImported" #append>
              <v-chip v-if="item.raw.isImported" size="x-small" variant="tonal" color="info" class="mr-1">
                {{ $t('statTemplates.importedBadge') }}
              </v-chip>
              <v-chip v-if="item.raw.systemKey" size="x-small" variant="tonal" color="primary">
                {{ $t(`statPresets.${item.raw.systemKey}.name`, item.raw.systemKey) }}
              </v-chip>
            </template>
          </v-list-item>
        </template>
      </v-select>

      <!-- New template menu -->
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            color="primary"
            prepend-icon="mdi-plus"
            :disabled="isDirty"
          >
            {{ $t('statTemplates.create') }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="preset in store.presets"
            :key="preset.system_key"
            :prepend-icon="presetIcon(preset.system_key)"
            @click="createFromPreset(preset.system_key)"
          >
            <v-list-item-title>{{ $t(preset.name) }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-spacer />

      <!-- Save + Delete -->
      <v-btn
        v-if="currentTemplate"
        color="primary"
        :loading="saving"
        :disabled="!isDirty"
        prepend-icon="mdi-content-save"
        @click="save"
      >
        {{ $t('common.save') }}
      </v-btn>
      <v-btn
        v-if="currentTemplate"
        icon="mdi-delete"
        variant="text"
        color="error"
        :disabled="isDirty"
        @click="$emit('requestDelete', currentTemplate)"
      />
    </div>

    <!-- Dirty state warning -->
    <v-alert
      v-if="isDirty"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      <div class="d-flex align-center">
        <span>{{ $t('statTemplates.unsavedChanges') }}</span>
        <v-spacer />
        <v-btn size="small" variant="text" @click="discardChanges">
          {{ $t('statTemplates.discardChanges') }}
        </v-btn>
      </div>
    </v-alert>

    <!-- No template selected -->
    <div v-if="!currentTemplate" class="text-center py-8">
      <v-icon icon="mdi-clipboard-list-outline" size="48" color="grey" class="mb-4" />
      <p class="text-body-1 text-medium-emphasis">{{ $t('statTemplates.noTemplates') }}</p>
      <p class="text-body-2 text-medium-emphasis">{{ $t('statTemplates.noTemplatesHint') }}</p>
    </div>

    <!-- Template editor: name + description + groups -->
    <template v-else>
      <v-chip
        v-if="currentTemplate?.is_imported"
        size="small"
        variant="tonal"
        color="info"
        prepend-icon="mdi-import"
        class="mb-3"
      >
        {{ $t('statTemplates.importedBadge') }}
      </v-chip>

      <v-row dense class="mb-4">
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="localName"
            :label="$t('statTemplates.templateName')"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="markDirty"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="localDescription"
            :label="$t('statTemplates.templateDescription')"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="markDirty"
          />
        </v-col>
      </v-row>

      <!-- Groups with drag & drop -->
      <draggable
        v-model="localGroups"
        item-key="_key"
        handle=".group-drag-handle"
        :animation="200"
        ghost-class="group-ghost"
        @end="onGroupsReorder"
      >
        <template #item="{ element, index }">
          <StatTemplatesGroupEditor
            :group="element"
            @update="(updated: Omit<GroupData, '_key'>) => updateGroup(index, updated)"
            @delete="deleteGroup(index)"
          />
        </template>
      </draggable>

      <!-- Add group button -->
      <v-btn
        variant="outlined"
        prepend-icon="mdi-plus"
        class="mt-2"
        @click="addGroup"
      >
        {{ $t('statTemplates.groups.add') }}
      </v-btn>
    </template>

  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import type { StatTemplate, SaveStatTemplatePayload } from '~~/types/stat-template'
import { useStatTemplatesStore } from '~/stores/statTemplates'

interface FieldData {
  name: string
  label: string
  field_type: 'string' | 'number' | 'resource' | 'boolean'
  has_modifier: boolean
}

interface GroupData {
  _key: string
  name: string
  group_type: string
  fields: FieldData[]
}

defineEmits<{
  requestDelete: [template: StatTemplate]
}>()

const { t } = useI18n()
const store = useStatTemplatesStore()

const selectedTemplateId = ref<number | null>(null)
const saving = ref(false)
const isDirty = ref(false)

const localName = ref('')
const localDescription = ref('')
const localGroups = ref<GroupData[]>([])

let keyCounter = 0
function makeKey() {
  return `group_${++keyCounter}`
}

function presetIcon(key: string): string {
  const icons: Record<string, string> = {
    dnd5e: 'mdi-dice-d20',
    pathfinder2e: 'mdi-shield-sword',
    dsa5: 'mdi-star-four-points',
    splittermond: 'mdi-moon-waning-crescent',
    blank: 'mdi-file-outline',
  }
  return icons[key] || 'mdi-file-outline'
}

// Current template from store based on selection
const currentTemplate = computed(() => {
  if (!selectedTemplateId.value) return null
  return store.templates.find(t => t.id === selectedTemplateId.value) || null
})

// Items for the select dropdown
const templateSelectItems = computed(() =>
  store.templates.map(t => ({
    value: t.id,
    title: t.name,
    systemKey: t.system_key,
    isImported: t.is_imported,
  })),
)

// Load template data into local state
function loadTemplateIntoEditor(template: StatTemplate) {
  localName.value = template.name
  localDescription.value = template.description || ''
  localGroups.value = template.groups.map(g => ({
    _key: makeKey(),
    name: g.name,
    group_type: g.group_type,
    fields: g.fields.map(f => ({
      name: f.name,
      label: f.label,
      field_type: f.field_type,
      has_modifier: f.has_modifier,
    })),
  }))
  isDirty.value = false
}

// Watch select changes
watch(selectedTemplateId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    const template = store.templates.find(t => t.id === newId)
    if (template) loadTemplateIntoEditor(template)
  }
})

// Auto-select first template, or reset if selected was deleted
watch(() => store.templates, (templates) => {
  const stillExists = templates.some(t => t.id === selectedTemplateId.value)
  if (!stillExists) {
    selectedTemplateId.value = templates.length > 0 ? templates[0]!.id : null
  }
}, { immediate: true })

// Load presets on mount
onMounted(() => {
  store.loadPresets()
})

async function createFromPreset(systemKey: string) {
  const preset = store.presets.find(p => p.system_key === systemKey)
  if (!preset) return

  try {
    const template = await store.createFromPreset(systemKey, t(preset.name))
    nextTick(() => {
      selectedTemplateId.value = template.id
    })
  }
  catch (error) {
    console.error('Failed to create template:', error)
  }
}

function markDirty() {
  isDirty.value = true
}

function onGroupsReorder() {
  markDirty()
}

function updateGroup(index: number, updated: Omit<GroupData, '_key'>) {
  const existing = localGroups.value[index]
  if (existing) {
    localGroups.value[index] = { ...updated, _key: existing._key }
    markDirty()
  }
}

function deleteGroup(index: number) {
  localGroups.value.splice(index, 1)
  markDirty()
}

function addGroup() {
  localGroups.value.push({
    _key: makeKey(),
    name: `${t('statTemplates.groups.title')} ${localGroups.value.length + 1}`,
    group_type: 'custom',
    fields: [],
  })
  markDirty()
}

async function save() {
  if (!selectedTemplateId.value) return

  saving.value = true
  try {
    const groups: SaveStatTemplatePayload['groups'] = localGroups.value.map(g => ({
      name: g.name,
      group_type: g.group_type,
      fields: g.fields.map(f => ({
        name: f.name,
        label: f.label,
        field_type: f.field_type,
        has_modifier: f.has_modifier,
      })),
    }))

    await store.saveTemplate(selectedTemplateId.value, {
      name: localName.value,
      description: localDescription.value || null,
      groups,
    })

    isDirty.value = false
  }
  catch (error) {
    console.error('Failed to save template:', error)
  }
  finally {
    saving.value = false
  }
}

function discardChanges() {
  if (currentTemplate.value) {
    loadTemplateIntoEditor(currentTemplate.value)
  }
}
</script>

<style scoped>
.group-ghost {
  opacity: 0.4;
}
</style>
