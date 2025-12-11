// Central NPC icon and color mappings
// Used by NpcCard.vue, NpcEditDialog.vue, and other NPC-related components

export function getNpcTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    ally: 'mdi-account-check',
    enemy: 'mdi-account-alert',
    neutral: 'mdi-account',
    questgiver: 'mdi-script-text',
    merchant: 'mdi-storefront',
    guard: 'mdi-shield-account',
    noble: 'mdi-crown',
    commoner: 'mdi-account',
    villain: 'mdi-account-cancel',
    mentor: 'mdi-school',
    companion: 'mdi-account-multiple',
    informant: 'mdi-ear-hearing',
    innkeeper: 'mdi-glass-mug-variant',
    rival: 'mdi-sword-cross',
    servant: 'mdi-broom',
    slave: 'mdi-handcuffs',
    ruler: 'mdi-crown',
    steward: 'mdi-key-variant',
    spy: 'mdi-incognito',
    healer: 'mdi-medical-bag',
    scholar: 'mdi-book-open-variant',
    craftsman: 'mdi-hammer-wrench',
    priest: 'mdi-cross',
    soldier: 'mdi-sword',
    thief: 'mdi-domino-mask',
    bard: 'mdi-music',
    farmer: 'mdi-sprout',
    hunter: 'mdi-bow-arrow',
    mage: 'mdi-wizard-hat',
    knight: 'mdi-shield-sword',
    assassin: 'mdi-knife-military',
    smuggler: 'mdi-sack',
  }
  return icons[type] || 'mdi-account'
}

export function getNpcStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    alive: 'mdi-heart-pulse',
    dead: 'mdi-skull',
    missing: 'mdi-magnify',
    imprisoned: 'mdi-handcuffs',
    unknown: 'mdi-help-circle',
    undead: 'mdi-skull-outline',
    cursed: 'mdi-ghost',
    petrified: 'mdi-diamond-stone',
    polymorphed: 'mdi-swap-horizontal',
    possessed: 'mdi-ghost',
    banished: 'mdi-exit-run',
    sleeping: 'mdi-sleep',
    retired: 'mdi-home-account',
    charmed: 'mdi-heart',
    paralyzed: 'mdi-human-handsdown',
    blinded: 'mdi-eye-off',
    deafened: 'mdi-ear-hearing-off',
    diseased: 'mdi-virus',
    insane: 'mdi-head-alert',
    exiled: 'mdi-account-arrow-right',
    hiding: 'mdi-eye-off-outline',
    traveling: 'mdi-walk',
    unconscious: 'mdi-sleep',
    resurrected: 'mdi-account-convert',
  }
  return icons[status] || 'mdi-account'
}

export function getNpcStatusColor(status: string): string {
  const colors: Record<string, string> = {
    alive: 'success',
    dead: 'error',
    missing: 'warning',
    imprisoned: 'error',
    unknown: 'grey',
    undead: 'purple',
    cursed: 'purple',
    petrified: 'grey',
    polymorphed: 'info',
    possessed: 'purple',
    banished: 'error',
    sleeping: 'info',
    retired: 'grey',
    charmed: 'pink',
    paralyzed: 'warning',
    blinded: 'warning',
    deafened: 'warning',
    diseased: 'warning',
    insane: 'purple',
    exiled: 'error',
    hiding: 'info',
    traveling: 'info',
    unconscious: 'warning',
    resurrected: 'success',
  }
  return colors[status] || 'grey'
}
