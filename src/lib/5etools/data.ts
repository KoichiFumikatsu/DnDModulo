// Fetch de datos desde archivos locales (5etools-v2.26.1)

// â”€â”€ Pre-processed static data (committed to git, works on Vercel) â”€â”€
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
import STATIC_BACKGROUND_SKILLS from '../5etools-processed/background-skills.json'
import STATIC_RACE_SKILLS from '../5etools-processed/race-skills.json'
import STATIC_CLASS_SKILL_CHOICES from '../5etools-processed/class-skill-choices.json'
import STATIC_SUBCLASS_SPELLS from '../5etools-processed/subclass-spells.json'
import STATIC_RACE_ABILITIES from '../5etools-processed/race-abilities.json'

// â”€â”€ Types â”€â”€

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
  // Each entry is { skillName: true } | { choose: { from: string[], count?: number } } | { any: N }
  skillProficiencies?: Array<Record<string, unknown>>
  // Each entry is { skillName: true } | { anyProficientSkill: N } | { choose: ... }
  expertise?: Array<Record<string, unknown>>
  entries?: unknown[]
  description?: string
  grantedSpells?: string[]
}

export interface SubclassSpellGrant {
  spell: string
  minCharLevel: number
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
  damage?: string | null
  healingFormula?: string | null
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

  // Race entry â€” use subrace data if subrace has its own full entry (it overrides race)
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

// â”€â”€ Caches â”€â”€

let racesCache: string[] | null = null
let backgroundsCache: string[] | null = null
let classesCache: ClassMap | null = null
let raceAbilitiesCache: Record<string, RaceAbility> | null = null
let featsCache: Feat[] | null = null
let classDetailsCache: Record<string, ClassDetail> | null = null
const spellsCache: Record<string, SpellEntry[]> = {}
let allSpellsCache: SpellEntry[] | null = null
let equipmentCache: EquipmentItem[] | null = null
let backgroundSkillsCache: Record<string, string[]> | null = null
let raceSkillsCache: Record<string, { fixed: string[]; choose?: { from: string[]; count: number } }> | null = null

// â”€â”€ Races (names) â”€â”€

export async function fetchRaces(): Promise<string[]> {
  if (racesCache) return racesCache
  const raw = STATIC_RACES as unknown as { name: string }[]
  racesCache = Array.isArray(raw) && typeof raw[0] === 'object'
    ? raw.map(r => r.name)
    : STATIC_RACES as unknown as string[]
  return racesCache
}

// â”€â”€ Race Ability Bonuses â”€â”€

export async function fetchRaceAbilities(): Promise<Record<string, RaceAbility>> {
  if (raceAbilitiesCache) return raceAbilitiesCache
  // Merge static race abilities (64 races from 5etools) with fallback for any gaps
  raceAbilitiesCache = { ...FALLBACK_RACE_ABILITIES, ...(STATIC_RACE_ABILITIES as Record<string, RaceAbility>) }
  return raceAbilitiesCache
}

// â”€â”€ Backgrounds (names) â”€â”€

export async function fetchBackgrounds(): Promise<string[]> {
  if (backgroundsCache) return backgroundsCache
  const raw = STATIC_BACKGROUNDS as unknown as { name: string }[]
  backgroundsCache = Array.isArray(raw) && typeof raw[0] === 'object'
    ? raw.map(b => b.name)
    : STATIC_BACKGROUNDS as unknown as string[]
  return backgroundsCache
}

// â”€â”€ Background Skill Proficiencies â”€â”€

export async function fetchBackgroundSkills(): Promise<Record<string, string[]>> {
  if (backgroundSkillsCache) return backgroundSkillsCache
  backgroundSkillsCache = STATIC_BACKGROUND_SKILLS as Record<string, string[]>
  return backgroundSkillsCache
}

// â”€â”€ Race Skill Proficiencies â”€â”€

export interface RaceSkillProf {
  fixed: string[]
  choose?: { from: string[]; count: number }
  any?: number
}

export async function fetchRaceSkills(): Promise<Record<string, RaceSkillProf>> {
  if (raceSkillsCache) return raceSkillsCache as Record<string, RaceSkillProf>
  raceSkillsCache = STATIC_RACE_SKILLS as Record<string, RaceSkillProf>
  return raceSkillsCache as Record<string, RaceSkillProf>
}

// â”€â”€ Classes (names + subclasses) â”€â”€

export async function fetchClasses(): Promise<ClassMap> {
  if (classesCache) return classesCache
  // New format: Record<string, { subclasses: string[], ... }>
  const raw = STATIC_CLASSES as Record<string, { subclasses?: string[] } | string[]>
  const isNewFormat = !Array.isArray(Object.values(raw)[0])
  if (isNewFormat) {
    classesCache = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, (v as { subclasses?: string[] }).subclasses ?? []])
    )
  } else {
    classesCache = STATIC_CLASSES as ClassMap
  }
  return classesCache
}

// â”€â”€ Class Details (hit dice, ASI levels, subclasses) â”€â”€

export async function fetchClassDetails(): Promise<Record<string, ClassDetail>> {
  if (classDetailsCache) return classDetailsCache
  // Merge fallback with skill choices from processed data
  const choices = STATIC_CLASS_SKILL_CHOICES as Record<string, { from?: string[]; count?: number; any?: number }>
  const merged: Record<string, ClassDetail> = {}
  for (const [name, detail] of Object.entries(FALLBACK_CLASS_DETAILS)) {
    const sc = choices[name]
    merged[name] = {
      ...detail,
      skillChoices: sc
        ? ('any' in sc && sc.any ? { any: sc.any } : { from: sc.from ?? [], count: sc.count ?? 2 })
        : detail.skillChoices,
    }
  }
  classDetailsCache = merged
  return classDetailsCache
}

// â”€â”€ Feats â”€â”€

export async function fetchFeats(): Promise<Feat[]> {
  if (featsCache) return featsCache
  featsCache = STATIC_FEATS as unknown as Feat[]
  return featsCache
}

/** Returns concrete (non-choose) skill names granted by a feat */
export function getFeatFixedSkills(feat: Feat): string[] {
  if (!feat.skillProficiencies) return []
  const skills: string[] = []
  for (const entry of feat.skillProficiencies) {
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'choose') continue
      if (v === true) skills.push(k)
    }
  }
  return skills
}

// â”€â”€ Helpers â”€â”€

// â”€â”€ Spells â”€â”€

export async function fetchSpells(className: string): Promise<SpellEntry[]> {
  if (spellsCache[className]) return spellsCache[className]
  const spells = (STATIC_SPELLS as SpellEntry[])
    .filter(spell =>
      Array.isArray(spell.classes) &&
      spell.classes.some(value => value.toLowerCase() === className.toLowerCase())
    )
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

  spellsCache[className] = spells
  return spells
}

export async function fetchAllSpells(): Promise<SpellEntry[]> {
  if (allSpellsCache) return allSpellsCache
  allSpellsCache = STATIC_SPELLS as SpellEntry[]
  return allSpellsCache
}

// â”€â”€ Equipment Items â”€â”€

export async function fetchEquipmentItems(): Promise<EquipmentItem[]> {
  if (equipmentCache) return equipmentCache
  equipmentCache = STATIC_ITEMS as unknown as EquipmentItem[]
  return equipmentCache
}

// â”€â”€ Race Traits â”€â”€

export async function fetchRaceTraits(raceName: string): Promise<TraitEntry[]> {
  const db = STATIC_RACE_TRAITS as Record<string, Array<{ name: string; description: string; source: string }>>
  // Try exact match first, then case-insensitive
  const exact = db[raceName]
  if (exact) return exact
  const lower = raceName.toLowerCase()
  const found = Object.entries(db).find(([k]) => k.toLowerCase() === lower)
  return found?.[1] ?? []
}

// â”€â”€ Class Features â”€â”€

export async function fetchClassFeatures(className: string, level: number): Promise<TraitEntry[]> {
  const db = STATIC_CLASS_FEATURES as Record<string, Array<{ name: string; level: number; description: string }>>
  const feats = db[className] ?? []
  return feats
    .filter(f => f.level <= level)
    .map(f => ({ name: `${f.name} (Level ${f.level})`, description: f.description, source: className }))
}

// â”€â”€ Subclass Features â”€â”€

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

// â”€â”€ Subclass Spell Grants â”€â”€

export function fetchSubclassSpells(
  className: string,
  subclassName: string,
  characterLevel: number
): SubclassSpellGrant[] {
  const db = STATIC_SUBCLASS_SPELLS as Record<string, Record<string, SubclassSpellGrant[]>>
  const subclassMap = db[className] ?? {}
  const grants = subclassMap[subclassName]
    ?? Object.entries(subclassMap).find(([k]) => k.toLowerCase() === subclassName.toLowerCase())?.[1]
    ?? []
  return grants.filter(g => g.minCharLevel <= characterLevel)
}

// â”€â”€ Fallbacks â”€â”€

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

