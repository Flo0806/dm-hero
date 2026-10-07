import type { NavKey } from '~~/types/navigation'

// What each sidebar entry is: icon, label, target. Order comes from the DM's layout.
interface NavItem {
  /** May depend on the music player (note icon while playing) */
  icon: (music: { isPlaying: { value: boolean } }) => string
  title: string
  to?: string
  needsCampaign: boolean
}

const fixed = (icon: string) => () => icon

export const NAV_ITEMS: Record<NavKey, NavItem> = {
  search: { icon: fixed('mdi-magnify'), title: 'nav.search', needsCampaign: true },
  npcs: { icon: fixed('mdi-account-group'), title: 'nav.npcs', to: '/npcs', needsCampaign: true },
  locations: { icon: fixed('mdi-map-marker'), title: 'nav.locations', to: '/locations', needsCampaign: true },
  items: { icon: fixed('mdi-sword'), title: 'nav.items', to: '/items', needsCampaign: true },
  factions: { icon: fixed('mdi-shield'), title: 'nav.factions', to: '/factions', needsCampaign: true },
  lore: { icon: fixed('mdi-book-open-variant'), title: 'nav.lore', to: '/lore', needsCampaign: true },
  players: { icon: fixed('mdi-account-star'), title: 'nav.players', to: '/players', needsCampaign: true },
  sessions: { icon: fixed('mdi-book-open-page-variant'), title: 'nav.sessions', to: '/sessions', needsCampaign: true },
  story: { icon: fixed('mdi-script-text-outline'), title: 'nav.story', to: '/story', needsCampaign: true },
  gameTable: { icon: fixed('mdi-table-furniture'), title: 'nav.gameTable', to: '/game-table', needsCampaign: true },
  encounters: { icon: fixed('mdi-sword-cross'), title: 'nav.encounters', to: '/encounters', needsCampaign: true },
  calendar: { icon: fixed('mdi-calendar'), title: 'calendar.title', to: '/calendar', needsCampaign: true },
  maps: { icon: fixed('mdi-map'), title: 'nav.maps', to: '/maps', needsCampaign: true },
  music: { icon: music => (music.isPlaying.value ? 'mdi-music-note' : 'mdi-music'), title: 'nav.music', to: '/music', needsCampaign: false },
  groups: { icon: fixed('mdi-folder-multiple'), title: 'nav.groups', to: '/groups', needsCampaign: true },
  notes: { icon: fixed('mdi-notebook-outline'), title: 'nav.notes', to: '/notes', needsCampaign: true },
}
