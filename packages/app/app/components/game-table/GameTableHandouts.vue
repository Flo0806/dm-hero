<template>
  <!-- Documents handed out - who has them, change recipients or take them back -->
  <v-card class="pa-6 mt-6">
    <h2 class="text-title-large mb-2">
      {{ $t('gameTable.handout.listTitle') }}
    </h2>
    <v-list bg-color="transparent" class="share-list pa-0">
      <TransitionGroup name="share-row">
        <v-list-item v-for="handout in store.handouts" :key="handout.id" class="px-0">
          <template #prepend>
            <v-icon :icon="handout.format === 'pdf' ? 'mdi-file-pdf-box' : 'mdi-file-document-outline'" color="primary" class="me-3" />
          </template>
          <v-list-item-title>{{ handout.title }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ handout.entity_name }} · {{ recipientsLabel(handout.recipients) }} · {{ formatDate(handout.created_at) }}
          </v-list-item-subtitle>
          <template #append>
            <v-btn icon="mdi-account-multiple-outline" variant="text" size="small" :aria-label="$t('gameTable.handout.recipients')" @click="edit(handout)" />
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              color="error"
              :loading="withdrawing.includes(handout.id)"
              :disabled="withdrawing.includes(handout.id)"
              :aria-label="$t('gameTable.handout.withdraw')"
              @click="withdraw(handout.id)"
            />
          </template>
        </v-list-item>
      </TransitionGroup>
    </v-list>
    <Transition name="share-empty">
      <p v-if="!store.handouts.length" class="text-medium-emphasis mb-0">
        {{ $t('gameTable.handout.empty') }}
      </p>
    </Transition>

    <GameTableHandoutDialog v-if="editing" v-model:show="showDialog" :document-id="editing.document_id" :title="editing.title" />
  </v-card>
</template>

<script setup lang="ts">
import type { GameTableHandout } from '~~/types/share'

const { t, locale } = useI18n()
const store = useGameTableStore()
const snackbarStore = useSnackbarStore()

const formatDate = (value: string) => new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString(locale.value)

function recipientsLabel(recipients: GameTableHandout['recipients']) {
  if (recipients === 'all') return t('gameTable.handout.all')
  const names = store.table?.players.filter(p => recipients.includes(p.id)).map(p => p.name) ?? []
  return names.join(', ') || t('gameTable.handout.nobody')
}

const editing = ref<GameTableHandout | null>(null)
const showDialog = ref(false)
function edit(handout: GameTableHandout) {
  editing.value = handout
  showDialog.value = true
}

// One request per handout - a second click while it runs does nothing
const withdrawing = ref<number[]>([])
async function withdraw(id: number) {
  if (withdrawing.value.includes(id)) return
  withdrawing.value = [...withdrawing.value, id]
  try {
    await store.withdrawHandout(id)
    snackbarStore.success(t('gameTable.handout.withdrawn'))
  }
  catch {
    snackbarStore.error(t('gameTable.error'))
  }
  finally {
    withdrawing.value = withdrawing.value.filter(busy => busy !== id)
  }
}
</script>

<style scoped>
.share-list {
  position: relative;
  /* The leaving row slides past the edge - clip it instead of showing scrollbars */
  overflow: hidden;
}

.share-row-move,
.share-row-enter-active,
.share-row-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.share-row-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.share-row-leave-to {
  opacity: 0;
  transform: translateX(32px);
}

/* Leaving row is taken out of the flow, so the others slide up smoothly */
.share-row-leave-active {
  position: absolute;
  width: 100%;
}

.share-empty-enter-active {
  transition: opacity 0.3s ease 0.3s;
}

.share-empty-enter-from {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .share-empty-enter-active,
  .share-row-move,
  .share-row-enter-active,
  .share-row-leave-active {
    transition: none;
  }
}
</style>
