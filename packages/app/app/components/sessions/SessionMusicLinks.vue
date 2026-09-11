<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex align-center">
      <v-icon icon="mdi-music" class="mr-2" />
      {{ $t('sessions.music.title') }}
    </v-card-title>
    <v-card-text>
      <div class="text-body-medium text-medium-emphasis mb-4">
        {{ $t('sessions.music.hint') }}
      </div>

      <div v-if="loading" class="text-center py-4">
        <v-progress-circular indeterminate />
      </div>

      <template v-else>
        <!-- Existing links -->
        <v-list v-if="links.length > 0" density="compact" class="mb-4">
          <v-list-item
            v-for="(link, index) in links"
            :key="index"
            :title="link.label"
            :subtitle="link.url"
            rounded
            @click="open(link)"
          >
            <template #prepend>
              <v-icon :icon="musicLinkIcon(link.url).icon" :color="musicLinkIcon(link.url).color" />
            </template>
            <template #append>
              <v-btn
                icon="mdi-open-in-new"
                variant="text"
                size="small"
                :title="$t('sessions.music.open')"
                @click.stop="open(link)"
              />
              <v-btn
                icon="mdi-delete"
                variant="text"
                size="small"
                color="error"
                :title="$t('common.delete')"
                @click.stop="remove(index)"
              />
            </template>
          </v-list-item>
        </v-list>
        <div v-else class="text-body-medium text-disabled mb-4">
          {{ $t('sessions.music.empty') }}
        </div>

        <!-- Add link -->
        <v-row dense align="center">
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="newLabel"
              :label="$t('sessions.music.label')"
              :placeholder="$t('sessions.music.labelPlaceholder')"
              variant="outlined"
              density="compact"
              hide-details
              @keyup.enter="add"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="newUrl"
              :label="$t('sessions.music.url')"
              placeholder="https://"
              variant="outlined"
              density="compact"
              hide-details="auto"
              :error-messages="urlError"
              @keyup.enter="add"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-btn
              color="primary"
              variant="tonal"
              block
              prepend-icon="mdi-plus"
              :disabled="!canAdd"
              :loading="saving"
              @click="add"
            >
              {{ $t('common.add') }}
            </v-btn>
          </v-col>
        </v-row>
      </template>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { musicLinkIcon, isValidMusicUrl, type SessionMusicLink } from '~~/types/session-music'

const props = defineProps<{ sessionId: number }>()
const emit = defineEmits<{ updated: [SessionMusicLink[]] }>()

const snackbarStore = useSnackbarStore()
const { openExternalUrl } = useElectron()

const links = ref<SessionMusicLink[]>([])
const loading = ref(false)
const saving = ref(false)
const newLabel = ref('')
const newUrl = ref('')

const urlError = computed(() => (newUrl.value && !isValidMusicUrl(newUrl.value.trim()) ? $t('sessions.music.invalidUrl') : ''))
const canAdd = computed(() => !!newLabel.value.trim() && isValidMusicUrl(newUrl.value.trim()))

async function load() {
  loading.value = true
  try {
    links.value = await $fetch<SessionMusicLink[]>(`/api/sessions/${props.sessionId}/music-links`)
  }
  catch (error) {
    console.error('Failed to load music links:', error)
  }
  finally {
    loading.value = false
  }
}

async function save(next: SessionMusicLink[]) {
  saving.value = true
  try {
    links.value = await $fetch<SessionMusicLink[]>(`/api/sessions/${props.sessionId}/music-links`, {
      method: 'PUT',
      body: { links: next },
    })
    emit('updated', links.value)
  }
  catch (error) {
    console.error('Failed to save music links:', error)
    snackbarStore.error($t('common.error'))
  }
  finally {
    saving.value = false
  }
}

async function add() {
  if (!canAdd.value) return
  await save([...links.value, { label: newLabel.value.trim(), url: newUrl.value.trim() }])
  newLabel.value = ''
  newUrl.value = ''
}

function remove(index: number) {
  save(links.value.filter((_, i) => i !== index))
}

function open(link: SessionMusicLink) {
  openExternalUrl(link.url)
}

watch(() => props.sessionId, load, { immediate: true })
</script>
