<template>
  <!-- Arrange the sidebar: drag by the handle (or use the arrows), add/remove dividers.
       Only the sidebar changes - the dashboard always stays on top. -->
  <div class="nav-editor" role="region" :aria-label="$t('nav.arrange.title')">
    <p class="text-caption text-medium-emphasis px-3 pt-2 mb-1">
      {{ $t('nav.arrange.hint') }}
    </p>

    <TheFreeform v-model="items" class="nav-editor__list">
      <!-- What hangs at the cursor while dragging: icon + translated name -->
      <template #drag-ghost="{ items: dragged }">
        <div class="nav-editor__ghost">
          <template v-if="dragged[0] && isNavDivider(dragged[0].id)">
            <v-icon icon="mdi-minus" size="small" class="me-2" />{{ $t('nav.arrange.divider') }}
          </template>
          <template v-else-if="dragged[0]">
            <v-icon :icon="NAV_ITEMS[dragged[0].id as NavKey].icon(music)" size="small" class="me-2" />{{ $t(NAV_ITEMS[dragged[0].id as NavKey].title) }}
          </template>
        </div>
      </template>

      <FreeformItem v-for="(item, index) in items" :key="item.id" :item="item">
        <template #default>
          <div class="nav-editor__row">
            <v-icon data-freeform-handle icon="mdi-drag-vertical" size="small" class="nav-editor__handle" :aria-hidden="true" />
            <template v-if="isNavDivider(item.id)">
              <v-divider class="flex-grow-1 mx-1" />
              <span class="text-caption text-medium-emphasis me-1">{{ $t('nav.arrange.divider') }}</span>
            </template>
            <template v-else>
              <v-icon :icon="NAV_ITEMS[item.id as NavKey].icon(music)" size="small" class="me-2" />
              <span class="text-body-medium flex-grow-1 text-truncate">{{ $t(NAV_ITEMS[item.id as NavKey].title) }}</span>
            </template>
            <v-btn
              icon="mdi-chevron-up"
              size="x-small"
              variant="text"
              density="comfortable"
              :disabled="index === 0"
              :aria-label="$t('nav.arrange.up', { name: label(item.id) })"
              @click="move(index, -1)"
            />
            <v-btn
              icon="mdi-chevron-down"
              size="x-small"
              variant="text"
              density="comfortable"
              :disabled="index === items.length - 1"
              :aria-label="$t('nav.arrange.down', { name: label(item.id) })"
              @click="move(index, 1)"
            />
            <v-btn
              v-if="isNavDivider(item.id)"
              icon="mdi-close"
              size="x-small"
              variant="text"
              density="comfortable"
              color="error"
              :aria-label="$t('nav.arrange.removeDivider')"
              @click="removeDivider(item.id)"
            />
          </div>
        </template>
      </FreeformItem>
      <FreeformPlaceholder />
    </TheFreeform>

    <div class="d-flex flex-wrap ga-1 px-2 py-2">
      <v-btn size="small" variant="tonal" prepend-icon="mdi-minus" :disabled="dividerCount >= MAX_NAV_DIVIDERS" @click="addDivider">
        {{ $t('nav.arrange.addDivider') }}
      </v-btn>
      <v-btn size="small" variant="text" prepend-icon="mdi-restore" @click="resetLayout">
        {{ $t('nav.arrange.reset') }}
      </v-btn>
    </div>
    <div class="d-flex ga-1 px-2 pb-2">
      <v-btn size="small" variant="text" @click="emit('done')">
        {{ $t('common.cancel') }}
      </v-btn>
      <v-spacer />
      <v-btn size="small" color="primary" variant="flat" :loading="saving" @click="saveLayout">
        {{ $t('nav.arrange.done') }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isNavDivider, MAX_NAV_DIVIDERS, normalizeNavLayout, type NavKey, type NavLayoutEntry } from '~~/types/navigation'

const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const music = useMusicPlayer()
const snackbarStore = useSnackbarStore()
const { layout, save } = useNavigationLayout()

// Working copy - only "Done" saves it
const items = ref(layout.value.map(id => ({ id: id as string })))
const dividerCount = computed(() => items.value.filter(i => isNavDivider(i.id)).length)

const label = (id: string) => (isNavDivider(id) ? t('nav.arrange.divider') : t(NAV_ITEMS[id as NavKey].title))

function move(index: number, direction: -1 | 1) {
  const next = [...items.value]
  const [entry] = next.splice(index, 1)
  next.splice(index + direction, 0, entry!)
  items.value = next
}

// No crypto.randomUUID: it only exists on HTTPS/localhost, the web app may run on plain HTTP
function addDivider() {
  items.value = [...items.value, { id: `divider:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]
}

function removeDivider(id: string) {
  items.value = items.value.filter(i => i.id !== id)
}

const saving = ref(false)
async function saveLayout() {
  saving.value = true
  try {
    await save(items.value.map(i => i.id as NavLayoutEntry))
    emit('done')
  }
  catch {
    snackbarStore.error(t('nav.arrange.saveFailed'))
  }
  finally {
    saving.value = false
  }
}

// Only a preview - like every change it's saved with "Done" (Cancel keeps the old order)
function resetLayout() {
  items.value = normalizeNavLayout([]).map(id => ({ id: id as string }))
}
</script>

<style scoped>
.nav-editor__list {
  display: flex;
  flex-direction: column;
  padding: 0 4px;
}

.nav-editor__row {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 0 4px;
  border-radius: 6px;
}

.nav-editor__row:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

/* nuxt-freeform sizes items to their content - rows take the full width here */
.nav-editor__list :deep(.freeform-item) {
  align-self: stretch;
}

.nav-editor__ghost {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  font-size: 0.875rem;
}

.nav-editor__handle {
  cursor: grab;
  margin-right: 4px;
  opacity: 0.6;
}
</style>
