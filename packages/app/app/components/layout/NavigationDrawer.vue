<template>
  <v-navigation-drawer
    :model-value="modelValue"
    :rail="rail"
    permanent
    @click="$emit('update:rail', false)"
    @update:model-value="$emit('update:model-value', $event)"
  >
    <!-- Fixed top: app title + active campaign -->
    <template #prepend>
      <v-list-item
        :prepend-icon="rail ? 'mdi-dice-d20' : 'mdi-dice-d20'"
        :title="rail ? '' : 'DM Hero'"
        nav
      >
        <template #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            @click.stop="$emit('update:rail', !rail)"
          />
        </template>
      </v-list-item>

      <v-divider />

      <!-- Active Campaign Display -->
      <v-list-item
        v-if="activeCampaignName && !rail"
        prepend-icon="mdi-sword-cross"
        :title="activeCampaignName || ''"
        :subtitle="$t('nav.activeCampaign')"
        class="mb-2"
        @click="router.push('/campaigns')"
      />

      <!-- No campaign yet: the only thing that makes sense is picking one -->
      <v-list-item
        v-if="!hasActiveCampaign"
        prepend-icon="mdi-sword-cross"
        :title="rail ? '' : $t('nav.chooseCampaign')"
        :subtitle="rail ? undefined : $t('nav.chooseCampaignHint')"
        class="mb-2"
        color="primary"
        active
        @click="router.push('/campaigns')"
      />

      <v-divider v-if="(activeCampaignName || !hasActiveCampaign) && !rail" />
    </template>

    <!-- Scrollable middle: nav items in the DM's own order (with dividers).
         "Arrange navigation" switches to the editor (sidebar only). -->
    <LayoutNavigationEditor v-if="editing && !rail" @done="editing = false" />
    <v-list v-else density="compact" nav>
      <v-list-item
        prepend-icon="mdi-view-dashboard"
        :title="$t('nav.dashboard')"
        value="home"
        to="/"
      />
      <template v-for="entry in layout" :key="entry">
        <v-divider v-if="isNavDivider(entry)" class="my-1" />
        <v-list-item
          v-else
          :prepend-icon="NAV_ITEMS[entry].icon(music)"
          :title="$t(NAV_ITEMS[entry].title)"
          :value="entry"
          :disabled="NAV_ITEMS[entry].needsCampaign && !hasActiveCampaign"
          :to="NAV_ITEMS[entry].to"
          :active="entry === 'search' ? isSearchActive : undefined"
          :class="{ 'encounter-active': entry === 'encounters' && hasCombatActive, 'music-active': entry === 'music' && music.isPlaying.value }"
          @click="entry === 'search' && $emit('search-click')"
        >
          <!-- Mini transport while a track is loaded (not in rail mode – no room) -->
          <template v-if="entry === 'music' && music.currentTrack.value && !rail" #append>
            <div class="d-flex align-center music-nav-controls">
              <v-btn icon size="x-small" variant="text" :title="$t('music.previous')" @click.stop.prevent="music.prev()">
                <v-icon icon="mdi-skip-previous" size="small" />
              </v-btn>
              <v-btn icon size="x-small" variant="text" :title="music.isPlaying.value ? $t('music.pause') : $t('music.play')" @click.stop.prevent="music.togglePlay()">
                <v-icon :icon="music.isPlaying.value ? 'mdi-pause' : 'mdi-play'" size="small" />
              </v-btn>
              <v-btn icon size="x-small" variant="text" :title="$t('music.next')" @click.stop.prevent="music.next()">
                <v-icon icon="mdi-skip-next" size="small" />
              </v-btn>
            </div>
          </template>
          <template v-else-if="entry === 'notes' && notesStore.pendingCount > 0" #append>
            <v-badge :content="notesStore.pendingCount" color="primary" inline />
          </template>
          <template v-else-if="entry === 'gameTable' && isNew('gameTable')" #append>
            <v-chip size="x-small" color="primary" variant="flat">
              {{ $t('common.new') }}
            </v-chip>
          </template>
        </v-list-item>
      </template>
    </v-list>

    <template #append>
      <!-- Update Banner -->
      <LayoutUpdateBanner :rail="rail" />

      <v-divider />
      <v-list density="compact" nav>
        <v-list-item
          v-if="!rail && !editing"
          prepend-icon="mdi-format-list-bulleted-square"
          :title="$t('nav.arrange.button')"
          @click.stop="startEditing"
        />
        <v-list-item
          prepend-icon="mdi-database"
          :title="rail ? '' : $t('nav.referenceData')"
          to="/reference-data"
        />
        <v-list-item
          prepend-icon="mdi-cog"
          :title="rail ? '' : $t('nav.settings')"
          to="/settings"
        />
        <LayoutThemeSwitcher :rail="rail" />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { isNavDivider } from '~~/types/navigation'

const router = useRouter()
const { isNew } = useNewBadges()
const { layout, ready, load: loadLayout, retry: retryLayout } = useNavigationLayout()
// During the page load (also server-side): the sidebar starts in the saved order
await loadLayout()

// The editor only starts from the saved order - never from defaults that would overwrite it
const editing = ref(false)
const snackbarStore = useSnackbarStore()
const { t } = useI18n()
async function startEditing() {
  if (!ready.value) await retryLayout()
  if (ready.value) editing.value = true
  else snackbarStore.error(t('nav.arrange.loadFailed'))
}
const notesStore = useNotesStore()
const music = useMusicPlayer()
const encounterStore = useEncounterStore()

const hasCombatActive = computed(() =>
  encounterStore.encounters.some(e => e.status === 'active'),
)

interface Props {
  modelValue: boolean
  rail: boolean
  hasActiveCampaign: boolean
  activeCampaignName?: string | null
  isSearchActive: boolean
}

const props = defineProps<Props>()

// Collapsed to the rail: no room for the editor
watch(() => props.rail, (rail) => {
  if (rail) editing.value = false
})

defineEmits<{
  'update:model-value': [value: boolean]
  'update:rail': [value: boolean]
  'search-click': []
}>()
</script>

<style scoped>
.encounter-active {
  color: rgb(var(--v-theme-error)) !important;
}
.encounter-active :deep(.v-icon) {
  color: rgb(var(--v-theme-error)) !important;
}
.music-active :deep(.v-list-item__prepend .v-icon) {
  color: rgb(var(--v-theme-primary));
}
.music-nav-controls {
  margin-right: -8px;
}
</style>
