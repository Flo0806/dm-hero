<template>
  <v-dialog v-model="dialog" max-width="720" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-robot-happy-outline" color="primary" />
        {{ $t('connectAi.title') }}
      </v-card-title>

      <v-card-text style="max-height: 70vh">
        <p class="text-body-medium text-medium-emphasis mb-4">
          {{ $t('connectAi.intro') }}
        </p>

        <v-alert
          v-if="info && !info.mcpAvailable"
          type="warning"
          variant="tonal"
          density="comfortable"
          class="mb-4"
        >
          {{ $t('connectAi.notBuilt') }}
          <pre class="connect-cmd mt-2">pnpm --filter @dm-hero/mcp build</pre>
        </v-alert>

        <v-tabs v-model="tab" density="comfortable" class="mb-3">
          <v-tab value="claude-code">Claude Code</v-tab>
          <v-tab value="claude-desktop">Claude Desktop</v-tab>
          <v-tab value="cursor">Cursor</v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <v-window-item value="claude-code">
            <p class="text-body-small mb-2">{{ $t('connectAi.claudeCode') }}</p>
            <DashboardConnectCopyBlock :text="claudeCodeCmd" />
          </v-window-item>

          <v-window-item value="claude-desktop">
            <p class="text-body-small mb-2">
              {{ $t('connectAi.claudeDesktop') }}
              <code>claude_desktop_config.json</code>
            </p>
            <DashboardConnectCopyBlock :text="jsonConfig" />
          </v-window-item>

          <v-window-item value="cursor">
            <p class="text-body-small mb-2">
              {{ $t('connectAi.cursor') }} <code>.cursor/mcp.json</code>
            </p>
            <DashboardConnectCopyBlock :text="jsonConfig" />
          </v-window-item>
        </v-window>

        <div class="text-body-small text-medium-emphasis mt-3">
          <strong>{{ $t('connectAi.appUrl') }}:</strong> <code>{{ appUrl }}</code>
        </div>

        <v-alert
          type="info"
          variant="tonal"
          prominent
          icon="mdi-restart"
          class="mt-4"
        >
          <div class="font-weight-medium">{{ $t('connectAi.afterConnectTitle') }}</div>
          <div class="text-body-small mt-1">{{ $t('connectAi.afterConnect') }}</div>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">{{ $t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
interface McpInfo { appUrl: string, mcpPath: string | null, mcpAvailable: boolean, isElectron: boolean }

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const dialog = computed({
  get: () => props.show,
  set: v => emit('update:show', v),
})

const tab = ref('claude-code')
const info = ref<McpInfo | null>(null)

const appUrl = computed(() => info.value?.appUrl ?? 'http://127.0.0.1:3456')
const mcpPath = computed(() => info.value?.mcpPath ?? '/path/to/dm-hero/packages/mcp/dist/mcp.mjs')

const claudeCodeCmd = computed(() =>
  `claude mcp add --transport stdio dm-hero -- node ${mcpPath.value} ${appUrl.value}`,
)
const jsonConfig = computed(() => JSON.stringify({
  mcpServers: {
    'dm-hero': { command: 'node', args: [mcpPath.value, appUrl.value] },
  },
}, null, 2))

watch(() => props.show, async (open) => {
  if (open && !info.value) {
    try {
      info.value = await $fetch<McpInfo>('/api/import/mcp-info')
    }
    catch {
      // leave nulls → fall back to placeholders
    }
  }
})
</script>

<style scoped>
/* The one-line build hint inside the "not built" alert. */
.connect-cmd {
  background: #11151f;
  color: #d7e0ea;
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  margin: 0;
}
</style>
