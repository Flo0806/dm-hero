<template>
  <!-- Private messages: one conversation per player, end-to-end encrypted -->
  <v-card class="pa-0">
    <p v-if="!players.length" class="text-medium-emphasis pa-6 mb-0">
      {{ $t('gameTable.messages.noPlayers') }}
    </p>
    <v-row v-else no-gutters>
      <v-col cols="12" md="4" class="messages-players">
        <v-list density="comfortable" bg-color="transparent" :aria-label="$t('gameTable.messages.players')">
          <v-list-item
            v-for="player in players"
            :key="player.id"
            :active="player.id === selectedId"
            color="primary"
            @click="selectedId = player.id"
          >
            <v-list-item-title>{{ player.name }}</v-list-item-title>
            <template #append>
              <v-badge v-if="store.unreadOf(player.id)" :content="store.unreadOf(player.id)" color="primary" inline />
            </template>
          </v-list-item>
        </v-list>
      </v-col>

      <v-col cols="12" md="8" class="d-flex flex-column">
        <div class="d-flex align-center px-4 pt-3">
          <span class="text-title-small">{{ selected?.name }}</span>
          <v-spacer />
          <v-btn size="small" variant="text" color="error" prepend-icon="mdi-delete-sweep-outline" :disabled="!thread.length" @click="showClear = true">
            {{ $t('gameTable.messages.clear') }}
          </v-btn>
        </div>
        <div ref="scrollRef" class="messages-thread pa-4" role="log" :aria-label="$t('gameTable.messages.conversation', { name: selected?.name ?? '' })">
          <p v-if="!thread.length" class="text-medium-emphasis text-center my-8">
            {{ $t('gameTable.messages.empty') }}
          </p>
          <div v-for="message in thread" :key="message.id" class="d-flex mb-2" :class="message.sender === 'dm' ? 'justify-end' : 'justify-start'">
            <div class="message-bubble" :class="message.sender === 'dm' ? 'message-bubble--dm' : 'message-bubble--player'">
              <div class="message-text">{{ message.text }}</div>
              <div class="d-flex align-center ga-1 text-caption text-medium-emphasis">
                {{ formatTime(message.created_at) }}
                <v-btn
                  icon="mdi-delete-outline"
                  size="x-small"
                  variant="text"
                  density="comfortable"
                  :aria-label="$t('gameTable.messages.delete')"
                  @click="remove(message.id)"
                />
              </div>
            </div>
          </div>
        </div>
        <v-divider />
        <div class="pa-3">
          <!-- Send button inside the field and the counter always shown: nothing jumps while typing -->
          <v-textarea
            v-model="draft"
            :label="$t('gameTable.messages.write', { name: selected?.name ?? '' })"
            :counter="CHAT_TEXT_MAX"
            persistent-counter
            :maxlength="CHAT_TEXT_MAX"
            rows="1"
            auto-grow
            max-rows="5"
            variant="outlined"
            @keydown.enter.exact="onEnter"
          >
            <template #append-inner>
              <v-btn
                icon="mdi-send"
                size="small"
                variant="text"
                color="primary"
                :loading="sending"
                :disabled="!draft.trim()"
                :aria-label="$t('gameTable.messages.send')"
                @click="send"
              />
            </template>
          </v-textarea>
        </div>
      </v-col>
    </v-row>

    <UiDeleteConfirmDialog
      v-model="showClear"
      :title="$t('gameTable.messages.clearTitle', { name: selected?.name ?? '' })"
      :message="$t('gameTable.messages.clearConfirm')"
      :loading="clearing"
      @confirm="clear"
      @cancel="showClear = false"
    />
  </v-card>
</template>

<script setup lang="ts">
import { CHAT_TEXT_MAX } from '@dm-hero/seal'

/** Open this player's conversation (e.g. coming from the header chip) - a new object per jump */
const props = defineProps<{ focus?: { playerId: number } | null }>()

const { t, locale } = useI18n()
const store = useGameTableStore()
const snackbarStore = useSnackbarStore()

const players = computed(() => store.table?.players ?? [])
const selectedId = ref<number | null>(null)
const selected = computed(() => players.value.find(p => p.id === selectedId.value) ?? null)
const thread = computed(() => store.messages.filter(m => m.player_id === selectedId.value))

watch(() => props.focus, (focus) => {
  if (focus && players.value.some(p => p.id === focus.playerId)) selectedId.value = focus.playerId
}, { immediate: true })

// Start with the player who wrote most recently (unread first), else the first one
watch(players, (list) => {
  if (selectedId.value && list.some(p => p.id === selectedId.value)) return
  const unread = list.find(p => store.unreadOf(p.id))
  selectedId.value = (unread ?? list[0])?.id ?? null
}, { immediate: true })

// Looking at a conversation reads it; new messages scroll into view.
// Watches the message ids, not the count - a full conversation (100) keeps its count.
const scrollRef = ref<HTMLElement>()
watch([selectedId, () => thread.value.map(m => m.id).join()], async () => {
  if (selectedId.value) store.markRead(selectedId.value).catch(() => {})
  await nextTick()
  scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight })
}, { immediate: true })

const formatTime = (value: string) => parseSqliteDate(value).toLocaleString(locale.value, { dateStyle: 'short', timeStyle: 'short' })

// Deleting is the DM's: gone here and on the player's devices (retried until it arrives)
async function remove(id: number) {
  try {
    await store.deleteMessage(id)
    snackbarStore.success(t('gameTable.messages.deleted'))
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
}

const showClear = ref(false)
const clearing = ref(false)
async function clear() {
  if (!selectedId.value) return
  clearing.value = true
  try {
    await store.clearConversation(selectedId.value)
    snackbarStore.success(t('gameTable.messages.cleared'))
    showClear.value = false
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
  finally {
    clearing.value = false
  }
}

const draft = ref('')
const sending = ref(false)

// Enter sends - unless it confirms an IME candidate (Chinese, Japanese ...)
function onEnter(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  send()
}
async function send() {
  const text = draft.value.trim()
  if (!text || !selectedId.value || sending.value) return
  sending.value = true
  try {
    await store.sendMessage(selectedId.value, text)
    draft.value = ''
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
  finally {
    sending.value = false
  }
}
</script>

<style scoped>
.messages-players {
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.messages-thread {
  height: 420px;
  overflow-y: auto;
}

.message-bubble {
  max-width: 75%;
  padding: 8px 12px;
  border-radius: 12px;
}

.message-bubble--dm {
  background: rgba(var(--v-theme-primary), 0.18);
}

.message-bubble--player {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.message-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
