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

export interface SpellEntry {
  name: string
  level: number
  school: string
  source: string
  time?: string
  range?: string
  components?: string
  duration?: string
  description?: string
  ritual?: boolean
  concentration?: boolean
}

export interface EquipmentItem {
  name: string
  type: string
  weight?: number
  value?: number
  source: string
  ac?: number
  damage?: string
  damageType?: string
  range?: string
  properties?: string[]
  weaponCategory?: string
  rarity?: string
}

export interface TraitEntry {
  name: string
  description: string
  source: string
}

// ── Caches ──

let racesCache: string[] | null = null
let backgroundsCache: string[] | null = null
let classesCache: ClassMap | null = null
let raceAbilitiesCache: Record<string, RaceAbility> | null = null
let featsCache: Feat[] | null = null
let classDetailsCache: Record<string, ClassDetail> | null = null
let spellsCache: Record<string, SpellEntry[]> = {}
let equipmentCache: EquipmentItem[] | null = null
let raceTraitsCache: Record<string, TraitEntry[]> = {}
let racesJsonCache: { race?: unknown[]; subrace?: unknown[] } | null = null
let classFeaturesCache: Record<string, TraitEntry[]> = {}
let subclassFeaturesCache: Record<string, TraitEntry[]> = {}

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

// ── Helpers ──

const SCHOOL_MAP: Record<string, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
  V: 'Evocation',
}

function flattenEntries(entries: unknown[]): string {
  const parts: string[] = []
  for (const entry of entries) {
    if (typeof entry === 'string') {
      parts.push(entry)
    } else if (typeof entry === 'object' && entry !== null) {
      const obj = entry as Record<string, unknown>
      if (Array.isArray(obj.entries)) {
        parts.push(flattenEntries(obj.entries))
      }
      if (typeof obj.text === 'string') {
        parts.push(obj.text)
      }
      // Handle list items
      if (Array.isArray(obj.items)) {
        for (const item of obj.items) {
          if (typeof item === 'string') {
            parts.push(item)
          } else if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>
            if (typeof itemObj.name === 'string' && typeof itemObj.entry === 'string') {
              parts.push(`${itemObj.name}: ${itemObj.entry}`)
            } else if (Array.isArray(itemObj.entries)) {
              parts.push(flattenEntries(itemObj.entries))
            }
          }
        }
      }
    }
  }
  return parts.join(' ')
}

// ── Spells ──

export async function fetchSpells(className: string): Promise<SpellEntry[]> {
  if (spellsCache[className]) return spellsCache[className]
  try {
    const spellFiles = ['spells-phb.json', 'spells-xphb.json']
    const results = await Promise.all(
      spellFiles.map(async (file) => {
        try {
          const res = await fetch(`${BASE}/spells/${file}`)
          return res.json()
        } catch {
          return { spell: [] }
        }
      })
    )

    const spells: SpellEntry[] = []
    const seen = new Set<string>()

    for (const json of results) {
      for (const s of json.spell ?? []) {
        if (!s.name) continue
        // Check if spell belongs to this class
        const classList = s.classes?.fromClassList
        if (!Array.isArray(classList)) continue
        const match = classList.some(
          (c: { name?: string }) =>
            c.name?.toLowerCase() === className.toLowerCase()
        )
        if (!match) continue
        // Dedupe by name
        if (seen.has(s.name)) continue
        seen.add(s.name)

        spells.push({
          name: s.name,
          level: s.level ?? 0,
          school: SCHOOL_MAP[s.school] ?? s.school ?? 'Unknown',
          source: s.source ?? 'PHB',
          time: Array.isArray(s.time)
            ? s.time.map((t: { number?: number; unit?: string }) => `${t.number ?? ''} ${t.unit ?? ''}`).join(', ').trim()
            : undefined,
          range: s.range?.type === 'point'
            ? (s.range.distance?.type === 'self' ? 'Self' : `${s.range.distance?.amount ?? ''} ${s.range.distance?.type ?? ''}`.trim())
            : s.range?.type ?? undefined,
          components: s.components
            ? [s.components.v ? 'V' : '', s.components.s ? 'S' : '', s.components.m ? 'M' : ''].filter(Boolean).join(', ')
            : undefined,
          duration: Array.isArray(s.duration)
            ? s.duration.map((d: { type?: string; duration?: { amount?: number; type?: string }; concentration?: boolean }) =>
                d.type === 'instant' ? 'Instantaneous'
                : d.type === 'permanent' ? 'Permanent'
                : d.duration ? `${d.concentration ? 'Concentration, ' : ''}${d.duration.amount ?? ''} ${d.duration.type ?? ''}`.trim()
                : d.type ?? ''
              ).join(', ')
            : undefined,
          description: Array.isArray(s.entries) ? flattenEntries(s.entries) : undefined,
          ritual: s.meta?.ritual ?? false,
          concentration: Array.isArray(s.duration)
            ? s.duration.some((d: { concentration?: boolean }) => d.concentration === true)
            : false,
        })
      }
    }

    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    spellsCache[className] = spells
    return spells
  } catch {
    return FALLBACK_SPELLS
  }
}

// ── Equipment Items ──

export async function fetchEquipmentItems(): Promise<EquipmentItem[]> {
  if (equipmentCache) return equipmentCache
  try {
    const res = await fetch(`${BASE}/items-base.json`)
    const json = await res.json()
    const items: EquipmentItem[] = []

    for (const item of json.baseitem ?? json.item ?? []) {
      if (!item.name || item.source !== 'PHB') continue
      items.push({
        name: item.name,
        type: item.type ?? 'Other',
        weight: item.weight ?? undefined,
        value: typeof item.value === 'number' ? item.value / 100 : undefined,
        source: item.source,
        ac: item.ac ?? undefined,
        damage: item.dmg1 ?? undefined,
        damageType: item.dmgType ?? undefined,
        range: item.range ? `${item.range}` : undefined,
        properties: Array.isArray(item.property) ? item.property : undefined,
        weaponCategory: item.weaponCategory ?? undefined,
        rarity: item.rarity ?? undefined,
      })
    }

    items.sort((a, b) => a.name.localeCompare(b.name))
    equipmentCache = items
    return equipmentCache
  } catch {
    return FALLBACK_EQUIPMENT
  }
}

// ── Race Traits ──

async function getRacesJson(): Promise<{ race?: unknown[]; subrace?: unknown[] }> {
  if (racesJsonCache) return racesJsonCache
  const res = await fetch(`${BASE}/races.json`)
  racesJsonCache = await res.json()
  return racesJsonCache!
}

export async function fetchRaceTraits(raceName: string): Promise<TraitEntry[]> {
  if (raceTraitsCache[raceName]) return raceTraitsCache[raceName]
  try {
    const json = await getRacesJson()
    const traits: TraitEntry[] = []
    const lowerName = raceName.toLowerCase()

    // Search main races
    for (const r of (json.race ?? []) as Record<string, unknown>[]) {
      if ((r.name as string)?.toLowerCase() !== lowerName) continue
      if (Array.isArray(r.entries)) {
        for (const entry of r.entries) {
          if (typeof entry === 'object' && entry !== null) {
            const obj = entry as Record<string, unknown>
            if (obj.type === 'entries' && typeof obj.name === 'string' && Array.isArray(obj.entries)) {
              traits.push({
                name: obj.name,
                description: flattenEntries(obj.entries),
                source: (r.source as string) ?? 'PHB',
              })
            }
          }
        }
      }
      break
    }

    // Search subraces (format: "SubraceName (RaceName)")
    const subraceMatch = raceName.match(/^(.+?)\s*\((.+)\)$/)
    if (subraceMatch) {
      const [, srName, baseRace] = subraceMatch
      // First get base race traits
      const baseTraits = await fetchRaceTraits(baseRace)
      traits.push(...baseTraits)

      for (const sr of (json.subrace ?? []) as Record<string, unknown>[]) {
        if (
          (sr.name as string)?.toLowerCase() === srName.toLowerCase() &&
          (sr.raceName as string)?.toLowerCase() === baseRace.toLowerCase()
        ) {
          if (Array.isArray(sr.entries)) {
            for (const entry of sr.entries) {
              if (typeof entry === 'object' && entry !== null) {
                const obj = entry as Record<string, unknown>
                if (obj.type === 'entries' && typeof obj.name === 'string' && Array.isArray(obj.entries)) {
                  traits.push({
                    name: obj.name,
                    description: flattenEntries(obj.entries),
                    source: (sr.source as string) ?? 'PHB',
                  })
                }
              }
            }
          }
          break
        }
      }
    }

    raceTraitsCache[raceName] = traits
    return traits
  } catch {
    return FALLBACK_RACE_TRAITS
  }
}

// ── Class Features ──

export async function fetchClassFeatures(className: string, level: number): Promise<TraitEntry[]> {
  const cacheKey = className
  if (classFeaturesCache[cacheKey]) {
    return classFeaturesCache[cacheKey].filter(
      (_, idx) => idx < classFeaturesCache[cacheKey].length
    )
  }
  try {
    const indexRes = await fetch(`${BASE}/class/index.json`)
    const index: Record<string, string> = await indexRes.json()

    // Find the file for this class
    const classKey = Object.keys(index).find(
      (k) => k.toLowerCase() === className.toLowerCase()
    )
    if (!classKey) return FALLBACK_CLASS_FEATURES

    const res = await fetch(`${BASE}/class/${index[classKey]}`)
    const json = await res.json()
    const allTraits: TraitEntry[] = []

    for (const cf of json.classFeature ?? []) {
      if (!cf.name || !cf.className) continue
      if (cf.className.toLowerCase() !== className.toLowerCase()) continue
      if (cf.source !== 'PHB' && cf.classSource !== 'PHB') continue
      if (typeof cf.level !== 'number') continue

      if (Array.isArray(cf.entries)) {
        allTraits.push({
          name: `${cf.name} (Level ${cf.level})`,
          description: flattenEntries(cf.entries),
          source: cf.source ?? 'PHB',
        })
      }
    }

    classFeaturesCache[cacheKey] = allTraits

    // Return only up to the requested level
    return allTraits.filter((t) => {
      const levelMatch = t.name.match(/\(Level (\d+)\)/)
      return levelMatch ? parseInt(levelMatch[1], 10) <= level : true
    })
  } catch {
    return FALLBACK_CLASS_FEATURES
  }
}

// ── Subclass Features ──

export async function fetchSubclassFeatures(
  className: string,
  subclassName: string,
  level: number
): Promise<TraitEntry[]> {
  const cacheKey = `${className}::${subclassName}`
  if (subclassFeaturesCache[cacheKey]) {
    return subclassFeaturesCache[cacheKey].filter((t) => {
      const levelMatch = t.name.match(/\(Level (\d+)\)/)
      return levelMatch ? parseInt(levelMatch[1], 10) <= level : true
    })
  }
  try {
    const indexRes = await fetch(`${BASE}/class/index.json`)
    const index: Record<string, string> = await indexRes.json()

    const classKey = Object.keys(index).find(
      (k) => k.toLowerCase() === className.toLowerCase()
    )
    if (!classKey) return FALLBACK_SUBCLASS_FEATURES

    const res = await fetch(`${BASE}/class/${index[classKey]}`)
    const json = await res.json()
    const allTraits: TraitEntry[] = []

    for (const sf of json.subclassFeature ?? []) {
      if (!sf.name || !sf.className || !sf.subclassShortName) continue
      if (sf.className.toLowerCase() !== className.toLowerCase()) continue
      if (
        sf.subclassShortName.toLowerCase() !== subclassName.toLowerCase() &&
        sf.subclassSource !== subclassName
      ) continue
      if (typeof sf.level !== 'number') continue

      if (Array.isArray(sf.entries)) {
        allTraits.push({
          name: `${sf.name} (Level ${sf.level})`,
          description: flattenEntries(sf.entries),
          source: sf.source ?? 'PHB',
        })
      }
    }

    subclassFeaturesCache[cacheKey] = allTraits

    return allTraits.filter((t) => {
      const levelMatch = t.name.match(/\(Level (\d+)\)/)
      return levelMatch ? parseInt(levelMatch[1], 10) <= level : true
    })
  } catch {
    return FALLBACK_SUBCLASS_FEATURES
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

const FALLBACK_SPELLS: SpellEntry[] = []

const FALLBACK_EQUIPMENT: EquipmentItem[] = [
  { name: 'Longsword', type: 'M', weight: 3, value: 15, source: 'PHB', damage: '1d8', damageType: 'S', weaponCategory: 'martial' },
  { name: 'Shortbow', type: 'R', weight: 2, value: 25, source: 'PHB', damage: '1d6', damageType: 'P', range: '80/320', weaponCategory: 'simple' },
  { name: 'Dagger', type: 'M', weight: 1, value: 2, source: 'PHB', damage: '1d4', damageType: 'P', weaponCategory: 'simple' },
  { name: 'Handaxe', type: 'M', weight: 2, value: 5, source: 'PHB', damage: '1d6', damageType: 'S', weaponCategory: 'simple' },
  { name: 'Shield', type: 'S', weight: 6, value: 10, source: 'PHB', ac: 2 },
  { name: 'Chain Mail', type: 'HA', weight: 55, value: 75, source: 'PHB', ac: 16 },
  { name: 'Leather Armor', type: 'LA', weight: 10, value: 10, source: 'PHB', ac: 11 },
  { name: 'Scale Mail', type: 'MA', weight: 45, value: 50, source: 'PHB', ac: 14 },
  { name: 'Backpack', type: 'G', weight: 5, value: 2, source: 'PHB' },
  { name: 'Rope, Hempen (50 feet)', type: 'G', weight: 10, value: 1, source: 'PHB' },
  { name: 'Torch', type: 'G', weight: 1, value: 0.01, source: 'PHB' },
  { name: 'Rations (1 day)', type: 'G', weight: 2, value: 0.5, source: 'PHB' },
]

const FALLBACK_RACE_TRAITS: TraitEntry[] = []

const FALLBACK_CLASS_FEATURES: TraitEntry[] = []

const FALLBACK_SUBCLASS_FEATURES: TraitEntry[] = []
