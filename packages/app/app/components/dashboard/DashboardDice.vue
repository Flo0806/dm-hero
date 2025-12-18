<template>
  <div :id="containerId" class="dashboard-dice" @click="rollAgain">
    <!-- Canvas will be injected here by dice-box -->
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    notation?: string
    autoRoll?: boolean
    width?: number
    height?: number
  }>(),
  {
    notation: '2d20',
    autoRoll: true,
    width: 260,
    height: 200,
  },
)

// Generate unique ID for container
const containerId = `dice-box-${Math.random().toString(36).slice(2, 9)}`
const diceBox = useDiceBox()

// Initialize and auto-roll on mount
onMounted(async () => {
  // Destroy any existing instance when remounting (e.g., after navigation)
  diceBox.destroy()

  try {
    await diceBox.init({
      container: `#${containerId}`,
      theme: 'rust', // Rust theme auto-switches to black numbers on light backgrounds
      themeColor: '#D4A574', // DM Hero primary color
      scale: 12, // Max scale for bigger dice
      gravity: 2,
      throwForce: 5,
      spinForce: 5,
      startingHeight: 12,
      settleTimeout: 4000,
      enableShadows: true,
      lightIntensity: 1.2,
    })

    if (props.autoRoll) {
      // Small delay for smoother UX
      setTimeout(() => {
        diceBox.roll(props.notation)
      }, 500)
    }
  } catch (error) {
    console.error('Failed to initialize DiceBox:', error)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  diceBox.destroy()
})

// Click to roll again
function rollAgain() {
  if (diceBox.isReady.value && !diceBox.isRolling.value) {
    diceBox.clear()
    setTimeout(() => {
      diceBox.roll(props.notation)
    }, 100)
  }
}
</script>

<style scoped>
.dashboard-dice {
  width: v-bind('`${width}px`');
  height: v-bind('`${height}px`');
  position: relative;
  cursor: pointer;
}

/* Style the canvas that dice-box injects */
.dashboard-dice :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  background: transparent !important;
}
</style>
