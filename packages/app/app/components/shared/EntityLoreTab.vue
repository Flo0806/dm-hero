<template>
  <div>
    <!-- Add Lore Section -->
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <v-autocomplete
          v-model="localLoreId"
          :items="availableLore"
          item-title="name"
          item-value="id"
          :label="$t('common.selectLore')"
          :placeholder="$t('common.selectLorePlaceholder')"
          variant="outlined"
          clearable
          :loading="loading"
          class="mb-2"
        />
        <v-btn color="primary" block :disabled="!localLoreId" @click="handleAdd">
          <v-icon start>mdi-link-plus</v-icon>
          {{ $t('common.linkLore') }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Linked Lore List -->
    <v-list v-if="linkedLore.length > 0" class="pa-0">
      <v-list-item v-for="lore in linkedLore" :key="lore.id" class="mb-2" border>
        <template #prepend>
          <v-avatar v-if="lore.image_url" size="48" rounded="lg" class="mr-3">
            <v-img :src="`/uploads/${lore.image_url}`" />
          </v-avatar>
          <v-avatar v-else size="48" rounded="lg" class="mr-3" color="surface-variant">
            <v-icon icon="mdi-book-open-variant" />
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
      :title="$t('common.noLinkedLore')"
      :text="$t('common.noLinkedLoreText')"
    />
  </div>
</template>

<script setup lang="ts">
interface LinkedLore {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
  direction?: 'outgoing' | 'incoming'
}

interface AvailableLore {
  id: number
  name: string
}

interface Props {
  linkedLore: LinkedLore[]
  availableLore: AvailableLore[]
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  add: [loreId: number]
  remove: [loreId: number]
}>()

const localLoreId = ref<number | null>(null)

function handleAdd() {
  if (!localLoreId.value) return

  emit('add', localLoreId.value)
  localLoreId.value = null
}
</script>
