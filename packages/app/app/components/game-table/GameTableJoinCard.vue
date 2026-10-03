<template>
  <v-card class="pa-6 h-100">
    <div class="text-overline text-medium-emphasis">
      {{ $t('gameTable.code') }}
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

    <v-btn
      variant="text"
      color="error"
      prepend-icon="mdi-stop-circle-outline"
      class="mt-4"
      @click="emit('close')"
    >
      {{ $t('gameTable.close') }}
    </v-btn>
  </v-card>
</template>

<script setup lang="ts">
import { renderSVG } from 'uqr'

const props = defineProps<{ code: string }>()
const emit = defineEmits<{ close: [] }>()

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
