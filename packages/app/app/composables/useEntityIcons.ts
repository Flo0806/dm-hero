// Shared icon mappings for entity types

// Item type icons
const ITEM_TYPE_ICONS: Record<string, string> = {
  // Weapons & Armor
  weapon: 'mdi-sword',
  armor: 'mdi-shield',
  ammunition: 'mdi-arrow-projectile-multiple',
  // Magic Items
  potion: 'mdi-bottle-tonic',
  scroll: 'mdi-script-text',
  artifact: 'mdi-star-circle',
  magical: 'mdi-auto-fix',
  // Quest & Special
  quest_item: 'mdi-exclamation-thick',
  key: 'mdi-key-variant',
  map: 'mdi-map',
  // Consumables
  consumable: 'mdi-fire',
  food: 'mdi-food-drumstick',
  drink: 'mdi-glass-mug-variant',
  poison: 'mdi-skull-crossbones',
  // Tools & Equipment
  tool: 'mdi-hammer-wrench',
  lantern: 'mdi-flashlight',
  rope: 'mdi-hook',
  container: 'mdi-package-variant',
  bag: 'mdi-bag-personal',
  // Valuables
  treasure: 'mdi-treasure-chest',
  gem: 'mdi-diamond-stone',
  jewelry: 'mdi-ring',
  currency: 'mdi-currency-usd',
  // Clothing & Accessories
  clothing: 'mdi-tshirt-crew',
  // Materials & Components
  mundane: 'mdi-package-variant-closed',
  component: 'mdi-beaker',
  material: 'mdi-cube-outline',
  // Vehicles & Mounts
  mount: 'mdi-horse',
  vehicle: 'mdi-carriage-passenger-door',
  // Decorative & Religious
  figurine: 'mdi-chess-knight',
  idol: 'mdi-account-box',
  totem: 'mdi-totem-pole',
  relic: 'mdi-cross',
  banner: 'mdi-flag',
  // Magical Objects
  orb: 'mdi-circle',
  horn: 'mdi-bugle',
  mirror: 'mdi-mirror-rectangle',
  crystal: 'mdi-rhombus-medium',
  // Traps & Dangers
  trap: 'mdi-alert-circle',
}

// Location type icons
const LOCATION_TYPE_ICONS: Record<string, string> = {
  // Settlements
  city: 'mdi-city',
  town: 'mdi-home-city',
  village: 'mdi-home-group',
  // Fortifications
  castle: 'mdi-castle',
  fortress: 'mdi-shield-home',
  tower: 'mdi-tower-fire',
  // Underground
  dungeon: 'mdi-gate',
  cave: 'mdi-tunnel',
  mine: 'mdi-pickaxe',
  crypt: 'mdi-coffin',
  // Nature
  forest: 'mdi-pine-tree',
  mountain: 'mdi-image-filter-hdr',
  river: 'mdi-waves',
  lake: 'mdi-water',
  swamp: 'mdi-sprout',
  desert: 'mdi-weather-sunny',
  island: 'mdi-island',
  valley: 'mdi-terrain',
  coast: 'mdi-beach',
  oasis: 'mdi-palm-tree',
  glacier: 'mdi-snowflake',
  volcano: 'mdi-fire',
  canyon: 'mdi-image-filter-hdr',
  plains: 'mdi-grass',
  jungle: 'mdi-tree',
  waterfall: 'mdi-waterfall',
  // Religious
  temple: 'mdi-temple-buddhist',
  shrine: 'mdi-candelabra-fire',
  monastery: 'mdi-church',
  // Ruins & Historic
  ruins: 'mdi-pillar',
  monument: 'mdi-pillar',
  graveyard: 'mdi-grave-stone',
  battlefield: 'mdi-sword-cross',
  arena: 'mdi-stadium',
  // Commerce & Services
  tavern: 'mdi-glass-mug-variant',
  shop: 'mdi-store',
  guild: 'mdi-account-group',
  // Infrastructure
  bridge: 'mdi-bridge',
  road: 'mdi-road-variant',
  lighthouse: 'mdi-lighthouse',
  windmill: 'mdi-wind-turbine',
  quarry: 'mdi-shovel',
  // Residential
  farm: 'mdi-barn',
  manor: 'mdi-home-variant',
  palace: 'mdi-domain',
  // Special
  camp: 'mdi-tent',
  portal: 'mdi-creation',
}

// Location type colors
const LOCATION_TYPE_COLORS: Record<string, string> = {
  // Settlements - purple tones
  city: 'purple',
  town: 'purple-lighten-1',
  village: 'purple-lighten-2',
  // Fortifications - blue-grey
  castle: 'blue-grey',
  fortress: 'blue-grey-darken-1',
  tower: 'blue-grey-lighten-1',
  // Underground - brown/dark
  dungeon: 'brown-darken-1',
  cave: 'brown',
  mine: 'brown-lighten-1',
  crypt: 'grey-darken-2',
  // Nature - green tones
  forest: 'green-darken-2',
  mountain: 'grey',
  river: 'blue',
  lake: 'blue-lighten-1',
  swamp: 'teal-darken-2',
  desert: 'amber',
  island: 'cyan',
  valley: 'green-lighten-2',
  coast: 'light-blue',
  oasis: 'teal',
  glacier: 'light-blue-lighten-2',
  volcano: 'deep-orange',
  canyon: 'orange-darken-1',
  plains: 'lime',
  jungle: 'green-darken-3',
  waterfall: 'blue-darken-1',
  // Religious - gold/yellow
  temple: 'amber-darken-1',
  shrine: 'amber-lighten-1',
  monastery: 'amber',
  // Ruins & Historic - grey/brown
  ruins: 'grey-darken-1',
  monument: 'grey',
  graveyard: 'grey-darken-3',
  battlefield: 'red-darken-2',
  arena: 'red',
  // Commerce - teal
  tavern: 'orange',
  shop: 'teal-lighten-1',
  guild: 'indigo',
  // Infrastructure - grey
  bridge: 'grey-darken-1',
  road: 'grey-lighten-1',
  lighthouse: 'yellow-darken-2',
  windmill: 'brown-lighten-2',
  quarry: 'grey',
  // Residential - warm tones
  farm: 'green-lighten-1',
  manor: 'deep-purple-lighten-1',
  palace: 'deep-purple',
  // Special
  camp: 'orange-lighten-1',
  portal: 'pink',
}

export function useEntityIcons() {
  /**
   * Get icon for item type
   * @param type - Item type (e.g., 'weapon', 'potion', 'armor')
   * @param fallback - Fallback icon if type not found (default: 'mdi-sword')
   */
  function getItemTypeIcon(type: string | null | undefined, fallback = 'mdi-sword'): string {
    if (!type) return fallback
    return ITEM_TYPE_ICONS[type.toLowerCase()] || fallback
  }

  /**
   * Get icon for location type
   * @param type - Location type (e.g., 'city', 'forest', 'dungeon')
   * @param fallback - Fallback icon if type not found (default: 'mdi-map-marker')
   */
  function getLocationTypeIcon(type: string | null | undefined, fallback = 'mdi-map-marker'): string {
    if (!type) return fallback
    return LOCATION_TYPE_ICONS[type.toLowerCase()] || fallback
  }

  /**
   * Get color for location type
   * @param type - Location type
   * @param fallback - Fallback color if type not found (default: 'primary')
   */
  function getLocationTypeColor(type: string | null | undefined, fallback = 'primary'): string {
    if (!type) return fallback
    return LOCATION_TYPE_COLORS[type.toLowerCase()] || fallback
  }

  return {
    getItemTypeIcon,
    getLocationTypeIcon,
    getLocationTypeColor,
    ITEM_TYPE_ICONS,
    LOCATION_TYPE_ICONS,
    LOCATION_TYPE_COLORS,
  }
}
