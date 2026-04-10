// Fetch de datos desde 5etools (CDN oficial)
const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master/data'

// ── Types ──

export type ClassMap = Record<string, string[]>

export interface RaceAbility {
  fixed: Partial<Record<string, number>>
  choose?: { from: string[], count: number }
}

export interface Feat {
  name: string
  source: string
  category?: string
  prerequisite?: Array<Record<string, unknown>>
  ability?: Array<Record<string, unknown>>
  entries?: unknown[]
}

export interface ClassDetail {
  hitDie: number
  asiLevels: number[]
  subclasses: string[]
}

// ── Caches ──

let racesCache: string[] | null = null
let backgroundsCache: string[] | null = null
let classesCache: ClassMap | null = null
let raceAbilitiesCache: Record<string, RaceAbility> | null = null
let featsCache: Feat[] | null = null
let classDetailsCache: Record<string, ClassDetail> | null = null

// ── Races (names) ──

export async function fetchRaces(): Promise<string[]> {
  if (racesCache) return racesCache
  try {
    const res = await fetch(`${BASE}/races.json`)
    const json = await res.json()
    const names: string[] = []
    for (const r of json.race ?? []) {
      if (r.name) names.push(r.name)
    }
    for (const r of json.subrace ?? []) {
      if (r.name && r.raceName) names.push(`${r.name} (${r.raceName})`)
    }
    racesCache = [...new Set(names)].sort()
    return racesCache
  } catch {
    return FALLBACK_RACES
  }
}

// ── Race Ability Bonuses ──

export async function fetchRaceAbilities(): Promise<Record<string, RaceAbility>> {
  if (raceAbilitiesCache) return raceAbilitiesCache
  try {
    const res = await fetch(`${BASE}/races.json`)
    const json = await res.json()
    const map: Record<string, RaceAbility> = {}

    for (const r of json.race ?? []) {
      if (!r.name || !r.ability?.length) continue
      map[r.name] = parseAbility(r.ability[0])
    }
    // Subraces: merge with base race
    for (const sr of json.subrace ?? []) {
      if (!sr.name || !sr.raceName) continue
      const key = `${sr.name} (${sr.raceName})`
      const base = map[sr.raceName]
      const sub = sr.ability?.length ? parseAbility(sr.ability[0]) : { fixed: {} }
      // Merge: base fixed + subrace fixed
      const merged: RaceAbility = {
        fixed: { ...(base?.fixed ?? {}), ...sub.fixed },
        choose: sub.choose ?? base?.choose,
      }
      // Sum overlapping keys
      if (base?.fixed) {
        for (const [k, v] of Object.entries(base.fixed)) {
          if (sub.fixed[k]) merged.fixed[k] = (v ?? 0) + (sub.fixed[k] ?? 0)
          else merged.fixed[k] = v
        }
      }
      map[key] = merged
    }

    raceAbilitiesCache = map
    return raceAbilitiesCache
  } catch {
    return FALLBACK_RACE_ABILITIES
  }
}

function parseAbility(ab: Record<string, unknown>): RaceAbility {
  const fixed: Partial<Record<string, number>> = {}
  let choose: RaceAbility['choose'] = undefined
  for (const [key, val] of Object.entries(ab)) {
    if (key === 'choose' && typeof val === 'object' && val !== null) {
      const c = val as { from?: string[], count?: number }
      choose = { from: c.from ?? [], count: c.count ?? 1 }
    } else if (typeof val === 'number') {
      fixed[key] = val
    }
  }
  return { fixed, choose }
}

// ── Backgrounds (names) ──

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

// ── Classes (names + subclasses) ──

export async function fetchClasses(): Promise<ClassMap> {
  if (classesCache) return classesCache
  try {
    const indexRes = await fetch(`${BASE}/class/index.json`)
    const index: Record<string, string> = await indexRes.json()
    const entries = Object.entries(index)
    const results = await Promise.all(
      entries.map(async ([, file]) => {
        const res = await fetch(`${BASE}/class/${file}`)
        return res.json()
      })
    )

    const map: ClassMap = {}
    for (const json of results) {
      for (const cls of json.class ?? []) {
        if (cls.source !== 'PHB' || !cls.name) continue
        if (!map[cls.name]) map[cls.name] = []
      }
      for (const sc of json.subclass ?? []) {
        if (!sc.name || !sc.className) continue
        if (!map[sc.className]) continue
        if (!map[sc.className].includes(sc.name)) {
          map[sc.className].push(sc.name)
        }
      }
    }
    for (const key of Object.keys(map)) map[key].sort()

    classesCache = map
    return classesCache
  } catch {
    return FALLBACK_CLASSES
  }
}

// ── Class Details (hit dice, ASI levels, subclasses) ──

export async function fetchClassDetails(): Promise<Record<string, ClassDetail>> {
  if (classDetailsCache) return classDetailsCache
  try {
    const indexRes = await fetch(`${BASE}/class/index.json`)
    const index: Record<string, string> = await indexRes.json()
    const entries = Object.entries(index)
    const results = await Promise.all(
      entries.map(async ([, file]) => {
        const res = await fetch(`${BASE}/class/${file}`)
        return res.json()
      })
    )

    const map: Record<string, ClassDetail> = {}
    for (const json of results) {
      for (const cls of json.class ?? []) {
        if (cls.source !== 'PHB' || !cls.name) continue
        const hitDie = cls.hd?.faces ?? 8

        // Find ASI levels from classFeature entries
        const asiLevels: number[] = []
        for (const cf of json.classFeature ?? []) {
          if (cf.className === cls.name && cf.classSource === 'PHB' &&
              cf.name === 'Ability Score Improvement' && typeof cf.level === 'number') {
            if (!asiLevels.includes(cf.level)) asiLevels.push(cf.level)
          }
        }
        asiLevels.sort((a, b) => a - b)

        // Subclasses
        const subclasses: string[] = []
        for (const sc of json.subclass ?? []) {
          if (sc.className === cls.name && sc.name && !subclasses.includes(sc.name)) {
            subclasses.push(sc.name)
          }
        }
        subclasses.sort()

        map[cls.name] = { hitDie, asiLevels, subclasses }
      }
    }

    classDetailsCache = map
    return classDetailsCache
  } catch {
    return FALLBACK_CLASS_DETAILS
  }
}

// ── Feats ──

const FEAT_SOURCES = new Set(['PHB', 'XPHB', 'TCE', 'XGE', 'PHB2024'])

export async function fetchFeats(): Promise<Feat[]> {
  if (featsCache) return featsCache
  try {
    const res = await fetch(`${BASE}/feats.json`)
    const json = await res.json()
    const feats: Feat[] = []
    const seen = new Set<string>()

    for (const f of json.feat ?? []) {
      if (!f.name || !FEAT_SOURCES.has(f.source)) continue
      // Dedupe by name (keep first)
      if (seen.has(f.name)) continue
      seen.add(f.name)

      feats.push({
        name: f.name,
        source: f.source,
        category: f.category,
        prerequisite: f.prerequisite,
        ability: f.ability,
        entries: f.entries,
      })
    }

    featsCache = feats.sort((a, b) => a.name.localeCompare(b.name))
    return featsCache
  } catch {
    return FALLBACK_FEATS
  }
}

// ── Fallbacks ──

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

const FALLBACK_RACE_ABILITIES: Record<string, RaceAbility> = {
  'Human': { fixed: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
  'Dwarf': { fixed: { con: 2 } },
  'Elf': { fixed: { dex: 2 } },
  'Halfling': { fixed: { dex: 2 } },
  'Dragonborn': { fixed: { str: 2, cha: 1 } },
  'Gnome': { fixed: { int: 2 } },
  'Half-Elf': { fixed: { cha: 2 }, choose: { from: ['str', 'dex', 'con', 'int', 'wis'], count: 2 } },
  'Half-Orc': { fixed: { str: 2, con: 1 } },
  'Tiefling': { fixed: { cha: 2, int: 1 } },
  'Hill Dwarf (Dwarf)': { fixed: { con: 2, wis: 1 } },
  'Mountain Dwarf (Dwarf)': { fixed: { con: 2, str: 2 } },
  'High Elf (Elf)': { fixed: { dex: 2, int: 1 } },
  'Wood Elf (Elf)': { fixed: { dex: 2, wis: 1 } },
  'Dark Elf (Elf)': { fixed: { dex: 2, cha: 1 } },
  'Lightfoot (Halfling)': { fixed: { dex: 2, cha: 1 } },
  'Stout (Halfling)': { fixed: { dex: 2, con: 1 } },
  'Forest Gnome (Gnome)': { fixed: { int: 2, dex: 1 } },
  'Rock Gnome (Gnome)': { fixed: { int: 2, con: 1 } },
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

const FALLBACK_CLASS_DETAILS: Record<string, ClassDetail> = {
  'Artificer': { hitDie: 8, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Artificer'] },
  'Barbarian': { hitDie: 12, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Barbarian'] },
  'Bard': { hitDie: 8, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Bard'] },
  'Cleric': { hitDie: 8, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Cleric'] },
  'Druid': { hitDie: 8, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Druid'] },
  'Fighter': { hitDie: 10, asiLevels: [4, 6, 8, 12, 14, 16, 19], subclasses: FALLBACK_CLASSES['Fighter'] },
  'Monk': { hitDie: 8, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Monk'] },
  'Paladin': { hitDie: 10, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Paladin'] },
  'Ranger': { hitDie: 10, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Ranger'] },
  'Rogue': { hitDie: 8, asiLevels: [4, 8, 10, 12, 16, 19], subclasses: FALLBACK_CLASSES['Rogue'] },
  'Sorcerer': { hitDie: 6, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Sorcerer'] },
  'Warlock': { hitDie: 8, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Warlock'] },
  'Wizard': { hitDie: 6, asiLevels: [4, 8, 12, 16, 19], subclasses: FALLBACK_CLASSES['Wizard'] },
}

const FALLBACK_FEATS: Feat[] = [
  { name: 'Alert', source: 'PHB' },
  { name: 'Athlete', source: 'PHB', ability: [{ choose: { from: ['str', 'dex'] } }] },
  { name: 'Actor', source: 'PHB', ability: [{ cha: 1 }] },
  { name: 'Charger', source: 'PHB' },
  { name: 'Crossbow Expert', source: 'PHB' },
  { name: 'Defensive Duelist', source: 'PHB', prerequisite: [{ ability: [{ dex: 13 }] }] },
  { name: 'Dual Wielder', source: 'PHB' },
  { name: 'Durable', source: 'PHB', ability: [{ con: 1 }] },
  { name: 'Elemental Adept', source: 'PHB', prerequisite: [{ spellcasting: true }] },
  { name: 'Grappler', source: 'PHB', prerequisite: [{ ability: [{ str: 13 }] }] },
  { name: 'Great Weapon Master', source: 'PHB' },
  { name: 'Healer', source: 'PHB' },
  { name: 'Heavily Armored', source: 'PHB', ability: [{ str: 1 }] },
  { name: 'Heavy Armor Master', source: 'PHB', prerequisite: [{ ability: [{ str: 13 }] }] },
  { name: 'Inspiring Leader', source: 'PHB', prerequisite: [{ ability: [{ cha: 13 }] }] },
  { name: 'Keen Mind', source: 'PHB', ability: [{ int: 1 }] },
  { name: 'Lucky', source: 'PHB' },
  { name: 'Mage Slayer', source: 'PHB' },
  { name: 'Magic Initiate', source: 'PHB' },
  { name: 'Martial Adept', source: 'PHB' },
  { name: 'Medium Armor Master', source: 'PHB' },
  { name: 'Mobile', source: 'PHB' },
  { name: 'Mounted Combatant', source: 'PHB' },
  { name: 'Observant', source: 'PHB', ability: [{ choose: { from: ['int', 'wis'] } }] },
  { name: 'Polearm Master', source: 'PHB' },
  { name: 'Resilient', source: 'PHB', ability: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }] },
  { name: 'Ritual Caster', source: 'PHB' },
  { name: 'Savage Attacker', source: 'PHB' },
  { name: 'Sentinel', source: 'PHB' },
  { name: 'Sharpshooter', source: 'PHB' },
  { name: 'Shield Master', source: 'PHB' },
  { name: 'Skilled', source: 'PHB' },
  { name: 'Skulker', source: 'PHB' },
  { name: 'Spell Sniper', source: 'PHB', prerequisite: [{ spellcasting: true }] },
  { name: 'Tavern Brawler', source: 'PHB', ability: [{ choose: { from: ['str', 'con'] } }] },
  { name: 'Tough', source: 'PHB' },
  { name: 'War Caster', source: 'PHB', prerequisite: [{ spellcasting: true }] },
  { name: 'Weapon Master', source: 'PHB', ability: [{ choose: { from: ['str', 'dex'] } }] },
]
