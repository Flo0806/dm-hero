<template>
  <div>
    <!-- Folder row -->
    <div
      class="music-folder-row d-flex align-center rounded"
      :class="{ 'music-folder-scope': isScope }"
      :style="{ paddingLeft: `${depth * 20 + 8}px` }"
    >
      <!-- The toggle is a real button so the action buttons next to it aren't nested inside a role=button -->
      <button
        type="button"
        class="music-folder-toggle d-flex align-center flex-grow-1"
        :aria-expanded="isOpen"
        @click="toggleExpand(folder.path)"
      >
        <v-icon :icon="isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="small" class="mr-1 text-medium-emphasis" />
        <v-icon :icon="isOpen ? 'mdi-folder-open' : 'mdi-folder'" size="small" color="primary" class="mr-2" />
        <span class="text-body-medium font-weight-medium text-truncate">{{ folder.name }}</span>
      </button>

      <div v-if="folder.trackCount" class="music-folder-actions d-flex align-center">
        <v-btn
          icon
          size="x-small"
          variant="text"
          :color="scene ? 'warning' : undefined"
          :title="scene ? $t('music.scenes.remove') : $t('music.scenes.add')"
          @click.stop="toggleScene(folder)"
        >
          <v-icon :icon="scene ? 'mdi-star' : 'mdi-star-outline'" size="small" />
        </v-btn>
        <v-btn icon size="x-small" variant="text" :title="$t('music.playFolder')" @click.stop="playFolder(folder, false)">
          <v-icon icon="mdi-play" size="small" />
        </v-btn>
        <v-btn icon size="x-small" variant="text" :title="$t('music.shuffleFolder')" @click.stop="playFolder(folder, true)">
          <v-icon icon="mdi-shuffle-variant" size="small" />
        </v-btn>
      </div>
      <v-chip size="x-small" variant="tonal" class="ml-2">{{ folder.trackCount }}</v-chip>
    </div>

    <div v-show="isOpen">
      <MusicFolderNode
        v-for="child in visibleChildren"
        :key="child.path"
        :folder="child"
        :depth="depth + 1"
      />

      <div
        v-for="track in visibleTracks"
        :key="track.id"
        class="music-track-row d-flex align-center rounded"
        :class="{ 'music-track-active': currentTrack?.id === track.id, 'music-track-missing': missingTracks.has(track.id) }"
        :style="{ paddingLeft: `${(depth + 1) * 20 + 12}px` }"
        role="button"
        tabindex="0"
        @click="playTrack(track)"
        @keydown.enter.prevent="playTrack(track)"
        @keydown.space.prevent="playTrack(track)"
      >
        <v-icon
          :icon="missingTracks.has(track.id) ? 'mdi-file-remove-outline' : currentTrack?.id === track.id && isPlaying ? 'mdi-volume-high' : 'mdi-music-note'"
          size="small"
          class="mr-2"
        />
        <span class="text-body-medium text-truncate">{{ track.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MusicFolder } from '~~/types/music'
import { musicFolderMatches } from '~/composables/useMusicPlayer'

const props = defineProps<{ folder: MusicFolder, depth: number }>()

const { expanded, currentTrack, isPlaying, scopeFolder, query, missingTracks, toggleExpand, playTrack, playFolder, toggleScene, isScene } = useMusicPlayer()

const q = computed(() => query.value.trim().toLowerCase())
const nameMatch = computed(() => !!q.value && props.folder.name.toLowerCase().includes(q.value))
// While searching, force-open so matches are visible
const isOpen = computed(() => (q.value ? true : expanded.has(props.folder.path)))
const isScope = computed(() => scopeFolder.value?.path === props.folder.path)
const scene = computed(() => isScene(props.folder.path))

const visibleChildren = computed(() =>
  !q.value || nameMatch.value ? props.folder.children : props.folder.children.filter(c => musicFolderMatches(c, q.value)),
)
const visibleTracks = computed(() =>
  !q.value || nameMatch.value ? props.folder.tracks : props.folder.tracks.filter(t => t.name.toLowerCase().includes(q.value)),
)
</script>

<style scoped>
.music-folder-row,
.music-track-row {
  padding-top: 6px;
  padding-bottom: 6px;
  padding-right: 8px;
  cursor: pointer;
  user-select: none;
  min-width: 0;
}
.music-folder-toggle {
  min-width: 0;
  padding: 0;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.music-folder-toggle:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
.music-folder-row:hover,
.music-track-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.music-folder-scope {
  background: rgba(var(--v-theme-primary), 0.08);
}
.music-folder-actions {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.music-folder-row:hover .music-folder-actions,
.music-folder-row:focus-within .music-folder-actions {
  opacity: 1;
}
.music-track-row {
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.music-track-active {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}
.music-track-missing {
  opacity: 0.45;
  text-decoration: line-through;
}
</style>
