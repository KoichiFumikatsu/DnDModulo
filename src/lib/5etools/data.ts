// Fetch de datos desde 5etools (CDN oficial)
const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master/data'

export type ClassMap = Record<string, string[]>

let racesCache: string[] | null = null
let backgroundsCache: string[] | null = null
let classesCache: ClassMap | null = null

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

// Fetch classes + subclasses from 5etools (class/*.json)
export async function fetchClasses(): Promise<ClassMap> {
  if (classesCache) return classesCache
  try {
    const indexRes = await fetch(`${BASE}/class/index.json`)
    const index: Record<string, string> = await indexRes.json()

    // Fetch all class files in parallel
    const entries = Object.entries(index)
    const results = await Promise.all(
      entries.map(async ([, file]) => {
        const res = await fetch(`${BASE}/class/${file}`)
        return res.json()
      })
    )

    const map: ClassMap = {}
    for (const json of results) {
      // Take PHB classes only (skip XPHB duplicates, sidekick, mystic)
      for (const cls of json.class ?? []) {
        if (cls.source !== 'PHB' || !cls.name) continue
        if (!map[cls.name]) map[cls.name] = []
      }
      // Collect subclasses for PHB classes
      for (const sc of json.subclass ?? []) {
        if (!sc.name || !sc.className) continue
        if (!map[sc.className]) continue
        // Dedupe
        if (!map[sc.className].includes(sc.name)) {
          map[sc.className].push(sc.name)
        }
      }
    }

    // Sort subclasses
    for (const key of Object.keys(map)) {
      map[key].sort()
    }

    classesCache = map
    return classesCache
  } catch {
    return FALLBACK_CLASSES
  }
}

const FALLBACK_CLASSES: ClassMap = {
  'Artificer': ['Alchemist', 'Armorer', 'Artillerist', 'Battle Smith'],
  'Barbarian': ['Berserker', 'Totem Warrior', 'Ancestral Guardian', 'Storm Herald', 'Zealot', 'Beast', 'Wild Magic'],
  'Bard': ['Lore', 'Valor', 'Glamour', 'Swords', 'Whispers', 'Creation', 'Eloquence'],
  'Cleric': ['Knowledge', 'Life', 'Light', 'Nature', 'Tempest', 'Trickery', 'War', 'Forge', 'Grave', 'Order', 'Peace', 'Twilight'],
  'Druid': ['Land', 'Moon', 'Dreams', 'Shepherd', 'Spores', 'Stars', 'Wildfire'],
  'Fighter': ['Champion', 'Battle Master', 'Eldritch Knight', 'Arcane Archer', 'Cavalier', 'Samurai', 'Echo Knight', 'Psi Warrior', 'Rune Knight'],
  'Monk': ['Open Hand', 'Shadow', 'Four Elements', 'Drunken Master', 'Kensei', 'Sun Soul', 'Mercy', 'Astral Self', 'Ascendant Dragon'],
  'Paladin': ['Devotion', 'Ancients', 'Vengeance', 'Conquest', 'Redemption', 'Glory', 'Watchers', 'Oathbreaker'],
  'Ranger': ['Hunter', 'Beast Master', 'Gloom Stalker', 'Horizon Walker', 'Monster Slayer', 'Fey Wanderer', 'Swarmkeeper', 'Drakewarden'],
  'Rogue': ['Thief', 'Assassin', 'Arcane Trickster', 'Inquisitive', 'Mastermind', 'Scout', 'Swashbuckler', 'Phantom', 'Soulknife'],
  'Sorcerer': ['Draconic Bloodline', 'Wild Magic', 'Divine Soul', 'Shadow Magic', 'Storm Sorcery', 'Aberrant Mind', 'Clockwork Soul'],
  'Warlock': ['Archfey', 'Fiend', 'Great Old One', 'Celestial', 'Hexblade', 'Fathomless', 'Genie', 'Undead'],
  'Wizard': ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation', 'Bladesinging', 'War Magic', 'Chronurgy', 'Graviturgy', 'Order of Scribes'],
}
