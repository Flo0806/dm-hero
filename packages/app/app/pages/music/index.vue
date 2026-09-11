<template>
  <v-container class="music-page">
    <UiPageHeader :title="$t('music.title')" :subtitle="hasLibrary ? config?.folder ?? '' : $t('music.subtitle')">
      <template #actions>
        <v-btn
          v-if="hasLibrary"
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="scanning"
          @click="loadLibrary"
        >
          {{ $t('music.rescan') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-folder-open"
          class="ml-2"
          @click="showFolderDialog = true"
        >
          {{ hasLibrary ? $t('music.changeFolder') : $t('music.chooseFolder') }}
        </v-btn>
      </template>
    </UiPageHeader>

    <v-alert v-if="error" type="warning" variant="tonal" closable class="mb-4" @click:close="error = null">
      {{ error }}
    </v-alert>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="text-body-medium text-medium-emphasis mt-4">{{ $t('music.scanning') }}</div>
    </div>

    <!-- Library -->
    <template v-else-if="hasLibrary && library">
      <!-- Toolbar -->
      <v-card variant="outlined" class="mb-4">
        <v-card-text class="d-flex flex-wrap align-center ga-3">
          <v-text-field
            v-model="query"
            :placeholder="$t('music.search')"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="max-width: 280px; min-width: 200px"
          />

          <div v-if="scenes.length" class="d-flex flex-wrap ga-2 flex-grow-1">
            <v-chip
              v-for="s in scenes"
              :key="s.path"
              color="warning"
              variant="tonal"
              prepend-icon="mdi-star"
              :title="$t('music.scenes.play', { name: s.name })"
              @click="playFolder(s, random)"
            >
              {{ s.name }}
            </v-chip>
          </div>
          <div v-else class="text-body-small text-medium-emphasis flex-grow-1">
            {{ $t('music.scenes.hint') }}
          </div>

          <div class="d-flex align-center ga-2 flex-wrap">
            <v-btn
              variant="tonal"
              size="small"
              :color="random ? 'primary' : undefined"
              prepend-icon="mdi-shuffle-variant"
              @click="toggleRandom"
            >
              {{ random ? $t('music.shuffle') : $t('music.inOrder') }}
            </v-btn>
            <v-btn
              variant="tonal"
              size="small"
              :color="loopMode !== 'all' ? 'primary' : undefined"
              :prepend-icon="loopMode === 'one' ? 'mdi-repeat-once' : loopMode === 'folder' ? 'mdi-folder-sync' : 'mdi-repeat'"
              :title="$t(`music.loopHint.${loopMode}`)"
              @click="cycleLoop"
            >
              {{ $t(`music.loop.${loopMode}`) }}
            </v-btn>
            <v-btn
              variant="tonal"
              size="small"
              :color="crossfadeEnabled ? 'primary' : undefined"
              prepend-icon="mdi-swap-horizontal"
              :title="$t('music.crossfadeHint')"
              @click="setCrossfade(!crossfadeEnabled)"
            >
              {{ $t('music.crossfade') }}
            </v-btn>
            <div v-if="crossfadeEnabled" class="d-flex align-center ga-2" style="width: 140px">
              <v-slider
                :model-value="crossfadeSec"
                :min="1"
                :max="12"
                :step="1"
                hide-details
                density="compact"
                color="primary"
                @update:model-value="setCrossfadeSec"
              />
              <span class="text-body-small text-medium-emphasis" style="min-width: 24px">{{ crossfadeSec }}s</span>
            </div>
            <v-btn icon size="small" variant="text" :title="$t('music.collapseAll')" @click="collapseAll">
              <v-icon icon="mdi-collapse-all" />
            </v-btn>
            <v-btn icon size="small" variant="text" :title="$t('music.expandAll')" @click="expandAll">
              <v-icon icon="mdi-expand-all" />
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <!-- Tree -->
      <v-card variant="outlined">
        <v-card-text>
          <div v-if="library.root.trackCount === 0" class="text-center text-medium-emphasis py-8">
            {{ $t('music.emptyFolder') }}
          </div>
          <template v-else>
            <MusicFolderNode
              v-for="child in filteredChildren"
              :key="child.path"
              :folder="child"
              :depth="0"
            />
            <div
              v-for="track in filteredRootTracks"
              :key="track.id"
              class="music-root-track d-flex align-center rounded px-3 py-2"
              :class="{ 'text-primary font-weight-medium': currentTrack?.id === track.id }"
              role="button"
              tabindex="0"
              @click="playTrack(track)"
              @keydown.enter="playTrack(track)"
            >
              <v-icon icon="mdi-music-note" size="small" class="mr-2" />
              <span class="text-body-medium">{{ track.name }}</span>
            </div>
            <div v-if="noResults" class="text-center text-medium-emphasis py-8">
              {{ $t('music.noResults', { query }) }}
            </div>
          </template>
        </v-card-text>
      </v-card>

      <!-- Keyboard shortcuts (handled globally in MusicPlayerBar) -->
      <div class="d-flex flex-wrap align-center ga-x-6 ga-y-2 mt-3 text-body-small text-medium-emphasis">
        <div v-for="sc in shortcuts" :key="sc.keys" class="d-flex align-center ga-2">
          <v-hotkey :keys="sc.keys" :platform="platform" />
          <span>{{ sc.label }}</span>
        </div>
      </div>
    </template>

    <!-- Empty state: no folder configured -->
    <v-card v-else variant="outlined" class="text-center pa-10">
      <v-icon icon="mdi-music-box-multiple" size="72" color="primary" class="mb-4" />
      <div class="text-headline-small mb-2">{{ $t('music.empty.title') }}</div>
      <div class="text-body-medium text-medium-emphasis mb-6" style="max-width: 520px; margin: 0 auto">
        {{ $t('music.empty.text') }}
      </div>
      <v-btn color="primary" size="large" prepend-icon="mdi-folder-open" @click="showFolderDialog = true">
        {{ $t('music.chooseFolder') }}
      </v-btn>
    </v-card>

    <!-- Folder dialog -->
    <v-dialog v-model="showFolderDialog" max-width="560">
      <v-card>
        <v-card-title>{{ $t('music.folderDialog.title') }}</v-card-title>
        <v-card-text>
          <div class="text-body-medium text-medium-emphasis mb-4">
            {{ isElectron ? $t('music.folderDialog.hintElectron') : $t('music.folderDialog.hintWeb') }}
          </div>
          <div class="d-flex ga-2 align-start">
            <v-text-field
              v-model="folderInput"
              :label="$t('music.folderDialog.path')"
              :placeholder="isElectron ? 'C:\\Music\\D&D' : '/music'"
              variant="outlined"
              density="compact"
              hide-details="auto"
              :error-messages="folderError"
              class="flex-grow-1"
              @keyup.enter="saveFolder"
            />
            <v-btn v-if="isElectron" variant="tonal" height="40" prepend-icon="mdi-folder-search" @click="pickFolder">
              {{ $t('music.folderDialog.browse') }}
            </v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="config?.folder" variant="text" color="error" @click="clearFolder">{{ $t('music.folderDialog.remove') }}</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="showFolderDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="savingFolder" :disabled="!folderInput.trim()" @click="saveFolder">
            {{ $t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { musicFolderMatches } from '~/composables/useMusicPlayer'

const {
  config, library, loading, scanning, error, hasLibrary, query, random, loopMode, crossfadeEnabled, crossfadeSec, scenes, currentTrack,
  init, loadLibrary, setFolder, playTrack, playFolder, toggleRandom, cycleLoop, setCrossfade, setCrossfadeSec, collapseAll, expandAll,
} = useMusicPlayer()
const { isElectron, selectFolder } = useElectron()
const snackbarStore = useSnackbarStore()

// Shortcut legend – the handlers live in MusicPlayerBar (global)
const platform = computed<'mac' | 'pc'>(() =>
  import.meta.client && navigator.userAgent.toLowerCase().includes('mac') ? 'mac' : 'pc',
)
const shortcuts = computed(() => [
  { keys: 'space', label: $t('music.playPause') },
  { keys: 'left', label: $t('music.back10') },
  { keys: 'right', label: $t('music.forward10') },
  { keys: 'shift+left', label: $t('music.previous') },
  { keys: 'shift+right', label: $t('music.next') },
  { keys: 'up', label: $t('music.volumeUp') },
  { keys: 'down', label: $t('music.volumeDown') },
  { keys: 'r', label: $t('music.shuffle') },
  { keys: 'l', label: $t('music.loopMode') },
])

const showFolderDialog = ref(false)
const folderInput = ref('')
const folderError = ref('')
const savingFolder = ref(false)

watch(showFolderDialog, (open) => {
  if (open) {
    folderInput.value = config.value?.folder ?? ''
    folderError.value = ''
  }
})

async function pickFolder() {
  const picked = await selectFolder({ title: $t('music.folderDialog.title'), defaultPath: folderInput.value || undefined })
  if (picked) folderInput.value = picked
}

async function saveFolder() {
  if (!folderInput.value.trim()) return
  savingFolder.value = true
  folderError.value = ''
  try {
    await setFolder(folderInput.value.trim())
    showFolderDialog.value = false
    snackbarStore.success($t('music.folderDialog.saved'))
  }
  catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    folderError.value = status === 400 ? $t('music.folderDialog.notFound') : $t('common.error')
  }
  finally {
    savingFolder.value = false
  }
}

async function clearFolder() {
  savingFolder.value = true
  try {
    await setFolder(null)
    showFolderDialog.value = false
  }
  finally {
    savingFolder.value = false
  }
}

// Search
const q = computed(() => query.value.trim().toLowerCase())
const filteredChildren = computed(() => {
  const r = library.value?.root
  if (!r) return []
  return q.value ? r.children.filter(c => musicFolderMatches(c, q.value)) : r.children
})
const filteredRootTracks = computed(() => {
  const r = library.value?.root
  if (!r) return []
  return q.value ? r.tracks.filter(t => t.name.toLowerCase().includes(q.value)) : r.tracks
})
const noResults = computed(() => !!q.value && !filteredChildren.value.length && !filteredRootTracks.value.length)

onMounted(() => {
  init()
})
</script>

<style scoped>
.music-root-track {
  cursor: pointer;
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.music-root-track:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
</style>
