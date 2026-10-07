<template>
  <draggable
    :list="nodes"
    item-key="id"
    group="story-nodes"
    handle=".story-drag-handle"
    :animation="150"
    ghost-class="story-ghost"
    class="story-branch"
    :class="{ 'story-branch--empty': nodes.length === 0 }"
    @change="onChange"
  >
    <template #item="{ element }">
      <div class="story-item">
        <div
          class="story-row d-flex align-center rounded pr-1"
          :class="{ 'story-row--active': tree.selectedId.value === element.id }"
          :style="{ paddingLeft: `${depth * 14}px` }"
          @click="tree.select(element.id)"
        >
          <v-icon icon="mdi-drag-vertical" size="small" class="story-drag-handle story-hover-only text-disabled" />
          <v-btn
            v-if="element.children.length > 0"
            icon="mdi-chevron-right"
            variant="text"
            size="x-small"
            density="compact"
            class="story-chevron"
            :class="{ 'story-chevron--open': tree.isExpanded(element.id) }"
            @click.stop="tree.toggle(element.id)"
          />
          <span v-else class="story-toggle-spacer" />
          <v-icon :icon="STORY_NODE_KIND_ICONS[element.kind as StoryNodeKind]" size="small" class="mr-2 text-medium-emphasis" />
          <span class="text-truncate flex-grow-1" :class="{ 'story-row--skipped': element.status === 'skipped' }">
            {{ element.name }}
          </span>

          <span v-if="tree.progress(element.id)" class="story-progress text-caption text-medium-emphasis ml-1 flex-shrink-0">
            <v-progress-circular
              :model-value="100 * tree.progress(element.id)!.done / tree.progress(element.id)!.total"
              size="14"
              width="2"
              color="success"
              bg-color="rgba(128,128,128,0.35)"
              class="mr-1"
            />
            {{ tree.progress(element.id)!.done }}/{{ tree.progress(element.id)!.total }}
          </span>

          <v-btn
            icon="mdi-plus"
            variant="tonal"
            color="primary"
            size="x-small"
            density="compact"
            class="story-hover-only ml-1"
            :title="$t('story.addChild')"
            @click.stop="tree.startAdd(element.id)"
          />
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon="mdi-dots-vertical"
                variant="text"
                size="x-small"
                density="compact"
                class="story-hover-only"
                @click.stop
              />
            </template>
            <v-list density="compact">
              <v-list-item prepend-icon="mdi-plus" :title="$t('story.addChild')" @click="tree.startAdd(element.id)" />
              <v-list-item
                prepend-icon="mdi-delete"
                base-color="error"
                :title="$t('common.delete')"
                @click="tree.remove(element.id)"
              />
            </v-list>
          </v-menu>

          <v-icon
            icon="mdi-circle"
            size="8"
            :color="STORY_NODE_STATUS_COLORS[element.status as StoryNodeStatus]"
            :title="$t(`story.statuses.${element.status}`)"
            class="story-status-dot ml-2 mr-1 flex-shrink-0"
          />
        </div>
        <v-expand-transition>
          <StoryTreeBranch
            v-if="element.children.length === 0 || tree.isExpanded(element.id)"
            :nodes="element.children"
            :parent-id="element.id"
            :depth="depth + 1"
          />
        </v-expand-transition>
      </div>
    </template>

    <!-- Outliner-style quick add: Enter = next sibling, Tab = indent, Shift+Tab = outdent -->
    <template #footer>
      <div v-if="tree.adding.value === parentId" class="story-add-row d-flex align-center" :style="{ paddingLeft: `${depth * 14 + 34}px` }">
        <v-icon :icon="STORY_NODE_KIND_ICONS[tree.kindForDepth(depth)]" size="small" class="mr-2 text-medium-emphasis" />
        <input
          ref="addInput"
          v-model="tree.addText.value"
          class="story-add-input flex-grow-1"
          :placeholder="$t('story.addPlaceholder', { kind: $t(`story.kinds.${tree.kindForDepth(depth)}`) })"
          @keydown.enter.prevent="submit()"
          @keydown.tab.exact.prevent="tree.indent()"
          @keydown.shift.tab.prevent="tree.outdent()"
          @keydown.esc.prevent="tree.cancelAdd()"
          @blur="onBlur"
        />
      </div>
    </template>
  </draggable>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Ref } from 'vue'
import type { StoryTreeNode } from '~/stores/story'
import { STORY_NODE_KIND_ICONS, STORY_NODE_STATUS_COLORS, type StoryNodeKind, type StoryNodeStatus } from '~~/types/story'

export interface StoryTreeContext {
  selectedId: Ref<number | null>
  select: (id: number) => void
  isExpanded: (id: number) => boolean
  toggle: (id: number) => void
  remove: (id: number) => void
  move: (id: number, parentId: number | null, index: number) => void
  progress: (id: number) => { done: number, total: number } | undefined
  /** Parent the quick-add row is under (null = top level, undefined = not adding) */
  adding: Ref<number | null | undefined>
  /** Text of the quick-add row (moves along with indent / outdent) */
  addText: Ref<string>
  startAdd: (parentId: number | null) => void
  cancelAdd: () => void
  /** Creates the entry under the current add parent; rejects if that failed */
  submitAdd: (name: string) => Promise<void>
  indent: () => void
  outdent: () => void
  kindForDepth: (depth: number) => StoryNodeKind
}

const props = withDefaults(defineProps<{
  nodes: StoryTreeNode[]
  parentId?: number | null
  depth?: number
}>(), {
  parentId: null,
  depth: 0,
})

const tree = inject<StoryTreeContext>('storyTree')!

const addInput = ref<HTMLInputElement | null>(null)
let submitting = false

// Focus the row when it appears here (also after indent / outdent moved it)
watch(() => tree.adding.value === props.parentId, async (active) => {
  if (!active) return
  await nextTick()
  addInput.value?.focus()
}, { immediate: true })

/** Creates the typed entry; false if that failed (the name stays in the field) */
async function submit(refocus = true): Promise<boolean> {
  const name = tree.addText.value.trim()
  if (!name) {
    tree.cancelAdd()
    return true
  }
  submitting = true
  let succeeded = false
  try {
    await tree.submitAdd(name)
    tree.addText.value = ''
    succeeded = true
  }
  catch {
    // submitAdd already reported it
  }
  finally {
    submitting = false
  }
  // Back in the field: the next entry, or another try with the same name
  if (refocus) {
    await nextTick()
    addInput.value?.focus()
  }
  return succeeded
}

/** Leaving the quick-add field: create what was typed, then close the row (kept open if creating failed). */
async function onBlur() {
  if (submitting) return
  // The row moved to another branch (indent/outdent) - not a real blur
  await nextTick()
  if (tree.adding.value !== props.parentId) return
  if (document.activeElement === addInput.value) return
  // Couldn't be created: keep the row and its text instead of throwing it away
  if (tree.addText.value.trim() && !(await submit(false))) return
  tree.cancelAdd()
}

/** Persist a drag & drop: vuedraggable reports "added" on the target list and "moved" within a list. */
function onChange(event: {
  added?: { element: StoryTreeNode, newIndex: number }
  moved?: { element: StoryTreeNode, newIndex: number }
}) {
  const change = event.added ?? event.moved
  if (change) tree.move(change.element.id, props.parentId, change.newIndex)
}
</script>

<style scoped>
.story-branch--empty {
  min-height: 4px;
}

.story-item {
  animation: story-row-in 0.22s ease-out both;
}

@keyframes story-row-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
}

.story-row {
  position: relative;
  min-height: 32px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
}

/* Accent bar on the selected row */
.story-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 3px;
  background: rgb(var(--v-theme-primary));
  transform: scaleY(0);
  transition: transform 0.2s ease;
}

.story-row--active::before {
  transform: scaleY(1);
}

.story-chevron :deep(.v-icon) {
  transition: transform 0.2s ease;
}

.story-chevron--open :deep(.v-icon) {
  transform: rotate(90deg);
}

.story-status-dot {
  transition: color 0.3s ease;
}

.story-progress {
  display: inline-flex;
  align-items: center;
}

.story-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.story-row--active {
  background: rgba(var(--v-theme-primary), 0.14);
}

.story-row--skipped {
  opacity: 0.5;
  text-decoration: line-through;
}

.story-hover-only {
  opacity: 0;
  transition: opacity 0.1s;
}

.story-row:hover .story-hover-only,
.story-row--active .story-hover-only {
  opacity: 1;
}

.story-drag-handle {
  cursor: grab;
  width: 16px;
}

.story-toggle-spacer {
  display: inline-block;
  width: 24px;
}

.story-ghost {
  opacity: 0.4;
}

.story-add-row {
  min-height: 32px;
  animation: story-row-in 0.2s ease-out both;
}

.story-add-input:focus {
  border-bottom-style: solid;
  border-bottom-color: rgb(var(--v-theme-primary));
}

.story-add-input {
  background: transparent;
  border: none;
  border-bottom: 1px dashed rgba(var(--v-theme-primary), 0.6);
  outline: none;
  color: inherit;
  padding: 2px 0;
  font-size: inherit;
}

@media (prefers-reduced-motion: reduce) {
  .story-item,
  .story-add-row {
    animation: none;
  }

  .story-row,
  .story-row::before,
  .story-chevron :deep(.v-icon),
  .story-status-dot,
  .story-hover-only {
    transition: none;
  }
}
</style>
