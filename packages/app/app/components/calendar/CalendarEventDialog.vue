<template>
  <v-dialog v-model="modelValue" max-width="700">
    <v-card>
      <v-card-title>
        {{ isEditing ? $t('calendar.editEvent') : $t('calendar.newEvent') }}
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="form.title"
          :label="$t('calendar.eventTitle')"
          variant="outlined"
          class="mb-3"
        />
        <v-textarea
          v-model="form.description"
          :label="$t('calendar.eventDescription')"
          variant="outlined"
          rows="3"
          class="mb-3"
        />
        <v-select
          v-model="form.eventType"
          :label="$t('calendar.eventType')"
          :items="eventTypeOptions"
          variant="outlined"
          class="mb-3"
        />
        <v-row>
          <v-col cols="4">
            <v-text-field
              v-model.number="form.day"
              :label="$t('calendar.day')"
              type="number"
              variant="outlined"
            />
          </v-col>
          <v-col cols="4">
            <v-select
              v-model="form.month"
              :label="$t('calendar.month')"
              :items="monthOptions"
              variant="outlined"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="form.year"
              :label="$t('calendar.year')"
              type="number"
              variant="outlined"
              :disabled="form.isRecurring"
            />
          </v-col>
        </v-row>
        <v-checkbox
          v-model="form.isRecurring"
          :label="$t('calendar.isRecurring')"
          class="mb-2"
        />

        <!-- Multi-Entity Selection -->
        <v-autocomplete
          v-model="form.entityIds"
          :label="$t('calendar.linkedEntities')"
          :items="groupedEntityOptions"
          item-title="name"
          item-value="id"
          variant="outlined"
          multiple
          chips
          closable-chips
          :hint="$t('calendar.linkedEntitiesHint')"
          persistent-hint
        >
          <template #chip="{ props: chipProps, item }">
            <v-chip
              v-bind="chipProps"
              :color="getEntityColor(item.raw.type)"
              size="small"
              :class="{ 'text-decoration-line-through': item.raw.deleted }"
            >
              <v-icon start size="small">{{ getEntityIcon(item.raw.type) }}</v-icon>
              {{ item.raw.name }}
            </v-chip>
          </template>
          <template #item="{ props: itemProps, item }">
            <v-list-item
              v-bind="itemProps"
              :title="item.raw.name"
              :subtitle="$t(`entityTypes.${item.raw.type}`)"
            >
              <template #prepend>
                <v-icon :color="getEntityColor(item.raw.type)" size="small">
                  {{ getEntityIcon(item.raw.type) }}
                </v-icon>
              </template>
            </v-list-item>
          </template>
        </v-autocomplete>
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
import { ENTITY_TYPE_ICONS, ENTITY_TYPE_COLORS } from '~~/types/map'

interface EventForm {
  title: string
  description: string
  eventType: string
  day: number
  month: number
  year: number
  isRecurring: boolean
  entityId: number | null // Legacy
  entityIds: number[] // New multi-entity
}

interface MonthOption {
  title: string
  value: number
}

interface EntityOption {
  id: number
  name: string
  type: string
  deleted?: boolean
}

const props = defineProps<{
  isEditing: boolean
  saving: boolean
  monthOptions: MonthOption[]
  entityOptions: EntityOption[]
}>()

const emit = defineEmits<{
  save: []
}>()

// Two-way binding for dialog visibility
const modelValue = defineModel<boolean>({ required: true })

// Two-way binding for form data - allows mutation
const form = defineModel<EventForm>('form', { required: true })

const { t } = useI18n()

const eventTypeOptions = computed(() => [
  { title: t('calendar.eventTypes.custom'), value: 'custom' },
  { title: t('calendar.eventTypes.birthday'), value: 'birthday' },
  { title: t('calendar.eventTypes.death'), value: 'death' },
  { title: t('calendar.eventTypes.holiday'), value: 'holiday' },
  { title: t('calendar.eventTypes.session'), value: 'session' },
  { title: t('calendar.eventTypes.festival'), value: 'festival' },
  { title: t('calendar.eventTypes.war'), value: 'war' },
  { title: t('calendar.eventTypes.founding'), value: 'founding' },
])

// Group entities by type for better UX
const groupedEntityOptions = computed(() => {
  // Create a copy to avoid mutating the prop
  return [...props.entityOptions].sort((a, b) => {
    // Sort by type first, then by name
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type)
    }
    return a.name.localeCompare(b.name)
  })
})

function getEntityIcon(type: string): string {
  return ENTITY_TYPE_ICONS[type] || 'mdi-help-circle'
}

function getEntityColor(type: string): string {
  return ENTITY_TYPE_COLORS[type] || '#888888'
}
</script>
