<template>
  <!-- A short note for the players: pulses at the spot and stays a few seconds -->
  <v-dialog :model-value="show" max-width="400" @update:model-value="emit('update:show', $event)">
    <v-card :title="$t('gameTable.map.noteTitle')">
      <v-card-text>
        <v-text-field
          v-model="text"
          :label="$t('gameTable.map.noteLabel')"
          :maxlength="PING_TEXT_MAX"
          counter
          autofocus
          @keydown.enter.prevent="send"
        />
        <p class="text-body-small text-medium-emphasis mb-0">
          {{ $t('gameTable.map.noteHint') }}
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:show', false)">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-send" :disabled="!text.trim()" @click="send">
          {{ $t('gameTable.map.noteSend') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { PING_TEXT_MAX } from '~~/types/fog'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean], 'send': [text: string] }>()
const text = ref('')

watch(() => props.show, (open) => {
  if (open) text.value = ''
})

function send() {
  const value = text.value.trim()
  if (!value) return
  emit('send', value)
  emit('update:show', false)
}
</script>
