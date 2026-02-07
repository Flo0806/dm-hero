<template>
  <div class="dice-roller pa-3 rounded">
    <!-- Dice buttons -->
    <div class="d-flex align-center ga-1 flex-wrap">
      <v-btn
        v-for="die in dice"
        :key="die"
        size="small"
        :variant="selected[die] ? 'flat' : 'tonal'"
        :color="selected[die] ? 'primary' : undefined"
        class="dice-btn"
        @click="increment(die)"
        @contextmenu.prevent="decrement(die)"
      >
        <span class="font-weight-bold">d{{ die }}</span>
        <v-badge
          v-if="selected[die] > 1"
          :content="selected[die]"
          color="primary"
          floating
          offset-x="-2"
          offset-y="-2"
        />
      </v-btn>

      <!-- Modifier -->
      <div class="d-flex align-center ga-1 ml-2">
        <v-btn icon size="x-small" variant="text" @click="modifier--">
          <v-icon size="16">mdi-minus</v-icon>
        </v-btn>
        <span class="text-body-2 font-weight-bold" style="min-width: 32px; text-align: center;">
          {{ modifier >= 0 ? `+${modifier}` : modifier }}
        </span>
        <v-btn icon size="x-small" variant="text" @click="modifier++">
          <v-icon size="16">mdi-plus</v-icon>
        </v-btn>
      </div>

      <!-- Roll + Clear -->
      <v-btn
        color="primary"
        size="small"
        :disabled="!hasSelection"
        class="ml-2"
        @click="roll"
      >
        <v-icon start size="16">mdi-dice-multiple</v-icon>
        {{ $t('encounters.roll') }}
      </v-btn>
      <v-btn
        v-if="hasSelection || modifier !== 0"
        icon
        size="x-small"
        variant="text"
        @click="clear"
      >
        <v-icon size="16">mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- Result -->
    <div v-if="lastResult" class="mt-2 d-flex align-center ga-2">
      <span class="text-h6 font-weight-bold text-primary">{{ lastResult.total }}</span>
      <span class="text-body-2 text-medium-emphasis">=</span>
      <span class="text-body-2 text-medium-emphasis">{{ lastResult.breakdown }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const dice = [4, 6, 8, 10, 12, 20] as const
type Die = typeof dice[number]

const selected = reactive<Record<Die, number>>({ 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0 })
const modifier = ref(0)
const lastResult = ref<{ total: number, breakdown: string } | null>(null)

const hasSelection = computed(() => dice.some(d => selected[d] > 0))

function increment(die: Die) {
  if (selected[die] < 20) selected[die]++
}

function decrement(die: Die) {
  if (selected[die] > 0) selected[die]--
}

function clear() {
  for (const d of dice) selected[d] = 0
  modifier.value = 0
  lastResult.value = null
}

function roll() {
  const parts: string[] = []
  let total = 0

  for (const die of dice) {
    const count = selected[die]
    if (!count) continue

    const rolls: number[] = []
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * die) + 1)
    }
    const sum = rolls.reduce((a, b) => a + b, 0)
    total += sum

    if (count === 1) {
      parts.push(`d${die}: ${rolls[0]}`)
    }
    else {
      parts.push(`${count}d${die}: ${rolls.join(' + ')} = ${sum}`)
    }
  }

  if (modifier.value !== 0) {
    total += modifier.value
    parts.push(modifier.value >= 0 ? `+${modifier.value}` : `${modifier.value}`)
  }

  lastResult.value = { total, breakdown: parts.join(' | ') }
}
</script>

<style scoped>
.dice-roller {
  border: 1px solid rgba(var(--v-border-color), 0.12);
}
.dice-btn {
  min-width: 44px !important;
  position: relative;
}
</style>
