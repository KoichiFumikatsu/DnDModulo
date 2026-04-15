// Fetch de datos desde archivos locales (5etools-v2.26.1)
const BASE = '/api/5etools'

// ── Pre-processed static data (committed to git, works on Vercel) ──
import STATIC_ITEMS from '../5etools-processed/items.json'
import STATIC_SPELLS from '../5etools-processed/spells.json'
import STATIC_RACES from '../5etools-processed/races.json'
import STATIC_BACKGROUNDS from '../5etools-processed/backgrounds.json'
import STATIC_CLASSES from '../5etools-processed/classes.json'
import STATIC_LANGUAGES from '../5etools-processed/languages.json'
import STATIC_FEATS from '../5etools-processed/feats.json'
import STATIC_CLASS_FEATURES from '../5etools-processed/class-features.json'
import STATIC_SUBCLASS_FEATURES from '../5etools-processed/subclass-features.json'
import STATIC_RACE_TRAITS from '../5etools-processed/race-traits.json'

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
  description?: string
}

export interface ClassDetail {
  hitDie: number
  asiLevels: number[]
  subclasses: string[]
  skillChoices?: { from: string[]; count: number } | { any: number }
  savingThrows?: string[]
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
  classes?: string[]
}

export interface EquipmentItem {
  name: string
  type: string
  category: string
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
  isMagic?: boolean
  reqAttune?: string | boolean | null
  contents?: string[]
}

export interface TraitEntry {
  name: string
  description: string
  source: string
}

export interface LanguageGrant {
  fixed: string[]         // automatic languages (e.g. Common, Elvish)
  anyStandard: number     // number of free choices from all languages
  chooseFrom: string[]    // if not empty, choices are restricted to this list
}

/** Returns the language grants for a race/subrace + background combination. */
export function getLanguageGrants(params: {
  race?: string
  subrace?: string
  background?: string
}): { grants: Array<LanguageGrant & { source: string }>; autoFixed: string[] } {
  const db = STATIC_LANGUAGES as {
    races: Record<string, Partial<LanguageGrant>>
    subraces: Record<string, Partial<LanguageGrant>>
    backgrounds: Record<string, Partial<LanguageGrant>>
  }

  const grants: Array<LanguageGrant & { source: string }> = []
  const autoFixed: string[] = []

  function addEntry(entry: Partial<LanguageGrant> | undefined, source: string) {
    if (!entry) return
    const fixed = entry.fixed ?? []
    const anyStandard = entry.anyStandard ?? 0
    const chooseFrom = entry.chooseFrom ?? []
    for (const lang of fixed) {
      if (!autoFixed.includes(lang)) autoFixed.push(lang)
    }
    if (anyStandard > 0 || chooseFrom.length > 0) {
      grants.push({ fixed, anyStandard, chooseFrom, source })
    }
  }

  // Race entry — use subrace data if subrace has its own full entry (it overrides race)
  const subraceKey = params.subrace && params.race
    ? `${params.subrace} (${params.race})`
    : undefined
  const subraceEntry = subraceKey ? db.subraces[subraceKey] : undefined

  if (subraceEntry) {
    addEntry(subraceEntry, `Subraza: ${params.subrace}`)
  } else {
    if (params.race) addEntry(db.races[params.race], `Raza: ${params.race}`)
    if (subraceKey) addEntry(db.subraces[subraceKey], `Subraza: ${params.subrace}`)
  }

  if (params.background) addEntry(db.backgrounds[params.background], `Trasfondo: ${params.background}`)

  return { grants, autoFixed }
}

export const ALL_LANGUAGES: string[] = [
  'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc',
  'Abyssal', 'Aquan', 'Auran', 'Celestial', 'Draconic', 'Deep Speech',
  'Ignan', 'Infernal', 'Primordial', 'Sylvan', 'Terran', 'Undercommon',
]

// ── Caches ──

let racesCache: string[] | null = null
let backgroundsCache: string[] | null = null
let classesCache: ClassMap | null = null
let raceAbilitiesCache: Record<string, RaceAbility> | null = null
let featsCache: Feat[] | null = null
let classDetailsCache: Record<string, ClassDetail> | null = null
let spellsCache: Record<string, SpellEntry[]> = {}
let allSpellsCache: SpellEntry[] | null = null
let equipmentCache: EquipmentItem[] | null = null
let raceTraitsCache: Record<string, TraitEntry[]> = {}
let racesJsonCache: { race?: unknown[]; subrace?: unknown[] } | null = null
let classFeaturesCache: Record<string, TraitEntry[]> = {}
let subclassFeaturesCache: Record<string, TraitEntry[]> = {}
let spellClassLookupCache: Record<string, Set<string>> | null = null
let backgroundSkillsCache: Record<string, string[]> | null = null
let raceSkillsCache: Record<string, { fixed: string[]; choose?: { from: string[]; count: number } }> | null = null

// ── Races (names) ──

export async function fetchRaces(): Promise<string[]> {
  if (racesCache) return racesCache
  racesCache = STATIC_RACES as string[]
  return racesCache
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
  backgroundsCache = STATIC_BACKGROUNDS as string[]
  return backgroundsCache
}

// ── Background Skill Proficiencies ──

export async function fetchBackgroundSkills(): Promise<Record<string, string[]>> {
  if (backgroundSkillsCache) return backgroundSkillsCache
  try {
    const res = await fetch(`${BASE}/backgrounds.json`)
    const json = await res.json()
    const map: Record<string, string[]> = {}
    for (const b of json.background ?? []) {
      if (!b.name || !b.skillProficiencies) continue
      const skills: string[] = []
      for (const entry of b.skillProficiencies) {
        for (const key of Object.keys(entry)) {
          if (key !== 'choose' && key !== 'any' && entry[key] === true) {
            skills.push(key)
          }
        }
      }
      if (skills.length > 0) map[b.name] = skills
    }
    backgroundSkillsCache = map
    return map
  } catch {
    return {}
  }
}

// ── Race Skill Proficiencies ──

export interface RaceSkillProf {
  fixed: string[]
  choose?: { from: string[]; count: number }
  any?: number
}

export async function fetchRaceSkills(): Promise<Record<string, RaceSkillProf>> {
  if (raceSkillsCache) return raceSkillsCache as Record<string, RaceSkillProf>
  try {
    const res = await fetch(`${BASE}/races.json`)
    const json = await res.json()
    const map: Record<string, RaceSkillProf> = {}

    for (const r of [...(json.race ?? []), ...(json.subrace ?? [])]) {
      if (!r.skillProficiencies) continue
      const name = r.raceName ? `${r.name} (${r.raceName})` : r.name
      const entry = r.skillProficiencies[0]
      const prof: RaceSkillProf = { fixed: [] }

      for (const [key, val] of Object.entries(entry)) {
        if (key === 'choose' && typeof val === 'object' && val !== null) {
          const c = val as { from?: string[]; count?: number }
          prof.choose = { from: c.from ?? [], count: c.count ?? 1 }
        } else if (key === 'any' && typeof val === 'number') {
          prof.any = val
        } else if (val === true) {
          prof.fixed.push(key)
        }
      }
      map[name] = prof
    }
    raceSkillsCache = map as Record<string, { fixed: string[]; choose?: { from: string[]; count: number } }>
    return map
  } catch {
    return {}
  }
}

// ── Classes (names + subclasses) ──

export async function fetchClasses(): Promise<ClassMap> {
  if (classesCache) return classesCache
  classesCache = STATIC_CLASSES as ClassMap
  return classesCache
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

        // Skill proficiency choices
        const sp = cls.startingProficiencies?.skills
        let skillChoices: ClassDetail['skillChoices'] = undefined
        if (Array.isArray(sp) && sp.length > 0) {
          const entry = sp[0]
          if (entry.any) {
            skillChoices = { any: entry.any }
          } else if (entry.choose) {
            skillChoices = { from: entry.choose.from ?? [], count: entry.choose.count ?? 1 }
          }
        }

        // Saving throw proficiencies
        const savingThrows: string[] = Array.isArray(cls.proficiency) ? cls.proficiency : []

        map[cls.name] = { hitDie, asiLevels, subclasses, skillChoices, savingThrows }
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
  featsCache = STATIC_FEATS as unknown as Feat[]
  return featsCache
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

export async function fetchAllSpells(): Promise<SpellEntry[]> {
  if (allSpellsCache) return allSpellsCache
  allSpellsCache = STATIC_SPELLS as SpellEntry[]
  return allSpellsCache
}

/** @deprecated kept for reference */
async function _fetchAllSpellsFromAPI(): Promise<SpellEntry[]> {
  try {
    const spellFiles = ['spells-phb.json', 'spells-xphb.json']
    const [lookupRes, ...spellResults] = await Promise.all([
      fetch(`${BASE}/generated/gendata-spell-source-lookup.json`)
        .then(r => r.json())
        .catch(() => ({})),
      ...spellFiles.map(async (file) => {
        try {
          const res = await fetch(`${BASE}/spells/${file}`)
          return res.json()
        } catch {
          return { spell: [] }
        }
      })
    ])

    // Build spell→classes lookup: { "spell name (lowercase)": Set<className> }
    if (!spellClassLookupCache) {
      const lookup: Record<string, Set<string>> = {}
      for (const sourceSpells of Object.values(lookupRes as Record<string, Record<string, { class?: Record<string, Record<string, boolean>> }>>)) {
        for (const [spellName, spellData] of Object.entries(sourceSpells)) {
          const key = spellName.toLowerCase()
          if (!lookup[key]) lookup[key] = new Set()
          if (spellData.class) {
            for (const classSource of Object.values(spellData.class)) {
              for (const className of Object.keys(classSource)) {
                lookup[key].add(className)
              }
            }
          }
        }
      }
      spellClassLookupCache = lookup
    }

    const spells: SpellEntry[] = []
    const seen = new Set<string>()

    for (const json of spellResults) {
      for (const s of (json as { spell?: unknown[] }).spell ?? []) {
        const sp = s as Record<string, unknown>
        if (!sp.name) continue
        const name = sp.name as string
        if (seen.has(name)) continue
        seen.add(name)

        // Get classes from lookup
        const classSet = spellClassLookupCache[name.toLowerCase()]
        const classNames: string[] = classSet ? [...classSet].sort() : []

        spells.push({
          name,
          level: (sp.level as number) ?? 0,
          school: SCHOOL_MAP[sp.school as string] ?? (sp.school as string) ?? 'Unknown',
          source: (sp.source as string) ?? 'PHB',
          time: Array.isArray(sp.time)
            ? sp.time.map((t: { number?: number; unit?: string }) => `${t.number ?? ''} ${t.unit ?? ''}`).join(', ').trim()
            : undefined,
          range: (sp.range as { type?: string; distance?: { type?: string; amount?: number } })?.type === 'point'
            ? ((sp.range as { distance?: { type?: string; amount?: number } }).distance?.type === 'self'
              ? 'Self'
              : `${(sp.range as { distance?: { amount?: number } }).distance?.amount ?? ''} ${(sp.range as { distance?: { type?: string } }).distance?.type ?? ''}`.trim())
            : (sp.range as { type?: string })?.type ?? undefined,
          components: sp.components
            ? [
                (sp.components as { v?: boolean }).v ? 'V' : '',
                (sp.components as { s?: boolean }).s ? 'S' : '',
                (sp.components as { m?: unknown }).m ? 'M' : '',
              ].filter(Boolean).join(', ')
            : undefined,
          duration: Array.isArray(sp.duration)
            ? sp.duration.map((d: { type?: string; duration?: { amount?: number; type?: string }; concentration?: boolean }) =>
                d.type === 'instant' ? 'Instantaneous'
                : d.type === 'permanent' ? 'Permanent'
                : d.duration ? `${d.concentration ? 'Concentration, ' : ''}${d.duration.amount ?? ''} ${d.duration.type ?? ''}`.trim()
                : d.type ?? ''
              ).join(', ')
            : undefined,
          description: Array.isArray(sp.entries) ? flattenEntries(sp.entries as unknown[]) : undefined,
          ritual: (sp.meta as { ritual?: boolean })?.ritual ?? false,
          concentration: Array.isArray(sp.duration)
            ? sp.duration.some((d: { concentration?: boolean }) => d.concentration === true)
            : false,
          classes: classNames,
        })
      }
    }

    spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    allSpellsCache = spells
    return spells
  } catch {
    return []
  }
}

// ── Equipment Items ──

export async function fetchEquipmentItems(): Promise<EquipmentItem[]> {
  if (equipmentCache) return equipmentCache
  equipmentCache = STATIC_ITEMS as unknown as EquipmentItem[]
  return equipmentCache
}

// ── Race Traits ──

export async function fetchRaceTraits(raceName: string): Promise<TraitEntry[]> {
  const db = STATIC_RACE_TRAITS as Record<string, Array<{ name: string; description: string; source: string }>>
  // Try exact match first, then case-insensitive
  const exact = db[raceName]
  if (exact) return exact
  const lower = raceName.toLowerCase()
  const found = Object.entries(db).find(([k]) => k.toLowerCase() === lower)
  return found?.[1] ?? []
}

// ── Class Features ──

export async function fetchClassFeatures(className: string, level: number): Promise<TraitEntry[]> {
  const db = STATIC_CLASS_FEATURES as Record<string, Array<{ name: string; level: number; description: string }>>
  const feats = db[className] ?? []
  return feats
    .filter(f => f.level <= level)
    .map(f => ({ name: `${f.name} (Level ${f.level})`, description: f.description, source: className }))
}

// ── Subclass Features ──

export async function fetchSubclassFeatures(
  className: string,
  subclassName: string,
  level: number
): Promise<TraitEntry[]> {
  const db = STATIC_SUBCLASS_FEATURES as Record<string, Array<{ name: string; level: number; description: string }>>
  // Try exact key, then fuzzy match on subclass name portion
  const exactKey = `${className}::${subclassName}`
  const feats = db[exactKey]
    ?? Object.entries(db).find(([k]) =>
      k.startsWith(`${className}::`) &&
      k.toLowerCase().includes(subclassName.toLowerCase().split(' ').slice(-1)[0])
    )?.[1]
    ?? []
  return feats
    .filter(f => f.level <= level)
    .map(f => ({ name: `${f.name} (Level ${f.level})`, description: f.description, source: subclassName }))
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
  { name: 'Longsword', type: 'M', category: 'weapon', weight: 3, value: 15, source: 'PHB', damage: '1d8', damageType: 'S', weaponCategory: 'martial' },
  { name: 'Shortbow', type: 'R', category: 'weapon', weight: 2, value: 25, source: 'PHB', damage: '1d6', damageType: 'P', range: '80/320', weaponCategory: 'simple' },
  { name: 'Dagger', type: 'M', category: 'weapon', weight: 1, value: 2, source: 'PHB', damage: '1d4', damageType: 'P', weaponCategory: 'simple' },
  { name: 'Handaxe', type: 'M', category: 'weapon', weight: 2, value: 5, source: 'PHB', damage: '1d6', damageType: 'S', weaponCategory: 'simple' },
  { name: 'Shield', type: 'S', category: 'armor', weight: 6, value: 10, source: 'PHB', ac: 2 },
  { name: 'Chain Mail', type: 'HA', category: 'armor', weight: 55, value: 75, source: 'PHB', ac: 16 },
  { name: 'Leather Armor', type: 'LA', category: 'armor', weight: 10, value: 10, source: 'PHB', ac: 11 },
  { name: 'Scale Mail', type: 'MA', category: 'armor', weight: 45, value: 50, source: 'PHB', ac: 14 },
  { name: 'Backpack', type: 'G', category: 'gear', weight: 5, value: 2, source: 'PHB' },
  { name: 'Rope, Hempen (50 feet)', type: 'G', category: 'gear', weight: 10, value: 1, source: 'PHB' },
  { name: 'Torch', type: 'G', category: 'gear', weight: 1, value: 0.01, source: 'PHB' },
  { name: 'Rations (1 day)', type: 'G', category: 'gear', weight: 2, value: 0.5, source: 'PHB' },
]

const FALLBACK_RACE_TRAITS: TraitEntry[] = []

const FALLBACK_CLASS_FEATURES: TraitEntry[] = []

const FALLBACK_SUBCLASS_FEATURES: TraitEntry[] = []
