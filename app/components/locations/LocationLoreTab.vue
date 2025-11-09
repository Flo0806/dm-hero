<template>
  <div>
    <div class="text-h6 mb-4">{{ $t('locations.linkedLore') }}</div>

    <!-- Add Lore -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-autocomplete
          v-model="selectedLore"
          :items="availableLore"
          item-title="name"
          item-value="id"
          :label="$t('locations.selectLore')"
          :placeholder="$t('locations.selectLorePlaceholder')"
          variant="outlined"
          clearable
          class="mb-2"
        />
        <v-btn color="primary" block :disabled="!selectedLore" @click="handleAdd">
          {{ $t('locations.linkLore') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Linked Lore List -->
    <v-list v-if="linkedLore.length > 0" class="pa-0">
      <v-list-item v-for="lore in linkedLore" :key="lore.id" class="mb-2 px-0">
        <template #prepend>
          <v-avatar size="30" class="mr-2">
            <v-img v-if="lore.image_url" :src="`/uploads/${lore.image_url}`" />
            <v-icon v-else>mdi-book-open-variant</v-icon>
          </v-avatar>
        </template>
        <v-list-item-title>{{ lore.name }}</v-list-item-title>
        <v-list-item-subtitle v-if="lore.description">
          {{ lore.description.substring(0, 100) }}{{ lore.description.length > 100 ? '...' : '' }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', lore.id)"
          />
        </template>
      </v-list-item>
    </v-list>
    <v-empty-state
      v-else
      icon="mdi-book-off"
      :title="$t('locations.noLinkedLore')"
      :text="$t('locations.noLinkedLoreText')"
    />
  </div>
</template>

<script setup lang="ts">
interface Lore {
  id: number
  name: string
  description: string | null
  image_url: string | null
}

interface Props {
  linkedLore: Lore[]
  availableLore: { id: number; name: string }[]
}

defineProps<Props>()

const emit = defineEmits<{
  add: [loreId: number]
  remove: [loreId: number]
}>()

const selectedLore = ref<number | null>(null)

function handleAdd() {
  if (selectedLore.value) {
    emit('add', selectedLore.value)
    selectedLore.value = null
  }
}
</script>

<style scoped>
/* Remove excessive left padding from lists */
:deep(.v-list) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

:deep(.v-list-item) {
  padding-left: 0 !important;
  padding-inline-start: 0 !important;
}

:deep(.v-list-item__prepend) {
  margin-inline-end: 8px !important;
  width: auto !important;
}

:deep(.v-list-item__prepend > .v-avatar) {
  margin-inline-end: 0 !important;
}
</style>
