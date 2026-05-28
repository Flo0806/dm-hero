<template>
  <div>
    <div class="d-flex align-center mb-4">
      <div>
        <h2 class="text-headline-small">{{ $t('tags.manage.title') }}</h2>
        <p class="text-body-medium text-medium-emphasis mb-0">{{ $t('tags.manage.subtitle') }}</p>
      </div>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
        {{ $t('tags.manage.newTag') }}
      </v-btn>
    </div>

    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else-if="tags.length === 0" class="text-center py-8 text-medium-emphasis">
      {{ $t('tags.manage.empty') }}
    </div>

    <v-table v-else density="compact" class="tag-table">
      <thead>
        <tr>
          <th>{{ $t('tags.manage.colTag') }}</th>
          <th class="text-right">{{ $t('tags.manage.colUsage') }}</th>
          <th class="text-right" style="width: 110px;">{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tag in tags" :key="tag.id">
          <td>
            <SharedTagChip :tag="tag" size="default" />
          </td>
          <td class="text-right text-medium-emphasis">{{ tag.usage_count }}</td>
          <td class="text-right">
            <div class="d-inline-flex ga-1">
              <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(tag)" />
              <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(tag)" />
            </div>
          </td>
        </tr>
      </tbody>
    </v-table>

    <!-- Create / Edit Dialog -->
    <v-dialog v-model="formDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>
          {{ editing ? $t('tags.manage.editTag') : $t('tags.manage.newTag') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="form.name"
            :label="$t('tags.manage.nameLabel')"
            :hint="$t('tags.manage.nameHint')"
            persistent-hint
            variant="outlined"
            density="comfortable"
            :error-messages="nameError ? [nameError] : []"
            prefix="#"
            autofocus
            @input="onNameInput"
          />

          <div class="mt-4 mb-1 text-body-medium">{{ $t('tags.manage.colorLabel') }}</div>
          <div class="d-flex flex-wrap ga-2">
            <button
              v-for="color in palette"
              :key="color"
              type="button"
              class="color-swatch"
              :class="{ 'color-swatch--active': form.color === color }"
              :style="{ background: color }"
              @click="form.color = color"
            />
          </div>

          <div class="mt-4">
            <span class="text-body-small text-medium-emphasis">{{ $t('tags.manage.preview') }}:</span>
            <SharedTagChip :tag="previewTag" size="default" class="ml-2" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeForm">{{ $t('common.cancel') }}</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :disabled="!isFormValid"
            :loading="saving"
            @click="save"
          >
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm -->
    <v-dialog v-model="deleteDialog" max-width="420">
      <v-card>
        <v-card-title>{{ $t('tags.manage.deleteTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('tags.manage.deleteConfirm', { name: deletingTag?.name }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="elevated" :loading="deleting" @click="performDelete">
            {{ $t('common.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  TAG_COLORS,
  DEFAULT_TAG_COLOR,
  isValidTagName,
  normaliseTagName,
  type Tag,
} from '~~/types/tag'
import type { TagWithUsage } from '~~/server/api/tags/index.get'

const { t } = useI18n()
const snackbarStore = useSnackbarStore()

const tags = ref<TagWithUsage[]>([])
const loading = ref(false)
const palette = TAG_COLORS

const formDialog = ref(false)
const editing = ref<Tag | null>(null)
const form = ref<{ name: string, color: string }>({ name: '', color: DEFAULT_TAG_COLOR })
const saving = ref(false)

const deleteDialog = ref(false)
const deletingTag = ref<TagWithUsage | null>(null)
const deleting = ref(false)

const nameError = computed(() => {
  const normalised = normaliseTagName(form.value.name)
  if (!normalised) return null
  if (!isValidTagName(normalised)) return t('tags.manage.nameInvalid')
  // duplicate check (ignore self when editing)
  const dup = tags.value.find(t => t.name === normalised && t.id !== editing.value?.id)
  if (dup) return t('tags.manage.nameDuplicate')
  return null
})

const isFormValid = computed(() => {
  const normalised = normaliseTagName(form.value.name)
  return !!normalised && !nameError.value
})

const previewTag = computed<Tag>(() => ({
  id: -1,
  name: normaliseTagName(form.value.name) || 'tag',
  color: form.value.color,
}))

function onNameInput() {
  // Live normalise so the user sees what will be saved
  form.value.name = normaliseTagName(form.value.name)
}

async function load() {
  loading.value = true
  try {
    tags.value = await $fetch<TagWithUsage[]>('/api/tags')
  }
  finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', color: DEFAULT_TAG_COLOR }
  formDialog.value = true
}

function openEdit(tag: TagWithUsage) {
  editing.value = tag
  form.value = { name: tag.name, color: tag.color || DEFAULT_TAG_COLOR }
  formDialog.value = true
}

function closeForm() {
  formDialog.value = false
  editing.value = null
}

async function save() {
  saving.value = true
  try {
    const body = { name: form.value.name, color: form.value.color }
    if (editing.value) {
      await $fetch(`/api/tags/${editing.value.id}`, { method: 'PATCH', body })
      snackbarStore.success(t('tags.manage.updated'))
    }
    else {
      await $fetch('/api/tags', { method: 'POST', body })
      snackbarStore.success(t('tags.manage.created'))
    }
    closeForm()
    await load()
  }
  catch (e) {
    console.error(e)
    snackbarStore.error(t('tags.manage.saveError'))
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(tag: TagWithUsage) {
  deletingTag.value = tag
  deleteDialog.value = true
}

async function performDelete() {
  if (!deletingTag.value) return
  deleting.value = true
  try {
    await $fetch(`/api/tags/${deletingTag.value.id}`, { method: 'DELETE' })
    snackbarStore.success(t('tags.manage.deleted'))
    deleteDialog.value = false
    deletingTag.value = null
    await load()
  }
  catch (e) {
    console.error(e)
    snackbarStore.error(t('tags.manage.deleteError'))
  }
  finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.1s ease;
}
.color-swatch:hover {
  transform: scale(1.1);
}
.color-swatch--active {
  border-color: rgb(var(--v-theme-on-surface));
}
.tag-table th {
  font-weight: 600;
  text-transform: none;
}
</style>
