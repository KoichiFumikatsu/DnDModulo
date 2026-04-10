// Fetch de datos desde 5etools (CDN oficial)
const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master/data'

let racesCache: string[] | null = null
let backgroundsCache: string[] | null = null

export async function fetchRaces(): Promise<string[]> {
  if (racesCache) return racesCache
  try {
    const res = await fetch(`${BASE}/races.json`)
    const json = await res.json()
    const names: string[] = []
    for (const r of json.race ?? []) {
      if (r.name) names.push(r.name)
    }
    // Subraces
    for (const r of json.subrace ?? []) {
      if (r.name && r.raceName) names.push(`${r.name} (${r.raceName})`)
    }
    racesCache = [...new Set(names)].sort()
    return racesCache
  } catch {
    return FALLBACK_RACES
  }
}

export async function fetchBackgrounds(): Promise<string[]> {
  if (backgroundsCache) return backgroundsCache
  try {
    const res = await fetch(`${BASE}/backgrounds.json`)
    const json = await res.json()
    const names = (json.background ?? []).map((b: { name: string }) => b.name).filter(Boolean)
    backgroundsCache = [...new Set(names as string[])].sort()
    return backgroundsCache
  } catch {
    return FALLBACK_BACKGROUNDS
  }
}

// Fallback si el fetch falla
const FALLBACK_RACES = [
  'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 'Halfling', 'Human', 'Tiefling',
  'Aarakocra', 'Aasimar', 'Bugbear', 'Centaur', 'Changeling', 'Firbolg', 'Genasi', 'Githyanki',
  'Githzerai', 'Goblin', 'Goliath', 'Hobgoblin', 'Kenku', 'Kobold', 'Lizardfolk', 'Loxodon',
  'Minotaur', 'Orc', 'Satyr', 'Simic Hybrid', 'Tabaxi', 'Tortle', 'Triton', 'Vedalken',
  'Verdan', 'Warforged', 'Yuan-Ti Pureblood',
]

const FALLBACK_BACKGROUNDS = [
  'Acolyte', 'Charlatan', 'Criminal', 'Entertainer', 'Folk Hero', 'Guild Artisan',
  'Hermit', 'Noble', 'Outlander', 'Sage', 'Sailor', 'Soldier', 'Urchin',
  'City Watch', 'Clan Crafter', 'Cloistered Scholar', 'Courtier', 'Faction Agent',
  'Far Traveler', 'Haunted One', 'Inheritor', 'Investigator', 'Knight of the Order',
  'Mercenary Veteran', 'Urban Bounty Hunter', 'Uthgardt Tribe Member', 'Waterdhavian Noble',
]
