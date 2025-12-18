// Composable for 3D dice rolling using @3d-dice/dice-box
// Only works on client-side (WebGL)

import type DiceBoxType from '@3d-dice/dice-box'

interface DiceBoxConfig {
  container: string | HTMLElement
  theme?: string // Theme systemName (e.g., 'default', 'rust')
  themeColor?: string // HEX color for themes that support it
  scale?: number
  gravity?: number
  throwForce?: number
  spinForce?: number
  startingHeight?: number
  settleTimeout?: number
  enableShadows?: boolean
  lightIntensity?: number
}

interface DiceResult {
  value: number
  qty: number
  sides: number
  rolls: { value: number }[]
}

interface RollResult {
  notation: string
  total: number
  dice: DiceResult[]
}

let diceBoxInstance: DiceBoxType | null = null
let initPromise: Promise<DiceBoxType> | null = null
const globalIsReady = ref(false)

export function useDiceBox() {
  const isRolling = ref(false)
  const lastResult = ref<RollResult | null>(null)

  async function init(config: DiceBoxConfig): Promise<DiceBoxType> {
    // Only run on client
    if (import.meta.server) {
      throw new Error('DiceBox can only be initialized on client-side')
    }

    // Return existing instance if already initialized
    if (diceBoxInstance && globalIsReady.value) {
      return diceBoxInstance
    }

    // Return pending initialization
    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      // Dynamic import to avoid SSR issues
      const { default: DiceBox } = await import('@3d-dice/dice-box')

      // v1.1.0 API: single config object with container property
      diceBoxInstance = new DiceBox({
        container: config.container,
        assetPath: '/dice-box/',
        theme: config.theme || 'default',
        themeColor: config.themeColor || '#D4A574', // DM Hero primary color
        scale: config.scale ?? 5,
        gravity: config.gravity ?? 2,
        throwForce: config.throwForce ?? 6,
        spinForce: config.spinForce ?? 5,
        startingHeight: config.startingHeight ?? 10,
        settleTimeout: config.settleTimeout ?? 5000,
        enableShadows: config.enableShadows ?? true,
        lightIntensity: config.lightIntensity ?? 1.2,
      })

      await diceBoxInstance.init()
      globalIsReady.value = true

      return diceBoxInstance
    })()

    return initPromise
  }

  async function roll(notation: string): Promise<RollResult | null> {
    // Wait for pending init if exists
    if (initPromise && !globalIsReady.value) {
      await initPromise
    }

    if (!diceBoxInstance || !globalIsReady.value) {
      console.warn('DiceBox not initialized. Call init() first.')
      return null
    }

    isRolling.value = true

    try {
      const result = await diceBoxInstance.roll(notation)
      lastResult.value = result as RollResult
      return result as RollResult
    } finally {
      isRolling.value = false
    }
  }

  function clear() {
    if (diceBoxInstance && globalIsReady.value) {
      diceBoxInstance.clear()
    }
  }

  function hide() {
    if (diceBoxInstance && globalIsReady.value) {
      diceBoxInstance.hide()
    }
  }

  function show() {
    if (diceBoxInstance && globalIsReady.value) {
      diceBoxInstance.show()
    }
  }

  function updateConfig(config: Partial<DiceBoxConfig>) {
    if (diceBoxInstance && globalIsReady.value) {
      diceBoxInstance.updateConfig(config)
    }
  }

  // Cleanup on component unmount (optional - dice box persists across navigation)
  function destroy() {
    if (diceBoxInstance) {
      diceBoxInstance.clear()
      diceBoxInstance = null
      initPromise = null
      globalIsReady.value = false
    }
  }

  return {
    init,
    roll,
    clear,
    hide,
    show,
    updateConfig,
    destroy,
    isReady: readonly(globalIsReady),
    isRolling: readonly(isRolling),
    lastResult: readonly(lastResult),
  }
}
