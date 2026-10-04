// @3d-dice/dice-box ships no types - only what useDiceBox.ts uses
declare module '@3d-dice/dice-box' {
  export default class DiceBox {
    constructor(config: Record<string, unknown>)
    init(): Promise<void>
    roll(notation: string): Promise<unknown>
    clear(): void
    hide(): void
    show(): void
    updateConfig(config: Record<string, unknown>): void
  }
}
