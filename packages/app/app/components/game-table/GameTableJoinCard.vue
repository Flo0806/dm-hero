<template>
  <v-card class="pa-6 h-100">
    <div class="d-flex align-center">
      <span class="text-overline text-medium-emphasis">{{ $t('gameTable.code') }}</span>
      <v-spacer />
      <span role="status" class="d-flex align-center ga-1 text-body-small" :class="connected ? 'text-success' : 'text-warning'">
        <v-icon :icon="connected ? 'mdi-cloud-check-outline' : 'mdi-cloud-off-outline'" size="small" />
        {{ connected ? $t('gameTable.relayConnected') : $t('gameTable.relayOffline') }}
      </span>
    </div>
    <div class="d-flex align-center ga-2 mb-4">
      <span class="game-code">{{ code }}</span>
      <v-btn
        icon="mdi-content-copy"
        variant="text"
        size="small"
        :aria-label="$t('gameTable.copyCode')"
        @click="copy(code)"
      />
    </div>

    <v-text-field
      :model-value="link"
      :label="$t('gameTable.link')"
      readonly
      variant="outlined"
      density="comfortable"
      hide-details
      class="mb-4"
    >
      <template #append-inner>
        <v-btn
          icon="mdi-content-copy"
          variant="text"
          size="small"
          :aria-label="$t('gameTable.copyLink')"
          @click="copy(link)"
        />
      </template>
    </v-text-field>

    <!-- White background: QR codes need contrast + quiet zone to scan reliably -->
    <img :src="qrSrc" :alt="$t('gameTable.qrAlt')" width="180" height="180" class="qr" />

    <div class="d-flex flex-wrap ga-2 mt-4">
      <v-btn variant="text" prepend-icon="mdi-restart" @click="emit('restart')">
        {{ $t('gameTable.restart') }}
      </v-btn>
      <v-btn variant="text" color="error" prepend-icon="mdi-stop-circle-outline" @click="emit('close')">
        {{ $t('gameTable.close') }}
      </v-btn>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { renderSVG } from 'uqr'

const props = defineProps<{ code: string, connected: boolean }>()
const emit = defineEmits<{ close: [], restart: [] }>()

const { t } = useI18n()
const snackbarStore = useSnackbarStore()
const { stagingUrl } = useRuntimeConfig().public

const link = computed(() => `${stagingUrl}/?code=${props.code}`)
const qrSrc = computed(() => `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(link.value, { border: 2 }))}`)

async function copy(value: string) {
  await navigator.clipboard.writeText(value)
  snackbarStore.success(t('gameTable.copied'))
}
</script>

<style scoped>
.game-code {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: rgb(var(--v-theme-primary));
}

.qr {
  display: block;
  padding: 8px;
  background: #fff;
  border-radius: 12px;
}
</style>
