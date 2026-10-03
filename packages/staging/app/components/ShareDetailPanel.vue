<template>
  <article class="p-5 rounded-2xl border border-line bg-surface text-ink" :aria-labelledby="`detail-${share.shareId}`">
    <div class="flex items-start gap-3 mb-4">
      <h2 :id="`detail-${share.shareId}`" class="flex-1 m-0 text-xl font-bold text-primary">
        {{ share.title }}
      </h2>
      <button type="button" class="p-1 border-none bg-transparent text-muted text-2xl leading-none cursor-pointer focus-ring" :aria-label="$t('play.close')" @click="emit('close')">
        ×
      </button>
    </div>
    <img v-if="image" :src="image" :alt="share.title" class="block w-full max-h-[60vh] mb-5 rounded-xl object-contain bg-black/20" />
    <dl class="m-0 flex flex-col gap-4">
      <div v-for="field in textFields" :key="field.key">
        <dt class="text-sm text-muted">
          {{ pickText(field.label, locale) }}
        </dt>
        <!-- Markdown rendered safely: no HTML, no script links -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <dd v-if="field.format === 'markdown'" class="markdown m-0 mt-0.5 leading-relaxed" v-html="renderMarkdown(pickText(field.value, locale))" />
        <dd v-else class="m-0 mt-0.5 leading-relaxed">
          {{ pickText(field.value, locale) }}
        </dd>
      </div>
    </dl>
  </article>
</template>

<script setup lang="ts">
const props = defineProps<{ share: ShareContent }>()
const emit = defineEmits<{ close: [] }>()
const { locale } = useI18n()

// The picture sits on top, the text fields below it
const image = useSharedImage(() => imageOf(props.share)?.image.full)
const textFields = computed(() => props.share.fields.filter((f): f is Exclude<SharedField, ImageField> => f.format !== 'image'))
</script>

<style scoped>
.markdown :deep(p) {
  margin: 0 0 0.6em;
}

.markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 0 0 0.6em;
  padding-left: 1.3em;
}

.markdown :deep(a) {
  color: #d4a574;
}

.markdown :deep(blockquote) {
  margin: 0 0 0.6em;
  padding-left: 0.8em;
  border-left: 3px solid rgba(212, 165, 116, 0.4);
  color: #aaa7a2;
}
</style>
