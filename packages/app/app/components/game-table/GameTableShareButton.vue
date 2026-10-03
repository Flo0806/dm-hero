<template>
  <!-- Share an entity with the players. Only there if the campaign has a game;
       highlighted when it's already shared. -->
  <v-btn
    v-if="store.table"
    icon
    :size="size"
    variant="text"
    :color="shared ? 'primary' : undefined"
    :aria-label="shared ? $t('gameTable.share.shared') : $t('gameTable.share.action')"
    @click.stop="store.openShareDialog(type, entityId, name)"
  >
    <v-icon>{{ shared ? 'mdi-share-variant' : 'mdi-share-variant-outline' }}</v-icon>
    <v-tooltip activator="parent" location="bottom">
      {{ shared ? $t('gameTable.share.shared') : $t('gameTable.share.action') }}
    </v-tooltip>
  </v-btn>
</template>

<script setup lang="ts">
import type { ShareType } from '~~/types/share'

const props = withDefaults(defineProps<{ type: ShareType, entityId: number, name: string, size?: string }>(), { size: 'small' })
const store = useGameTableStore()
const shared = computed(() => !!store.shareOf(props.type, props.entityId))
</script>
