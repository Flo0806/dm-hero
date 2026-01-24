<template>
  <GroupEditDialog
    :show="modelValue"
    @update:show="emit('update:modelValue', $event)"
    @created="handleCreated"
  />
</template>

<script setup lang="ts">
import type { EntityGroup } from '~~/types/group'
import GroupEditDialog from './GroupEditDialog.vue'

interface Props {
  modelValue: boolean
  entityId: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  done: [group: EntityGroup]
}>()

const snackbarStore = useSnackbarStore()
const { t } = useI18n()

async function handleCreated(group: EntityGroup) {
  // Add the entity to the newly created group
  if (props.entityId && group.id) {
    try {
      await $fetch(`/api/groups/${group.id}/members`, {
        method: 'POST',
        body: { entityIds: [props.entityId] },
      })
      snackbarStore.success(t('groups.entityAddedToNewGroup', { groupName: group.name }))
    } catch (e) {
      console.error('[GroupCreateForEntityDialog] Failed to add entity to group:', e)
    }
  }
  emit('done', group)
}
</script>
