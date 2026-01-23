<template>
  <v-dialog :model-value="show" max-width="600" scrollable persistent @update:model-value="handleDialogChange">
    <v-card v-if="show">
      <v-card-title>
        {{ groupId ? $t('groups.edit') : $t('groups.create') }}
      </v-card-title>

      <v-card-text>
        <!-- Name -->
        <v-text-field
          v-model="form.name"
          :label="$t('groups.name')"
          :rules="[rules.required]"
          variant="outlined"
          autofocus
          class="mb-4"
        />

        <!-- Description -->
        <v-textarea
          v-model="form.description"
          :label="$t('groups.description')"
          variant="outlined"
          rows="2"
          auto-grow
          class="mb-4"
        />

        <!-- Color Selection -->
        <div class="mb-4">
          <label class="v-label text-caption mb-2 d-block">{{ $t('groups.color') }}</label>
          <div class="d-flex flex-wrap ga-2">
            <v-avatar
              v-for="color in GROUP_COLORS"
              :key="color"
              :color="color"
              size="32"
              class="color-option"
              :class="{ 'color-selected': form.color === color }"
              @click="form.color = color"
            >
              <v-icon v-if="form.color === color" icon="mdi-check" size="small" :color="getContrastColor(color)" />
            </v-avatar>
            <!-- Custom color input -->
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-avatar
                  v-bind="menuProps"
                  :color="isCustomColor ? (form.color ?? undefined) : 'grey-lighten-2'"
                  size="32"
                  class="color-option"
                  :class="{ 'color-selected': isCustomColor }"
                >
                  <v-icon icon="mdi-palette" size="small" :color="isCustomColor ? getContrastColor(form.color) : 'grey'" />
                </v-avatar>
              </template>
              <v-card min-width="200">
                <v-card-text>
                  <v-text-field
                    v-model="form.color"
                    label="Hex Color"
                    placeholder="#D4A574"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-card-text>
              </v-card>
            </v-menu>
            <!-- Clear color -->
            <v-avatar
              v-if="form.color"
              color="grey-lighten-3"
              size="32"
              class="color-option"
              @click="form.color = null"
            >
              <v-icon icon="mdi-close" size="small" color="grey" />
            </v-avatar>
          </div>
        </div>

        <!-- Icon Selection -->
        <v-combobox
          v-model="form.icon"
          :items="iconSuggestions"
          :label="$t('groups.icon')"
          :hint="$t('groups.iconHint')"
          variant="outlined"
          clearable
          persistent-hint
        >
          <template #prepend-inner>
            <v-icon v-if="displayIcon" :icon="displayIcon" />
          </template>
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <v-icon :icon="item.value" class="mr-2" />
              </template>
            </v-list-item>
          </template>
        </v-combobox>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!isValid" @click="save">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { GROUP_COLORS, GROUP_ICONS, getContrastColor, type EntityGroup } from '~~/types/group'

const { t } = useI18n()
const campaignStore = useCampaignStore()
const snackbarStore = useSnackbarStore()

interface Props {
  show: boolean
  groupId?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  groupId: null,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: [group: EntityGroup]
  created: [group: EntityGroup]
}>()

// Form state
const form = ref({
  name: '',
  description: '',
  color: null as string | null,
  icon: null as string | null,
})

const saving = ref(false)

// Validation rules
const rules = {
  required: (v: string) => !!v?.trim() || t('groups.nameRequired'),
}

const isValid = computed(() => !!form.value.name?.trim())

// Icon suggestions
const iconSuggestions = computed(() =>
  GROUP_ICONS.map((icon) => ({
    title: icon.replace('mdi-', ''),
    value: icon,
  })),
)

// Helper to extract icon value from combobox (returns object when selected from list)
function getIconValue(val: string | { value: string; title: string } | null): string | null {
  if (!val) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object' && 'value' in val) return val.value
  return null
}

// Computed to get the actual icon string for display
const displayIcon = computed(() => getIconValue(form.value.icon as string | { value: string; title: string } | null))

// Check if color is custom (not in preset list)
const isCustomColor = computed(() => {
  if (!form.value.color) return false
  return !GROUP_COLORS.includes(form.value.color as (typeof GROUP_COLORS)[number])
})

// Load group data when dialog opens
watch(
  [() => props.show, () => props.groupId],
  async ([show, groupId]) => {
    if (!show) return

    if (groupId) {
      const group = await $fetch<EntityGroup>(`/api/groups/${groupId}`)
      form.value = {
        name: group.name,
        description: group.description || '',
        color: group.color,
        icon: group.icon,
      }
    } else {
      // Reset form for create
      form.value = {
        name: '',
        description: '',
        color: null,
        icon: null,
      }
    }
  },
  { immediate: true },
)

function handleDialogChange(value: boolean) {
  if (!value) {
    close()
  }
}

function close() {
  emit('update:show', false)
}

async function save() {
  if (!isValid.value || !campaignStore.activeCampaignId) return

  saving.value = true

  const data = {
    name: form.value.name.trim(),
    description: form.value.description?.trim() || null,
    color: form.value.color || null,
    icon: getIconValue(form.value.icon as string | { value: string; title: string } | null),
  }

  if (props.groupId) {
    // Update existing group
    const updated = await $fetch<EntityGroup>(`/api/groups/${props.groupId}`, {
      method: 'PATCH',
      body: data,
    })
    snackbarStore.success(t('groups.saved'))
    emit('saved', updated)
  } else {
    // Create new group
    const created = await $fetch<EntityGroup>('/api/groups', {
      method: 'POST',
      body: {
        campaignId: campaignStore.activeCampaignId,
        ...data,
      },
    })
    snackbarStore.success(t('groups.created'))
    emit('created', created)
  }

  saving.value = false
  close()
}

</script>

<style scoped>
.color-option {
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-selected {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.3);
}
</style>
