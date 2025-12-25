<template>
  <div class="rich-text-editor">
    <!-- Toolbar -->
    <div v-if="editor" class="editor-toolbar">
      <v-btn-group density="compact" variant="text">
        <v-btn
          :class="{ 'is-active': editor.isActive('bold') }"
          icon="mdi-format-bold"
          size="small"
          @click="editor.chain().focus().toggleBold().run()"
        />
        <v-btn
          :class="{ 'is-active': editor.isActive('italic') }"
          icon="mdi-format-italic"
          size="small"
          @click="editor.chain().focus().toggleItalic().run()"
        />
        <v-btn
          :class="{ 'is-active': editor.isActive('strike') }"
          icon="mdi-format-strikethrough"
          size="small"
          @click="editor.chain().focus().toggleStrike().run()"
        />
      </v-btn-group>

      <v-divider vertical class="mx-2" />

      <v-btn-group density="compact" variant="text">
        <v-btn
          :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
          icon="mdi-format-header-2"
          size="small"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        />
        <v-btn
          :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
          icon="mdi-format-header-3"
          size="small"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        />
      </v-btn-group>

      <v-divider vertical class="mx-2" />

      <v-btn-group density="compact" variant="text">
        <v-btn
          :class="{ 'is-active': editor.isActive('bulletList') }"
          icon="mdi-format-list-bulleted"
          size="small"
          @click="editor.chain().focus().toggleBulletList().run()"
        />
        <v-btn
          :class="{ 'is-active': editor.isActive('orderedList') }"
          icon="mdi-format-list-numbered"
          size="small"
          @click="editor.chain().focus().toggleOrderedList().run()"
        />
      </v-btn-group>

      <v-divider vertical class="mx-2" />

      <v-btn-group density="compact" variant="text">
        <v-btn
          :class="{ 'is-active': editor.isActive('blockquote') }"
          icon="mdi-format-quote-close"
          size="small"
          @click="editor.chain().focus().toggleBlockquote().run()"
        />
        <v-btn
          icon="mdi-minus"
          size="small"
          @click="editor.chain().focus().setHorizontalRule().run()"
        />
      </v-btn-group>

      <v-spacer />

      <v-btn
        icon="mdi-undo"
        size="small"
        variant="text"
        :disabled="!editor.can().undo()"
        @click="editor.chain().focus().undo().run()"
      />
      <v-btn
        icon="mdi-redo"
        size="small"
        variant="text"
        :disabled="!editor.can().redo()"
        @click="editor.chain().focus().redo().run()"
      />
    </div>

    <!-- Editor Content -->
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: props.placeholder || 'Start writing...',
    }),
    Link.configure({
      openOnClick: false,
    }),
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(() => props.modelValue, (value) => {
  if (editor.value && editor.value.getHTML() !== value) {
    editor.value.commands.setContent(value, { emitUpdate: false })
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
.rich-text-editor {
  border: 1px solid rgba(var(--v-theme-outline), 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(var(--v-theme-surface), 0.5);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.2);
  background: rgba(var(--v-theme-surface-variant), 0.3);
  flex-wrap: wrap;
  gap: 4px;
}

.editor-toolbar .v-btn.is-active {
  background: rgba(var(--v-theme-primary), 0.2);
  color: rgb(var(--v-theme-primary));
}

.editor-content {
  min-height: 250px;
  max-height: 600px;
  overflow-y: auto;
  resize: vertical;
}

.editor-content :deep(.tiptap) {
  padding: 16px;
  outline: none;
  min-height: 200px;
}

.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: rgba(var(--v-theme-on-surface), 0.4);
  pointer-events: none;
  height: 0;
}

.editor-content :deep(.tiptap h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1em 0 0.5em;
}

.editor-content :deep(.tiptap h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1em 0 0.5em;
}

.editor-content :deep(.tiptap ul),
.editor-content :deep(.tiptap ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.editor-content :deep(.tiptap blockquote) {
  border-left: 3px solid rgb(var(--v-theme-primary));
  padding-left: 1em;
  margin: 1em 0;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.editor-content :deep(.tiptap hr) {
  border: none;
  border-top: 1px solid rgba(var(--v-theme-outline), 0.3);
  margin: 1.5em 0;
}

.editor-content :deep(.tiptap a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}
</style>
