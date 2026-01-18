<template>
  <v-menu
    v-model="showMenu"
    :style="menuStyle"
    location="bottom start"
    origin="top start"
  >
    <v-list density="compact" nav min-width="200">
      <v-list-subheader>{{ $t('groups.addMember') }}</v-list-subheader>

      <v-list-item
        v-for="entityType in entityTypes"
        :key="entityType.value"
        class="px-2"
        @click="selectType(entityType.value)"
      >
        <template #prepend>
          <v-icon :icon="entityType.icon" size="small" class="mr-2" />
        </template>
        <v-list-item-title class="text-body-2">{{ entityType.title }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface Props {
  modelValue: boolean
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [entityType: string]
}>()

const showMenu = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const menuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${props.position.x}px`,
  top: `${props.position.y}px`,
  zIndex: 2000,
}))

const entityTypes = computed(() => [
  { value: 'NPC', title: t('npcs.title'), icon: 'mdi-account' },
  { value: 'Location', title: t('locations.title'), icon: 'mdi-map-marker' },
  { value: 'Item', title: t('items.title'), icon: 'mdi-sword' },
  { value: 'Faction', title: t('factions.title'), icon: 'mdi-shield-account' },
  { value: 'Lore', title: t('lore.title'), icon: 'mdi-book-open-variant' },
  { value: 'Player', title: t('players.title'), icon: 'mdi-account-star' },
])

function selectType(entityType: string) {
  emit('select', entityType)
  showMenu.value = false
}
</script>
