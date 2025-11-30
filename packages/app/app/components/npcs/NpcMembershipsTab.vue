<template>
  <div>
    <div class="text-h6 mb-4">
      {{ $t('npcs.factionMemberships') }}
    </div>

    <v-list v-if="memberships.length > 0" class="mb-3">
      <v-list-item v-for="membership in memberships" :key="membership.id" class="mb-2" border>
        <template #prepend>
          <v-icon icon="mdi-shield-account" color="primary" />
        </template>
        <v-list-item-title>
          {{ membership.to_entity_name || membership.name }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <v-chip size="small" class="mr-1">
            {{ translateMembershipType(membership.relation_type) }}
          </v-chip>
          <span
            v-if="membership.notes && typeof membership.notes === 'object' && 'rank' in membership.notes"
            class="text-caption"
          >
            {{ $t('npcs.rank') }}: {{ membership.notes.rank }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            icon="mdi-pencil"
            variant="text"
            size="small"
            @click="$emit('edit', membership)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            size="small"
            color="error"
            @click="$emit('remove', membership.id)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-empty-state
      v-else
      icon="mdi-shield-account-outline"
      :title="$t('npcs.noMemberships')"
      :text="$t('npcs.noMembershipsText')"
    />

    <v-divider class="my-4" />

    <div class="text-h6 mb-4">
      {{ $t('npcs.addFactionMembership') }}
    </div>

    <v-select
      v-model="localFactionId"
      :items="factions"
      item-title="name"
      item-value="id"
      :label="$t('npcs.selectFaction')"
      variant="outlined"
      class="mb-3"
    />

    <v-select
      v-model="localRelationType"
      :items="membershipTypeSuggestions"
      item-title="title"
      item-value="value"
      :label="$t('npcs.membershipType')"
      :placeholder="$t('npcs.membershipTypePlaceholder')"
      variant="outlined"
      class="mb-3"
    />

    <v-text-field
      v-model="localRank"
      :label="$t('npcs.rank')"
      :placeholder="$t('npcs.rankPlaceholder')"
      variant="outlined"
      class="mb-3"
    />

    <v-btn
      color="primary"
      prepend-icon="mdi-link"
      block
      :disabled="!localFactionId || !localRelationType"
      :loading="adding"
      @click="handleAdd"
    >
      {{ $t('npcs.addFactionMembership') }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
const { t, te } = useI18n()

// Translate membership type - check if translation exists, otherwise show raw value
function translateMembershipType(type: string): string {
  const key = `npcs.membershipTypes.${type}`
  return te(key) ? t(key) : type
}

interface Membership {
  id: number
  from_entity_id: number
  to_entity_id: number
  to_entity_name: string
  to_entity_type: string
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  name?: string // Legacy fallback for to_entity_name
}

interface Faction {
  id: number
  name: string
}

interface Props {
  memberships: Membership[]
  factions: Faction[]
  adding: boolean
}

interface Emits {
  (e: 'add', payload: { factionId: number; relationType: string; rank?: string }): void
  (e: 'edit', membership: Membership): void
  (e: 'remove', membershipId: number): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const localFactionId = ref<number | null>(null)
const localRelationType = ref('')
const localRank = ref('')

const membershipTypeSuggestions = computed(() => [
  { title: t('npcs.membershipTypes.member'), value: 'member' },
  { title: t('npcs.membershipTypes.leader'), value: 'leader' },
  { title: t('npcs.membershipTypes.founder'), value: 'founder' },
  { title: t('npcs.membershipTypes.officer'), value: 'officer' },
  { title: t('npcs.membershipTypes.recruit'), value: 'recruit' },
  { title: t('npcs.membershipTypes.veteran'), value: 'veteran' },
  { title: t('npcs.membershipTypes.exile'), value: 'exile' },
])

function handleAdd() {
  if (!localFactionId.value || !localRelationType.value) return

  emit('add', {
    factionId: localFactionId.value,
    relationType: localRelationType.value,
    rank: localRank.value || undefined,
  })

  // Reset form
  localFactionId.value = null
  localRelationType.value = ''
  localRank.value = ''
}
</script>
