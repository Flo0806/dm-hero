import { STAT_PRESETS } from '../../data/stat-presets'

// List available preset templates with full structure (i18n keys, resolved by client)
export default defineEventHandler(() => {
  return STAT_PRESETS.map(p => ({
    system_key: p.system_key,
    name: p.name,
    description: p.description,
    groups: p.groups.map(g => ({
      name: g.name,
      group_type: g.group_type,
      fields: g.fields.map(f => ({
        name: f.name,
        label: f.label,
        field_type: f.field_type,
        has_modifier: f.has_modifier || false,
      })),
    })),
  }))
})
