<template>
  <v-card
    hover
    tabindex="0"
    role="button"
    :aria-label="folder.name"
    class="d-flex flex-column h-100"
    :class="{ 'folder-card-flash': isFlashing }"
    style="cursor: pointer"
    @click="$emit('open', folder)"
    @mouseenter="onHover"
    @focus="onHover"
    @keydown.enter.prevent="$emit('open', folder)"
    @keydown.space.prevent="$emit('open', folder)"
  >
    <div class="d-flex align-center pa-4 ga-3 flex-grow-1">
      <div class="folder-icon-wrap flex-shrink-0">
        <v-icon
          :icon="folder.icon || 'mdi-folder'"
          :color="folder.color || 'primary'"
          size="56"
        />
        <!-- easter-egg overlay -->
        <span
          v-if="playing"
          :class="['folder-egg', `folder-egg-${egg}`]"
          aria-hidden="true"
        >
          {{ EGG_EMOJI[egg] }}
        </span>
      </div>

      <div class="flex-grow-1" style="min-width: 0">
        <h3
          class="text-headline-small mb-1 text-truncate"
          style="line-height: 1.2"
          :title="folder.name"
        >
          {{ folder.name }}
        </h3>
        <div class="text-body-small text-medium-emphasis text-truncate">
          {{ $t('folders.entityCount', folder.entity_count) }}
        </div>
      </div>

      <v-menu location="bottom end">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="mdi-dots-vertical"
            variant="text"
            size="small"
            @click.stop
          />
        </template>
        <v-list density="compact">
          <v-list-item
            prepend-icon="mdi-pencil"
            :title="$t('common.edit')"
            @click="$emit('edit', folder)"
          />
          <v-list-item
            prepend-icon="mdi-delete"
            :title="$t('common.delete')"
            class="text-error"
            @click="$emit('delete', folder)"
          />
        </v-list>
      </v-menu>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import type { EntityFolderWithCount, FolderEasterEgg } from '~~/types/folder'
import { useFolderAnimation } from '~/composables/useFolderAnimations'
import { useFoldersStore } from '~/stores/folders'

const props = defineProps<{ folder: EntityFolderWithCount }>()
defineEmits<{
  open: [folder: EntityFolderWithCount]
  edit: [folder: EntityFolderWithCount]
  delete: [folder: EntityFolderWithCount]
}>()

const { egg, playing, onHover } = useFolderAnimation(
  props.folder.id,
  props.folder.easter_egg,
)

const foldersStore = useFoldersStore()
const isFlashing = computed(() => foldersStore.flashedFolderId === props.folder.id)

const EGG_EMOJI: Record<FolderEasterEgg, string> = {
  kobold: '👺',
  snake: '🐍',
  spaceship: '🚀',
  fly: '🪰',
  eye: '👁️',
  candle: '🕯️',
  dragon: '🐉',
  bones: '🦴',
}
</script>

<style scoped>
/* only what Vuetify utilities can't do: positioning anchor for the egg
   overlay and the keyframes themselves. v-card[hover] provides elevation. */
.folder-icon-wrap {
  position: relative;
  width: 56px;
  height: 56px;
}

.folder-egg {
  position: absolute;
  font-size: 24px;
  pointer-events: none;
  will-change: transform, opacity;
  /* base position: above-right of the folder icon */
  top: -8px;
  right: -8px;
}

/* keyframes — each egg has its own, tied to its name. 2.2s total. */
.folder-egg-snake { animation: egg-snake 2.2s ease-out forwards; }
.folder-egg-kobold { animation: egg-kobold 2.2s ease-in-out forwards; }
.folder-egg-spaceship { animation: egg-spaceship 2.2s linear forwards; }
.folder-egg-fly { animation: egg-fly 2.2s linear forwards; }
.folder-egg-eye { animation: egg-eye 2.2s ease-in-out forwards; }
.folder-egg-candle { animation: egg-candle 2.2s ease-in-out forwards; }
.folder-egg-dragon { animation: egg-dragon 2.2s ease-out forwards; }
.folder-egg-bones { animation: egg-bones 2.2s ease-in-out forwards; }

@keyframes egg-snake {
  0% { transform: translate(0, 20px) rotate(0deg); opacity: 0; }
  20% { transform: translate(0, 0) rotate(-12deg); opacity: 1; }
  40% { transform: translate(-6px, -6px) rotate(8deg); }
  60% { transform: translate(2px, -2px) rotate(-4deg); }
  100% { transform: translate(0, 20px) rotate(0deg); opacity: 0; }
}
@keyframes egg-kobold {
  0% { transform: translate(0, 30px) scale(0.5); opacity: 0; }
  30% { transform: translate(0, 0) scale(1); opacity: 1; }
  50% { transform: translate(-3px, -2px) rotate(-5deg); }
  70% { transform: translate(3px, -2px) rotate(5deg); }
  100% { transform: translate(0, 30px) scale(0.5); opacity: 0; }
}
@keyframes egg-spaceship {
  0% { transform: translate(-80px, 30px) rotate(20deg); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translate(60px, -40px) rotate(45deg); opacity: 0; }
}
@keyframes egg-fly {
  0% { transform: translate(-30px, -10px); opacity: 0; }
  10% { opacity: 1; }
  25% { transform: translate(10px, 10px) rotate(20deg); }
  50% { transform: translate(20px, -15px) rotate(-10deg); }
  75% { transform: translate(-10px, 20px) rotate(15deg); }
  90% { opacity: 1; }
  100% { transform: translate(40px, -30px); opacity: 0; }
}
@keyframes egg-eye {
  0% { transform: scale(0); opacity: 0; }
  20% { transform: scale(1); opacity: 1; }
  40% { transform: scaleY(0.05); }
  50% { transform: scaleY(1); }
  60% { transform: scaleY(0.05); }
  70% { transform: scaleY(1); }
  100% { transform: scale(0); opacity: 0; }
}
@keyframes egg-candle {
  0% { transform: translateY(10px) scale(0.5); opacity: 0; }
  20% { transform: translateY(0) scale(1); opacity: 1; }
  30% { transform: translateY(-2px) scale(1.05); }
  40% { transform: translateY(0) scale(0.95); }
  50% { transform: translateY(-2px) scale(1.1) rotate(-3deg); }
  60% { transform: translateY(0) scale(1) rotate(3deg); }
  100% { transform: translateY(10px) scale(0.5); opacity: 0; }
}
@keyframes egg-dragon {
  0% { transform: translate(0, 30px) scale(0.4); opacity: 0; }
  25% { transform: translate(0, 0) scale(1); opacity: 1; }
  45% { transform: translate(-2px, -4px) scale(1.1) rotate(-8deg); }
  55% { transform: translate(2px, -4px) scale(1.1) rotate(8deg); }
  100% { transform: translate(0, 30px) scale(0.4); opacity: 0; }
}
@keyframes egg-bones {
  0% { transform: rotate(0deg) translateY(20px); opacity: 0; }
  20% { transform: rotate(-15deg) translateY(0); opacity: 1; }
  40% { transform: rotate(15deg); }
  60% { transform: rotate(-10deg); }
  80% { transform: rotate(10deg); }
  100% { transform: rotate(0deg) translateY(20px); opacity: 0; }
}

/* Brief outline pulse when this folder just received an entity. Two pulses
   over ~1.2s — enough to draw the eye without being noisy. */
.folder-card-flash {
  animation: folder-card-flash 1.2s ease-in-out;
}
@keyframes folder-card-flash {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0); }
  25% { box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.5); }
  50% { box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0); }
  75% { box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.5); }
}

@media (prefers-reduced-motion: reduce) {
  .folder-egg { display: none !important; }
  .folder-card-flash { animation: none; }
}
</style>
