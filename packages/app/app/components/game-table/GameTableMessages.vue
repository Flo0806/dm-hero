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
        <div ref="scrollRef" class="messages-thread pa-4" role="log" :aria-label="$t('gameTable.messages.conversation', { name: selected?.name ?? '' })">
          <p v-if="!thread.length" class="text-medium-emphasis text-center my-8">
            {{ $t('gameTable.messages.empty') }}
          </p>
          <div v-for="message in thread" :key="message.id" class="d-flex mb-2" :class="message.sender === 'dm' ? 'justify-end' : 'justify-start'">
            <div class="message-bubble" :class="message.sender === 'dm' ? 'message-bubble--dm' : 'message-bubble--player'">
              <div class="message-text">{{ message.text }}</div>
              <div class="text-caption text-medium-emphasis">{{ formatTime(message.created_at) }}</div>
            </div>
          </div>
        </div>
        <v-divider />
        <div class="d-flex align-end ga-2 pa-3">
          <v-textarea
            v-model="draft"
            :label="$t('gameTable.messages.write', { name: selected?.name ?? '' })"
            :counter="CHAT_TEXT_MAX"
            :maxlength="CHAT_TEXT_MAX"
            rows="1"
            auto-grow
            max-rows="5"
            hide-details="auto"
            variant="outlined"
            @keydown.enter.exact.prevent="send"
          />
          <v-btn icon="mdi-send" color="primary" :loading="sending" :disabled="!draft.trim()" :aria-label="$t('gameTable.messages.send')" @click="send" />
        </div>
      </v-col>
    </v-row>
  </v-card>
</template>

<script setup lang="ts">
import { CHAT_TEXT_MAX } from '@dm-hero/seal'

const { t, locale } = useI18n()
const store = useGameTableStore()
const snackbarStore = useSnackbarStore()

const players = computed(() => store.table?.players ?? [])
const selectedId = ref<number | null>(null)
const selected = computed(() => players.value.find(p => p.id === selectedId.value) ?? null)
const thread = computed(() => store.messages.filter(m => m.player_id === selectedId.value))

// Start with the player who wrote most recently (unread first), else the first one
watch(players, (list) => {
  if (selectedId.value && list.some(p => p.id === selectedId.value)) return
  const unread = list.find(p => store.unreadOf(p.id))
  selectedId.value = (unread ?? list[0])?.id ?? null
}, { immediate: true })

// Looking at a conversation reads it; new messages scroll into view
const scrollRef = ref<HTMLElement>()
watch([selectedId, () => thread.value.length], async () => {
  if (selectedId.value) store.markRead(selectedId.value).catch(() => {})
  await nextTick()
  scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight })
}, { immediate: true })

const formatTime = (value: string) => new Date(`${value.replace(' ', 'T')}${value.includes('Z') ? '' : 'Z'}`)
  .toLocaleString(locale.value, { dateStyle: 'short', timeStyle: 'short' })

const draft = ref('')
const sending = ref(false)
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
