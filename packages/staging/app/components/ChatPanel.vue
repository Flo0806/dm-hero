<template>
  <!-- Private conversation with the DM - only the two of you can read it -->
  <section class="flex flex-col rounded-xl border border-line bg-surface/85" :aria-label="$t('play.chat.title')">
    <div ref="logRef" role="log" class="h-[55dvh] overflow-y-auto p-4 flex flex-col gap-2">
      <p v-if="!all.length" class="m-auto text-center text-muted">
        {{ $t('play.chat.empty') }}
      </p>
      <div v-for="message in all" :key="message.id" class="flex" :class="message.from === 'player' ? 'justify-end' : 'justify-start'">
        <div
          class="max-w-[80%] px-3 py-2 rounded-xl whitespace-pre-wrap break-words"
          :class="message.from === 'player' ? 'bg-primary/20' : 'bg-white/6'"
        >
          <span class="sr-only">{{ message.from === 'player' ? $t('play.chat.you') : $t('play.map.dm') }}: </span>{{ message.text }}
          <span v-if="message.pending" class="block text-xs text-muted">{{ $t('play.chat.pending') }}</span>
        </div>
      </div>
    </div>
    <form class="flex items-stretch gap-2 p-3 border-t border-line" @submit.prevent="send">
      <label class="flex-1">
        <span class="sr-only">{{ $t('play.chat.write') }}</span>
        <textarea
          v-model="draft"
          :maxlength="CHAT_TEXT_MAX"
          rows="2"
          :placeholder="$t('play.chat.write')"
          class="block w-full h-full resize-none px-3 py-2 rounded-xl border border-line bg-bg text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/25"
          @keydown.enter.exact="onEnter"
        />
      </label>
      <!-- Same height as the text field -->
      <button type="submit" class="btn-primary px-4 py-0" :disabled="!draft.trim() || sending">
        {{ $t('play.chat.send') }}
      </button>
    </form>
    <p v-if="failed" role="alert" class="m-0 px-3 pb-3 text-sm text-primary">
      {{ failed === 'rate' ? $t('play.chat.slowDown') : $t('play.chat.failed') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { CHAT_TEXT_MAX, type ChatMessage } from '@dm-hero/seal'

const props = defineProps<{ messages: ChatMessage[], pending: ChatMessage[], onSend: (text: string) => Promise<boolean> }>()

// Confirmed conversation + own messages still on their way
const all = computed(() => [...props.messages, ...props.pending.map(m => ({ ...m, pending: true }))] as Array<ChatMessage & { pending?: boolean }>)

const logRef = ref<HTMLElement>()
watch(() => all.value.length, async () => {
  await nextTick()
  logRef.value?.scrollTo({ top: logRef.value.scrollHeight })
}, { immediate: true })

const draft = ref('')
const sending = ref(false)

// Enter sends - unless it confirms an IME candidate (Chinese, Japanese ...)
function onEnter(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  send()
}
/** rate = too many in a minute (wait a moment), other = anything else */
const failed = ref<false | 'rate' | 'other'>(false)
async function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  sending.value = true
  failed.value = false
  try {
    if (await props.onSend(text)) draft.value = ''
    else failed.value = 'other'
  }
  catch (error) {
    failed.value = (error as { statusCode?: number }).statusCode === 429 ? 'rate' : 'other'
  }
  finally {
    sending.value = false
  }
}
</script>
