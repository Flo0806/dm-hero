<template>
  <v-dialog v-model="dialog" max-width="500" persistent>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon :icon="form.icon || 'mdi-folder'" :color="form.color || 'primary'" />
        {{ folder ? $t('folders.edit') : $t('folders.create') }}
      </v-card-title>

      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="form.name"
            :label="$t('folders.name')"
            :rules="[required]"
            variant="outlined"
            density="comfortable"
            autofocus
            @keyup.enter="submit"
          />

          <div class="text-body-small text-medium-emphasis mb-2">
            {{ $t('folders.color') }}
          </div>
          <div class="d-flex flex-wrap ga-2 mb-4" role="radiogroup" :aria-label="$t('folders.color')">
            <button
              v-for="c in COLORS"
              :key="c.value ?? 'none'"
              type="button"
              class="folder-swatch"
              :class="{ 'folder-swatch-selected': form.color === c.value }"
              :style="{ background: c.css }"
              :aria-label="c.label"
              :aria-checked="form.color === c.value ? 'true' : 'false'"
              role="radio"
              @click="form.color = c.value"
            />
          </div>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="submit">
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { EntityFolder, EntityFolderType, EntityFolderWithCount } from '~~/types/folder'
import { useFoldersStore } from '~/stores/folders'

const props = defineProps<{
  show: boolean
  campaignId: number
  entityType: EntityFolderType
  folder?: EntityFolderWithCount | null
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  'saved': [EntityFolder]
}>()

const { t } = useI18n()
const foldersStore = useFoldersStore()

const dialog = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

interface FormState {
  name: string
  color: string | null
  icon: string | null
}

const form = ref<FormState>({ name: '', color: null, icon: null })
const saving = ref(false)
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

// Color palette: null (default) + a few accent options. Re-uses tag palette
// values so the visual language stays consistent.
const COLORS = [
  { value: null, label: t('folders.colorDefault'), css: 'var(--v-theme-surface-variant, #888)' },
  { value: 'primary', label: 'primary', css: '#D4A574' },
  { value: 'error', label: 'red', css: '#E57373' },
  { value: 'purple', label: 'purple', css: '#BA68C8' },
  { value: 'blue', label: 'blue', css: '#64B5F6' },
  { value: 'green', label: 'green', css: '#81C784' },
  { value: 'orange', label: 'orange', css: '#FFB74D' },
]

function required(v: string) {
  return (!!v && v.trim().length > 0) || t('common.requiredField')
}

watch(
  () => [props.show, props.folder] as const,
  ([show]) => {
    if (!show) return
    form.value = props.folder
      ? { name: props.folder.name, color: props.folder.color, icon: props.folder.icon }
      : { name: '', color: null, icon: null }
  },
  { immediate: true },
)

async function submit() {
  if (!formRef.value) return
  const { valid } = await formRef.value.validate()
  if (!valid) return

  saving.value = true
  try {
    let result: EntityFolder
    if (props.folder) {
      result = await foldersStore.update(props.campaignId, props.entityType, props.folder.id, {
        name: form.value.name,
        color: form.value.color,
        icon: form.value.icon,
      })
    }
    else {
      result = await foldersStore.create({
        campaignId: props.campaignId,
        entityType: props.entityType,
        name: form.value.name,
        color: form.value.color,
        icon: form.value.icon,
      })
    }
    emit('saved', result)
    close()
  }
  finally {
    saving.value = false
  }
}

function close() {
  emit('update:show', false)
}
</script>

<style scoped>
.folder-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 100ms ease, border-color 100ms ease;
}
.folder-swatch:hover {
  transform: scale(1.1);
}
.folder-swatch-selected {
  border-color: rgb(var(--v-theme-on-surface));
}
</style>
