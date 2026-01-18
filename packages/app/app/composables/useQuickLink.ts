import type { SourceEntityType, QuickLinkSelection } from '~~/types/quick-link'
import type { GroupInfo } from '~~/types/npc'

interface UseQuickLinkOptions {
  entityId: number
  entityName: string
  sourceType: SourceEntityType
  groups?: Ref<GroupInfo[] | undefined>
  onLinked?: () => void
  onAddToGroup?: (groupId: number) => void
  onCreateGroup?: () => void
}

/**
 * Composable for Quick Link context menu functionality
 * Provides all state and handlers needed for right-click linking
 */
export function useQuickLink(options: UseQuickLinkOptions) {
  const { entityId, entityName, sourceType, groups, onLinked, onAddToGroup, onCreateGroup } = options

  // Context Menu State
  const showContextMenu = ref(false)
  const contextMenuPosition = ref({ x: 0, y: 0 })

  // Entity Select Dialog State
  const showEntitySelectDialog = ref(false)
  const selectedTargetType = ref<'NPC' | 'Location' | 'Item' | 'Faction' | 'Lore' | 'Player'>('NPC')
  const selectedRelationType = ref('')

  // Get the appropriate counts reload function based on source type
  const countsReloader = getCountsReloader(sourceType)

  /**
   * Open context menu at mouse position
   */
  function openContextMenu(event: MouseEvent) {
    contextMenuPosition.value = { x: event.clientX, y: event.clientY }
    showContextMenu.value = true
  }

  /**
   * Handle selection from context menu
   */
  function handleQuickLinkSelect(selection: QuickLinkSelection) {
    selectedTargetType.value = selection.targetType as typeof selectedTargetType.value
    selectedRelationType.value = selection.relationType
    showContextMenu.value = false
    showEntitySelectDialog.value = true
  }

  /**
   * Handle add to existing group
   */
  function handleAddToGroup(groupId: number) {
    onAddToGroup?.(groupId)
  }

  /**
   * Handle create new group
   */
  function handleCreateGroup() {
    onCreateGroup?.()
  }

  /**
   * Handle successful linking - reload counts and notify parent
   */
  async function handleLinked() {
    // Reload counts for this entity to update badges
    if (countsReloader) {
      await countsReloader([entityId])
    }
    onLinked?.()
  }

  // Props for QuickLinkContextMenu component
  const contextMenuProps = computed(() => ({
    position: contextMenuPosition.value,
    sourceEntity: { id: entityId, name: entityName },
    sourceType,
    groups: groups?.value,
  }))

  // Props for QuickLinkEntitySelectDialog component
  const entitySelectDialogProps = computed(() => ({
    sourceEntity: { id: entityId, name: entityName },
    sourceType,
    targetType: selectedTargetType.value,
    relationType: selectedRelationType.value,
  }))

  return {
    // State
    showContextMenu,
    showEntitySelectDialog,

    // Handlers
    openContextMenu,
    handleQuickLinkSelect,
    handleAddToGroup,
    handleCreateGroup,
    handleLinked,

    // Component props (for cleaner template binding)
    contextMenuProps,
    entitySelectDialogProps,
  }
}

/**
 * Get the counts reload function for a given source type
 */
function getCountsReloader(sourceType: SourceEntityType): ((ids: number[]) => Promise<void>) | null {
  switch (sourceType) {
    case 'NPC': {
      const { reloadCountsFor } = useNpcCounts()
      return reloadCountsFor
    }
    case 'Item': {
      const { reloadCountsFor } = useItemCounts()
      return reloadCountsFor
    }
    case 'Faction': {
      const { reloadCountsFor } = useFactionCounts()
      return reloadCountsFor
    }
    case 'Lore': {
      const { reloadCountsFor } = useLoreCounts()
      return reloadCountsFor
    }
    case 'Player': {
      const { reloadCountsFor } = usePlayerCounts()
      return reloadCountsFor
    }
    case 'Location':
      // Location doesn't have a counts composable yet
      return null
    default:
      return null
  }
}
