<template>
  <div class="connect-block">
    <v-btn
      :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
      :color="copied ? 'success' : undefined"
      size="x-small"
      variant="tonal"
      class="connect-copy-btn"
      :title="copied ? 'Copied' : 'Copy'"
      @click="copy"
    />
    <pre class="connect-cmd"><code>{{ text }}</code></pre>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ text: string }>()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
  catch {
    // clipboard blocked — user can select manually
  }
}
</script>

<style scoped>
.connect-block {
  position: relative;
  max-width: 100%;
}
.connect-copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}
.connect-cmd {
  /* Distinct "terminal" surface — darker than the dialog so it reads as code. */
  background: #11151f;
  color: #d7e0ea;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 48px 12px 14px; /* right padding clears the copy button */
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
  max-width: 100%;
  margin: 0;
}
.connect-cmd code {
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
}
.connect-cmd::-webkit-scrollbar {
  height: 8px;
}
.connect-cmd::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 4px;
}
.connect-cmd::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}
</style>
