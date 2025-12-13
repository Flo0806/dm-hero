/**
 * Composable for managing dirty state across dialog tabs.
 *
 * Usage in parent dialog:
 *   const { provide: provideDirtyState, hasDirtyTabs, dirtyTabNames } = useDialogDirtyState()
 *   provideDirtyState()
 *
 * Usage in child tab:
 *   const { registerTab, setDirty } = useDialogDirtyState()
 *   const unregister = registerTab('documents')
 *   watch(isEditing, (dirty) => setDirty('documents', dirty))
 *   onUnmounted(unregister)
 */

import { provide, inject, ref, computed, onUnmounted, type InjectionKey, type Ref, type ComputedRef } from 'vue'

interface DirtyTabInfo {
  name: string
  dirty: boolean
  label?: string
}

interface DialogDirtyStateContext {
  registerTab: (name: string, label?: string) => () => void
  unregisterTab: (name: string) => void
  setDirty: (name: string, dirty: boolean) => void
  isDirty: (name: string) => boolean
  hasDirtyTabs: ComputedRef<boolean>
  dirtyTabNames: ComputedRef<string[]>
  dirtyTabLabels: ComputedRef<string[]>
}

const DIRTY_STATE_KEY: InjectionKey<DialogDirtyStateContext> = Symbol('dialog-dirty-state')

/**
 * Create and provide dirty state management for a dialog.
 * Call this in the parent dialog component.
 */
export function useDialogDirtyStateProvider() {
  const tabs = ref<Map<string, DirtyTabInfo>>(new Map())

  const registerTab = (name: string, label?: string): (() => void) => {
    tabs.value.set(name, { name, dirty: false, label: label || name })
    return () => unregisterTab(name)
  }

  const unregisterTab = (name: string) => {
    tabs.value.delete(name)
  }

  const setDirty = (name: string, dirty: boolean) => {
    const tab = tabs.value.get(name)
    if (tab) {
      tab.dirty = dirty
      // Trigger reactivity
      tabs.value = new Map(tabs.value)
    }
  }

  const isDirty = (name: string): boolean => {
    return tabs.value.get(name)?.dirty ?? false
  }

  const hasDirtyTabs = computed(() => {
    return Array.from(tabs.value.values()).some((tab) => tab.dirty)
  })

  const dirtyTabNames = computed(() => {
    return Array.from(tabs.value.values())
      .filter((tab) => tab.dirty)
      .map((tab) => tab.name)
  })

  const dirtyTabLabels = computed(() => {
    return Array.from(tabs.value.values())
      .filter((tab) => tab.dirty)
      .map((tab) => tab.label || tab.name)
  })

  const context: DialogDirtyStateContext = {
    registerTab,
    unregisterTab,
    setDirty,
    isDirty,
    hasDirtyTabs,
    dirtyTabNames,
    dirtyTabLabels,
  }

  // Provide to children
  provide(DIRTY_STATE_KEY, context)

  return context
}

/**
 * Use dirty state management in a child tab component.
 * The parent must have called useDialogDirtyStateProvider().
 */
export function useDialogDirtyState() {
  const context = inject(DIRTY_STATE_KEY, null)

  if (!context) {
    // Not inside a dialog with dirty state management - return no-op functions
    return {
      registerTab: (_name: string, _label?: string) => () => {},
      unregisterTab: (_name: string) => {},
      setDirty: (_name: string, _dirty: boolean) => {},
      isDirty: (_name: string) => false,
      hasDirtyTabs: computed(() => false),
      dirtyTabNames: computed(() => [] as string[]),
      dirtyTabLabels: computed(() => [] as string[]),
      isProvided: false,
    }
  }

  return {
    ...context,
    isProvided: true,
  }
}

/**
 * Helper hook for tabs - registers on mount, unregisters on unmount,
 * and provides a simple way to update dirty state.
 */
export function useTabDirtyState(tabName: string, tabLabel?: string) {
  const { registerTab, setDirty, isProvided } = useDialogDirtyState()

  if (isProvided) {
    const unregister = registerTab(tabName, tabLabel)
    onUnmounted(unregister)
  }

  const markDirty = (dirty: boolean) => {
    setDirty(tabName, dirty)
  }

  return {
    markDirty,
    isProvided,
  }
}
