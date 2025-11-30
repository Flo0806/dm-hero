<template>
  <v-dialog :model-value="modelValue" max-width="800" :persistent="saving || uploadingImage || generatingImage" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>
        {{ faction ? $t('factions.edit') : $t('factions.create') }}
      </v-card-title>

      <v-tabs v-if="faction" v-model="activeTab" class="mb-4">
        <v-tab value="details">
          <v-icon start>mdi-shield-account</v-icon>
          {{ $t('factions.details') }}
        </v-tab>
        <v-tab value="images">
          <v-icon start>mdi-image-multiple</v-icon>
          {{ $t('common.images') }} ({{ faction._counts?.images ?? 0 }})
        </v-tab>
        <v-tab value="documents">
          <v-icon start>mdi-file-document</v-icon>
          {{ $t('documents.title') }} ({{ faction._counts?.documents ?? 0 }})
        </v-tab>
        <v-tab value="members">
          <v-icon start>mdi-account-group</v-icon>
          {{ $t('factions.members') }} ({{ factionMembers.length }})
        </v-tab>
        <v-tab value="items">
          <v-icon start>mdi-treasure-chest</v-icon>
          {{ $t('items.title') }} ({{ linkedItems.length }})
        </v-tab>
        <v-tab value="locations">
          <v-icon start>mdi-map-marker</v-icon>
          {{ $t('factions.locations') }} ({{ factionLocations.length }})
        </v-tab>
        <v-tab value="lore">
          <v-icon start>mdi-book-open-variant</v-icon>
          {{ $t('lore.title') }} ({{ linkedLore.length }})
        </v-tab>
      </v-tabs>

      <v-card-text style="max-height: 600px; overflow-y: auto">
        <v-tabs-window v-if="faction" v-model="activeTab">
          <!-- Details Tab -->
          <v-tabs-window-item value="details">
            <slot name="details-tab" :form="form" :faction="faction" />
          </v-tabs-window-item>

          <!-- Images Tab -->
          <v-tabs-window-item value="images">
            <slot name="images-tab" :faction="faction" />
          </v-tabs-window-item>

          <!-- Documents Tab -->
          <v-tabs-window-item value="documents">
            <slot name="documents-tab" :faction="faction" />
          </v-tabs-window-item>

          <!-- Members Tab -->
          <v-tabs-window-item value="members">
            <slot
              name="members-tab"
              :members="factionMembers"
              :loading-members="loadingMembers"
            />
          </v-tabs-window-item>

          <!-- Items Tab -->
          <v-tabs-window-item value="items">
            <slot name="items-tab" :items="linkedItems" />
          </v-tabs-window-item>

          <!-- Locations Tab -->
          <v-tabs-window-item value="locations">
            <slot name="locations-tab" :locations="factionLocations" :loading-locations="loadingLocations" />
          </v-tabs-window-item>

          <!-- Lore Tab -->
          <v-tabs-window-item value="lore">
            <slot name="lore-tab" :lore="linkedLore" />
          </v-tabs-window-item>
        </v-tabs-window>

        <!-- Create Mode: Only show details form -->
        <div v-else>
          <slot name="create-form" :form="form" />
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="$emit('update:modelValue', false)">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" variant="flat" :loading="saving" @click="$emit('save', form)">
          {{ faction ? $t('common.save') : $t('common.create') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { Faction } from '../../../types/faction'

interface FactionForm {
  name: string
  description: string
  leaderId: number | null
  metadata: {
    type: string
    alignment: string
    headquarters: string
    goals: string
    notes: string
  }
}

interface FactionMember {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  npc_name: string
}

interface FactionLocation {
  id: number
  from_entity_id: number
  to_entity_id: number
  relation_type: string
  notes: Record<string, unknown> | null
  created_at: string
  location_name: string
}

interface Props {
  modelValue: boolean
  faction?: Faction | null
  form: FactionForm
  saving?: boolean
  uploadingImage?: boolean
  generatingImage?: boolean
  factionMembers?: FactionMember[]
  loadingMembers?: boolean
  linkedItems?: Array<{
    id: number
    name: string
    description: string | null
    image_url: string | null
    direction?: 'outgoing' | 'incoming'
  }>
  factionLocations?: FactionLocation[]
  loadingLocations?: boolean
  linkedLore?: Array<{
    id: number
    name: string
    description: string | null
    image_url: string | null
  }>
}

const props = withDefaults(defineProps<Props>(), {
  faction: null,
  saving: false,
  uploadingImage: false,
  generatingImage: false,
  factionMembers: () => [],
  loadingMembers: false,
  linkedItems: () => [],
  factionLocations: () => [],
  loadingLocations: false,
  linkedLore: () => [],
})

defineEmits<{
  'update:modelValue': [value: boolean]
  save: [form: FactionForm]
}>()

const activeTab = ref('details')

// Reset tab when dialog opens/closes
watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.faction) {
    activeTab.value = 'details'
  }
})
</script>
