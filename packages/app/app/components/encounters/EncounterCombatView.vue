<template>
  <div>
    <!-- Participant tiles row -->
    <div ref="tilesContainer" class="combat-tiles d-flex align-end ga-3 overflow-x-auto pb-2 mb-4 px-2">
      <div
        v-for="(participant, index) in participants"
        :key="participant.id"
        :ref="el => setTileRef(index, el)"
        class="combat-tile"
        :class="{
          'combat-tile--active': index === currentTurnIndex,
          'combat-tile--ko': participant.is_ko,
        }"
        @click="$emit('selectParticipant', index)"
      >
        <div class="combat-tile__image">
          <v-img
            v-if="participant.entity_image"
            :src="`/uploads/${participant.entity_image}`"
            cover
            class="rounded"
          />
          <v-avatar v-else :color="getAvatarColor(participant.entity_type)" class="w-100 h-100 rounded">
            <v-icon :size="index === currentTurnIndex ? 40 : 28">{{ getEntityIcon(participant.entity_type) }}</v-icon>
          </v-avatar>
          <div v-if="participant.is_ko" class="combat-tile__ko-overlay rounded d-flex align-center justify-center">
            <v-icon color="error" size="32">mdi-skull</v-icon>
          </div>
          <div v-if="participant.initiative != null" class="combat-tile__initiative">
            {{ participant.initiative }}
          </div>
          <v-btn
            icon="mdi-eye"
            variant="flat"
            class="combat-tile__view combat-tile__btn"
            @click.stop="openPreview(participant)"
          />
          <v-btn
            icon="mdi-close"
            variant="flat"
            color="error"
            class="combat-tile__remove combat-tile__btn"
            @click.stop="confirmRemove(participant)"
          />
        </div>
        <div class="combat-tile__name text-caption text-center text-truncate mt-1">
          {{ participant.display_name }}
          <span v-if="participant.duplicate_index > 0">({{ participant.duplicate_index + 1 }})</span>
        </div>
        <div class="combat-tile__hp mt-1">
          <v-progress-linear
            :model-value="participant.max_hp > 0 ? (participant.current_hp / participant.max_hp) * 100 : 0"
            :color="hpColor(participant)"
            height="6"
            rounded
          />
          <div class="text-center" style="font-size: 10px;">
            {{ participant.current_hp }}/{{ participant.max_hp }}
            <span v-if="participant.temp_hp > 0" class="text-info">(+{{ participant.temp_hp }})</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Active participant detail panel -->
    <v-card v-if="activeParticipant" variant="outlined" class="mb-3">
      <v-card-text>
        <div class="d-flex align-center ga-3 mb-3">
          <v-avatar :color="getAvatarColor(activeParticipant.entity_type)" size="48">
            <v-img v-if="activeParticipant.entity_image" :src="`/uploads/${activeParticipant.entity_image}`" />
            <v-icon v-else>{{ getEntityIcon(activeParticipant.entity_type) }}</v-icon>
          </v-avatar>
          <div>
            <div class="text-h6">
              {{ activeParticipant.display_name }}
              <span v-if="activeParticipant.duplicate_index > 0" class="text-medium-emphasis">({{ activeParticipant.duplicate_index + 1 }})</span>
            </div>
            <div class="d-flex ga-2">
              <v-chip size="x-small" variant="tonal">{{ activeParticipant.entity_type }}</v-chip>
              <v-chip v-if="activeParticipant.initiative != null" size="x-small" variant="tonal" color="info" prepend-icon="mdi-lightning-bolt">
                {{ activeParticipant.initiative }}
              </v-chip>
              <v-chip v-if="activeParticipant.is_ko" size="x-small" color="error" prepend-icon="mdi-skull">{{ $t('encounters.ko') }}</v-chip>
            </div>
          </div>
        </div>

        <!-- HP Section -->
        <div class="mb-3">
          <div class="d-flex align-center ga-2 mb-1">
            <v-text-field
              v-model.number="liveCurrentHp"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              :label="$t('encounters.hp')"
              style="max-width: 90px;"
            />
            <span class="text-h6">/</span>
            <v-text-field
              v-model.number="liveMaxHp"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              label="Max"
              style="max-width: 90px;"
            />
            <span v-if="activeParticipant.temp_hp > 0" class="text-info text-body-2">(+{{ activeParticipant.temp_hp }} {{ $t('encounters.tempHp') }})</span>
          </div>
          <v-progress-linear
            :model-value="liveHpPct"
            :color="liveHpColor"
            height="10"
            rounded
            class="mb-3"
          />

          <!-- Damage / Heal controls -->
          <div class="d-flex align-center ga-2 flex-wrap">
            <v-text-field
              v-model.number="hpAmount"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              min="0"
              style="max-width: 100px;"
              @keydown.enter="onDamage"
            />
            <v-btn color="error" variant="tonal" prepend-icon="mdi-sword" :disabled="!hpAmount" @click="onDamage">
              {{ $t('encounters.damage') }}
            </v-btn>
            <v-btn color="success" variant="tonal" prepend-icon="mdi-heart" :disabled="!hpAmount" @click="onHeal">
              {{ $t('encounters.heal') }}
            </v-btn>
            <v-spacer />
            <v-btn
              :prepend-icon="activeParticipant.is_ko ? 'mdi-skull' : 'mdi-skull-outline'"
              :color="activeParticipant.is_ko ? 'error' : 'default'"
              variant="tonal"
              @click="onToggleKo"
            >
              {{ $t('encounters.ko') }}
            </v-btn>
          </div>
        </div>

        <!-- Effects -->
        <div class="mb-3">
          <div class="d-flex align-center ga-2 mb-2">
            <span class="text-body-2 font-weight-medium">{{ $t('encounters.effects') }}</span>
            <v-spacer />
            <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="showEffectInput = !showEffectInput">
              {{ $t('encounters.addEffect') }}
            </v-btn>
          </div>

          <!-- Add effect inline form -->
          <div v-if="showEffectInput" class="d-flex align-center ga-2 mb-2 flex-wrap">
            <v-text-field
              v-model="newEffectName"
              :label="$t('encounters.effectName')"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 160px;"
              @keydown.enter="onAddEffect"
            />
            <v-select
              v-model="newEffectDuration"
              :items="durationTypes"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 150px;"
            />
            <v-text-field
              v-if="newEffectDuration === 'rounds'"
              v-model.number="newEffectRounds"
              type="number"
              :label="$t('encounters.rounds')"
              density="compact"
              variant="outlined"
              hide-details
              min="1"
              style="max-width: 80px;"
            />
            <v-btn icon="mdi-check" size="small" color="primary" variant="tonal" :disabled="!newEffectName.trim()" @click="onAddEffect" />
          </div>

          <!-- Active effects list -->
          <div v-if="activeParticipant.effects?.length" class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="effect in activeParticipant.effects"
              :key="effect.id"
              size="small"
              closable
              :color="effectColor(effect)"
              :prepend-icon="effect.icon || effectIcon(effect)"
              @click:close="onRemoveEffect(effect.id)"
            >
              {{ effect.name }}
              <span v-if="effect.duration_type === 'rounds'" class="ml-1">({{ effect.remaining_rounds }})</span>
            </v-chip>
          </div>
          <div v-else class="text-caption text-medium-emphasis">{{ $t('encounters.noEffects') }}</div>
        </div>

        <!-- Notes -->
        <v-textarea
          :model-value="activeParticipant.notes || ''"
          :label="$t('encounters.notes')"
          density="compact"
          variant="outlined"
          hide-details
          rows="4"
          auto-grow
          @blur="onNotesBlur"
        />
      </v-card-text>
    </v-card>

    <SharedEntityPreviewDialog
      v-model="showPreviewDialog"
      :entity-type="previewEntityType"
      :entity-id="previewEntityId"
    />

    <!-- Remove confirmation dialog -->
    <v-dialog v-model="showRemoveDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('encounters.removeParticipant') }}</v-card-title>
        <v-card-text>
          {{ $t('encounters.removeParticipantConfirm', { name: removeTarget?.display_name }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRemoveDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" @click="doRemove">{{ $t('encounters.removeParticipant') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import type { EncounterEffect, EncounterParticipant } from '~~/types/encounter'

const { t } = useI18n()
const encounterStore = useEncounterStore()

const props = defineProps<{
  participants: EncounterParticipant[]
  currentTurnIndex: number
  encounterId: number
}>()

const emit = defineEmits<{
  selectParticipant: [index: number]
  updateParticipant: [participantId: number, updates: Partial<EncounterParticipant>]
  removeParticipant: [participantId: number]
}>()

const hpAmount = ref<number | undefined>()
const showEffectInput = ref(false)
const showPreviewDialog = ref(false)
const previewEntityType = ref<'npc' | 'player'>('npc')
const previewEntityId = ref<number | null>(null)
const newEffectName = ref('')
const newEffectDuration = ref('infinite')
const newEffectRounds = ref(1)
const showRemoveDialog = ref(false)
const removeTarget = ref<EncounterParticipant | null>(null)

const durationTypes = computed(() => [
  { title: t('encounters.durationInfinite'), value: 'infinite' },
  { title: t('encounters.durationRounds'), value: 'rounds' },
  { title: t('encounters.durationConcentration'), value: 'concentration' },
])
const tileRefs = new Map<number, HTMLElement>()

const activeParticipant = computed(() => props.participants[props.currentTurnIndex] ?? null)

// Live HP tracking for progress bar
const liveCurrentHp = ref(0)
const liveMaxHp = ref(0)

watch(activeParticipant, (p) => {
  liveCurrentHp.value = p?.current_hp ?? 0
  liveMaxHp.value = p?.max_hp ?? 0
}, { immediate: true })

const liveHpPct = computed(() => liveMaxHp.value > 0 ? (liveCurrentHp.value / liveMaxHp.value) * 100 : 0)
const liveHpColor = computed(() => {
  if (liveMaxHp.value === 0) return 'grey'
  const pct = liveCurrentHp.value / liveMaxHp.value
  if (pct > 0.5) return 'success'
  if (pct > 0.25) return 'warning'
  return 'error'
})

function setTileRef(index: number, el: unknown) {
  if (el instanceof HTMLElement) {
    tileRefs.set(index, el)
  }
}

// Scroll active tile into view on turn change
watch(() => props.currentTurnIndex, () => {
  scrollActiveTile()
}, { immediate: true })

function scrollActiveTile() {
  nextTick(() => {
    const el = tileRefs.get(props.currentTurnIndex)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })
}

function hpColor(p: EncounterParticipant): string {
  if (p.max_hp === 0) return 'grey'
  const pct = p.current_hp / p.max_hp
  if (pct > 0.5) return 'success'
  if (pct > 0.25) return 'warning'
  return 'error'
}

function onDamage() {
  if (!hpAmount.value || !activeParticipant.value) return
  const p = activeParticipant.value
  let remaining = hpAmount.value
  let newTempHp = p.temp_hp
  let newCurrentHp = p.current_hp

  if (newTempHp > 0) {
    if (remaining <= newTempHp) {
      newTempHp -= remaining
      remaining = 0
    }
    else {
      remaining -= newTempHp
      newTempHp = 0
    }
  }
  newCurrentHp = Math.max(0, newCurrentHp - remaining)

  emit('updateParticipant', p.id, {
    current_hp: newCurrentHp,
    temp_hp: newTempHp,
    is_ko: newCurrentHp === 0 || p.is_ko,
  })
  hpAmount.value = undefined
}

function onHeal() {
  if (!hpAmount.value || !activeParticipant.value) return
  const p = activeParticipant.value
  const newHp = Math.min(p.max_hp, p.current_hp + hpAmount.value)
  emit('updateParticipant', p.id, { current_hp: newHp, is_ko: false })
  hpAmount.value = undefined
}

function onToggleKo() {
  if (!activeParticipant.value) return
  emit('updateParticipant', activeParticipant.value.id, { is_ko: !activeParticipant.value.is_ko })
}

// Debounced save for HP fields — saves on every change, not just blur
let hpSaveTimer: ReturnType<typeof setTimeout> | null = null

watch(liveCurrentHp, (val) => {
  if (!activeParticipant.value || val === activeParticipant.value.current_hp) return
  if (hpSaveTimer) clearTimeout(hpSaveTimer)
  hpSaveTimer = setTimeout(() => {
    if (!activeParticipant.value) return
    emit('updateParticipant', activeParticipant.value.id, { current_hp: val || 0 })
  }, 300)
})

watch(liveMaxHp, (val) => {
  if (!activeParticipant.value || val === activeParticipant.value.max_hp) return
  if (hpSaveTimer) clearTimeout(hpSaveTimer)
  hpSaveTimer = setTimeout(() => {
    if (!activeParticipant.value) return
    const updates: Partial<EncounterParticipant> = { max_hp: val || 0 }
    if (activeParticipant.value.current_hp > (val || 0)) {
      updates.current_hp = val || 0
      liveCurrentHp.value = val || 0
    }
    emit('updateParticipant', activeParticipant.value.id, updates)
  }, 300)
})

function onNotesBlur(event: FocusEvent) {
  if (!activeParticipant.value) return
  const val = (event.target as HTMLTextAreaElement)?.value || ''
  if (val !== (activeParticipant.value.notes || '')) {
    emit('updateParticipant', activeParticipant.value.id, { notes: val || null })
  }
}

async function onAddEffect() {
  if (!newEffectName.value.trim() || !activeParticipant.value) return
  await encounterStore.addEffect(props.encounterId, activeParticipant.value.id, {
    name: newEffectName.value.trim(),
    duration_type: newEffectDuration.value,
    duration_rounds: newEffectDuration.value === 'rounds' ? newEffectRounds.value : null,
  })
  newEffectName.value = ''
  newEffectDuration.value = 'infinite'
  newEffectRounds.value = 1
  showEffectInput.value = false
}

async function onRemoveEffect(effectId: number) {
  if (!activeParticipant.value) return
  await encounterStore.removeEffect(props.encounterId, activeParticipant.value.id, effectId)
}

function effectColor(e: EncounterEffect): string {
  if (e.duration_type === 'concentration') return 'purple'
  if (e.duration_type === 'rounds') return 'orange'
  return 'default'
}

function effectIcon(e: EncounterEffect): string {
  if (e.duration_type === 'concentration') return 'mdi-head-flash'
  if (e.duration_type === 'rounds') return 'mdi-timer-sand'
  return 'mdi-star-four-points'
}

function confirmRemove(participant: EncounterParticipant) {
  removeTarget.value = participant
  showRemoveDialog.value = true
}

function doRemove() {
  if (removeTarget.value) {
    emit('removeParticipant', removeTarget.value.id)
  }
  showRemoveDialog.value = false
  removeTarget.value = null
}

function openPreview(participant: EncounterParticipant) {
  previewEntityType.value = participant.entity_type === 'Player' ? 'player' : 'npc'
  previewEntityId.value = participant.entity_id
  showPreviewDialog.value = true
}

function getEntityIcon(type?: string): string {
  const icons: Record<string, string> = {
    NPC: 'mdi-account',
    Player: 'mdi-account-star',
  }
  return icons[type || ''] || 'mdi-help'
}

function getAvatarColor(type?: string): string {
  const colors: Record<string, string> = {
    NPC: 'blue-lighten-4',
    Player: 'cyan-lighten-4',
  }
  return colors[type || ''] || 'grey-lighten-3'
}
</script>

<style scoped>
.combat-tiles {
  padding: 12px 4px;
}

.combat-tile {
  flex-shrink: 0;
  width: 80px;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 0.7;
}

.combat-tile--active {
  width: 120px;
  opacity: 1;
  margin: 0 4px;
  z-index: 1;
}

.combat-tile--ko {
  opacity: 0.4;
}

.combat-tile--active.combat-tile--ko {
  opacity: 0.6;
}

.combat-tile__image {
  position: relative;
  aspect-ratio: 1;
  overflow: visible;
  border-radius: 8px;
  border: 2px solid transparent;
}

.combat-tile__image > .v-img,
.combat-tile__image > .v-avatar {
  overflow: hidden;
  border-radius: 6px;
}

.combat-tile--active .combat-tile__image {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 12px rgba(var(--v-theme-primary), 0.4);
}

.combat-tile__ko-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.combat-tile__initiative {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 24px;
  height: 24px;
  padding: 0 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 2;
}

.combat-tile__btn {
  width: 28px !important;
  height: 28px !important;
  font-size: 16px;
}

.combat-tile__view {
  position: absolute;
  bottom: 2px;
  left: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.combat-tile__remove {
  position: absolute;
  top: 2px;
  left: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.combat-tile:hover .combat-tile__view,
.combat-tile:hover .combat-tile__remove {
  opacity: 0.8;
}

.combat-tile__name {
  max-width: 100%;
  font-weight: 500;
}

.combat-tile--active .combat-tile__name {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
</style>
