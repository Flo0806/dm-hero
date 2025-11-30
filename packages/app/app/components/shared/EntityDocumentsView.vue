<template>
  <div class="pa-4">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="documents.length === 0" class="text-center py-8 text-medium-emphasis">
      {{ emptyMessage }}
    </div>

    <!-- Documents List (READ-ONLY) -->
    <v-expansion-panels v-else variant="accordion">
      <v-expansion-panel v-for="doc in documents" :key="doc.id">
        <v-expansion-panel-title>
          <v-icon start>mdi-file-document</v-icon>
          {{ doc.title }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <MdPreview :model-value="doc.content || ''" language="en-US" />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'

interface Document {
  id: number
  title: string
  content: string
}

interface Props {
  documents: Document[]
  loading?: boolean
  emptyMessage: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
})
</script>
