'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Autocomplete from '@/components/ui/Autocomplete'
import SpellModal from '@/components/ui/SpellModal'
import {
  fetchRaceTraits, fetchClassFeatures, fetchSubclassFeatures,
  getLanguageGrants, ALL_LANGUAGES,
  type SpellEntry, type EquipmentItem, type Feat,
  type ClassDetail, type RaceSkillProf, type ClassMap,
} from '@/lib/5etools/data'
import type {
  Character, CharacterClass, CharacterSpell,
  CharacterWeapon, CharacterEquipment, CharacterFeature,
  CharacterProficiency, ClassResource, CustomStat, CustomStatType, ResetOn,
  ProficiencyLevel, Ability,
} from '@/modules/characters/types'
import { SKILLS, ABILITY_NAMES as AB_LABELS } from '@/lib/constants'
import { getLevelFromXP, XP_THRESHOLDS } from '@/lib/5etools/xp'

/* ── Constants ── */

const ABILITY_LABELS: Record<string, string> = AB_LABELS

const DMG_TYPE_MAP: Record<string, string> = {
  S: 'Cortante', P: 'Perforante', B: 'Contundente',
  A: 'Ácido', C: 'Frío', F: 'Fuego', L: 'Relámpago',
  N: 'Necrótico', O: 'Veneno', R: 'Radiante', T: 'Trueno',
}

const SPELLCASTING_ABILITIES = ['int', 'wis', 'cha'] as const

const RARITY_COLORS: Record<string, string> = {
  common: '#9CAF88', uncommon: '#4D9B4D', rare: '#4A90D9',
  'very rare': '#9B59B6', legendary: '#E67E22', artifact: '#E74C3C',
}

type Tab = 'basic' | 'classes' | 'combat' | 'skills' | 'spells' | 'weapons' | 'equipment' | 'features' | 'resources' | 'custom'

/* ── Helpers ── */

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function parseItemValue(notes: string | null): number | null {
  if (!notes) return null
  const m = notes.match(/value:([\d.]+)/)
  return m ? parseFloat(m[1]) : null
}

function cleanNotes(notes: string | null): string {
  if (!notes) return ''
  return notes.replace(/value:[\d.]+\s*/g, '').trim()
}

/** Strip 5etools {@tag content|source} references from text */
function cleanTaggedText(text: string | null): string {
  if (!text) return ''
  return text
    .replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function EditCharacterClient({
  character,
  classes,
  spells,
  weapons,
  equipment,
  features,
  proficiencies,
  classResources,
  customStats,
  raceOptions,
  backgroundOptions,
  classMap,
  spellList,
  equipmentItems,
  allFeats,
  classDetails,
  backgroundSkills,
  raceSkills,
}: {
  character: Character
  classes: CharacterClass[]
  spells: CharacterSpell[]
  weapons: CharacterWeapon[]
  equipment: CharacterEquipment[]
  features: CharacterFeature[]
  proficiencies: CharacterProficiency[]
  classResources: ClassResource[]
  customStats: CustomStat[]
  raceOptions: string[]
  backgroundOptions: string[]
  classMap: ClassMap
  spellList: SpellEntry[]
  equipmentItems: EquipmentItem[]
  allFeats: Feat[]
  classDetails: Record<string, ClassDetail>
  backgroundSkills: Record<string, string[]>
  raceSkills: Record<string, RaceSkillProf>
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  /* ── 5etools data ── */
  const weaponItems = equipmentItems.filter(i => i.weaponCategory != null)

  /* ── Item / weapon filters ── */
  const [weaponCatFilter, setWeaponCatFilter] = useState<'all' | 'simple' | 'martial'>('all')
  const [equipCatFilter, setEquipCatFilter] = useState<string>('all')
  const [equipRarityFilter, setEquipRarityFilter] = useState<string>('all')

  /* ── Language state ── */
  // All non-auto languages (choices + custom) tracked here
  // Initialized from saved proficiencies, auto-fixed ones are computed and excluded in the UI
  const [langChoices, setLangChoices] = useState<string[]>(() => {
    const saved = proficiencies.filter(p => p.type === 'language').map(p => p.name)
    const { autoFixed } = getLanguageGrants({
      race: character.race || undefined,
      subrace: character.subrace || undefined,
      background: character.background || undefined,
    })
    return saved.filter(l => !autoFixed.includes(l))
  })
  const [customLangInput, setCustomLangInput] = useState('')
  const [loadingTraits, setLoadingTraits] = useState(false)
  const [spellModalOpen, setSpellModalOpen] = useState(false)
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null)

  /* ── Basic state ── */
  const [basic, setBasic] = useState({
    name: character.name,
    race: character.race ?? '',
    subrace: character.subrace ?? '',
    background: character.background ?? '',
    alignment: character.alignment ?? '',
    experience_points: character.experience_points,
    speed: character.speed,
    age: character.age ?? '',
    height: character.height ?? '',
    weight: character.weight ?? '',
    eyes: character.eyes ?? '',
    skin: character.skin ?? '',
    hair: character.hair ?? '',
    personality: character.personality ?? '',
    ideals: character.ideals ?? '',
    bonds: character.bonds ?? '',
    flaws: character.flaws ?? '',
    backstory: character.backstory ?? '',
    homebrew_background_url: character.homebrew_background_url ?? '',
    homebrew_background_description: character.homebrew_background_description ?? '',
    homebrew_background_notes: character.homebrew_background_notes ?? '',
  })
  const [isHomebrewBackground, setIsHomebrewBackground] = useState(
    !!(character.homebrew_background_url || character.homebrew_background_description)
  )
  // Note: isHomebrewBackground is intentionally separate from `basic` so the user
  // can toggle the section open/closed without clearing the saved data.

  /* ── Combat state ── */
  const [combat, setCombat] = useState({
    str: character.str, dex: character.dex, con: character.con,
    int: character.int, wis: character.wis, cha: character.cha,
    base_str: character.base_str ?? null as number | null,
    base_dex: character.base_dex ?? null as number | null,
    base_con: character.base_con ?? null as number | null,
    base_int: character.base_int ?? null as number | null,
    base_wis: character.base_wis ?? null as number | null,
    base_cha: character.base_cha ?? null as number | null,
    hp_max: character.hp_max, hp_current: character.hp_current, hp_temp: character.hp_temp,
    ac: character.ac, initiative_bonus: character.initiative_bonus,
    proficiency_bonus: character.proficiency_bonus,
    hit_dice_total: character.hit_dice_total ?? '',
    pp: character.pp, gp: character.gp, sp: character.sp, cp: character.cp,
  })

  /* ── Classes ── */
  const [localClasses, setLocalClasses] = useState(classes)
  const [newCls, setNewCls] = useState({
    class_name: '', subclass_name: '', level: 1, is_primary: false,
    spellcasting_ability: '' as Ability | '',
    spell_save_dc: null as number | null,
    spell_attack_mod: null as number | null,
    is_homebrew: false, homebrew_url: '', homebrew_description: '',
  })

  /* ── Spells ── */
  const [localSpells, setLocalSpells] = useState(spells)
  const [isOffClassSpell, setIsOffClassSpell] = useState(false)
  const [newSpell, setNewSpell] = useState({
    class_id: localClasses[0]?.id ?? '',
    spell_level: 0,
    name: '',
    custom_notes: '',
    range: '',
    damage: '',
    components: '',
    is_prepared: true,
    source_type: 'spell' as 'spell' | 'scroll' | 'charges',
    charges_max: null as number | null,
  })

  /* ── Weapons ── */
  const [localWeapons, setLocalWeapons] = useState(weapons)
  const [newWeapon, setNewWeapon] = useState({
    name: '', atk_bonus: '', damage: '', damage_type: '', range: '', notes: '',
    ability_mod: '' as string, is_proficient: false, extra_damage: '',
  })
  const [editingWeaponId, setEditingWeaponId] = useState<string | null>(null)
  const [editWeapon, setEditWeapon] = useState({
    name: '', atk_bonus: '', damage: '', damage_type: '', range: '', notes: '',
    ability_mod: '' as string, is_proficient: false, extra_damage: '',
  })

  /* ── Equipment ── */
  const [localEquipment, setLocalEquipment] = useState(equipment)
  const [newEquip, setNewEquip] = useState({ name: '', quantity: 1, weight: '', notes: '' })
  const [equipContents, setEquipContents] = useState<string[] | null>(null)

  /* ── Features ── */
  const [localFeatures, setLocalFeatures] = useState(features)
  const [newFeature, setNewFeature] = useState({ name: '', description: '', source: '' })
  const [featQuery, setFeatQuery] = useState('')

  /* ── Resources ── */
  const [localResources, setLocalResources] = useState(classResources)
  const [newResource, setNewResource] = useState({
    name: '', current: 0, maximum: 0, reset_on: 'long_rest' as ResetOn,
  })
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null)
  const [editResource, setEditResource] = useState({ name: '', current: 0, maximum: 0, reset_on: 'long_rest' as ResetOn })

  /* ── Custom Stats ── */
  const [localCustom, setLocalCustom] = useState(customStats)
  const [newCustom, setNewCustom] = useState({
    name: '', current_value: 0, max_value: 0,
    text_value: '', stat_type: 'counter' as CustomStatType, notes: '',
  })

  /* ── Skills / Proficiencies ── */
  const [localProfs, setLocalProfs] = useState<CharacterProficiency[]>(
    proficiencies.filter(p => p.type === 'skill')
  )

  /* ── Skill suggestion data from 5etools ── */
  interface SkillSuggestion {
    skill: string
    source: string
    type: 'proficiency' | 'expertise' | 'advantage' | 'choice'
  }
  const [skillSuggestions, setSkillSuggestions] = useState<SkillSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  /* ══════════════════════════════════════════════════════════════
     EFFECTS — fetch 5etools data
     ══════════════════════════════════════════════════════════════ */

  // Skill suggestions — from class, race, background, features
  useEffect(() => {
    async function loadSuggestions() {
      setLoadingSuggestions(true)
      const suggestions: SkillSuggestion[] = []

      try {
        // Class skill proficiencies
        for (const cls of localClasses) {
          const detail = classDetails[cls.class_name]
          if (detail?.skillChoices) {
            const sc = detail.skillChoices
            if ('any' in sc) {
              suggestions.push({ skill: `Any ${sc.any} skills`, source: cls.class_name, type: 'choice' })
            } else if ('from' in sc) {
              for (const s of sc.from) {
                suggestions.push({ skill: s, source: `${cls.class_name} (choose ${sc.count})`, type: 'choice' })
              }
            }
          }
          // Rogue expertise at levels 1/6
          if (cls.class_name === 'Rogue') {
            if (cls.level >= 1) suggestions.push({ skill: 'Choose 2 for Expertise', source: 'Rogue Lv1', type: 'expertise' })
            if (cls.level >= 6) suggestions.push({ skill: 'Choose 2 more for Expertise', source: 'Rogue Lv6', type: 'expertise' })
          }
          // Bard expertise at levels 3/10
          if (cls.class_name === 'Bard') {
            if (cls.level >= 3) suggestions.push({ skill: 'Choose 2 for Expertise', source: 'Bard Lv3', type: 'expertise' })
            if (cls.level >= 10) suggestions.push({ skill: 'Choose 2 more for Expertise', source: 'Bard Lv10', type: 'expertise' })
          }
        }

        // Background skills
        const bgName = basic.background ?? ''
        const bgMatch = backgroundSkills[bgName]
        if (bgMatch) {
          for (const s of bgMatch) {
            suggestions.push({ skill: s, source: `Background: ${bgName}`, type: 'proficiency' })
          }
        }

        // Race skills
        const raceName = basic.subrace
          ? `${basic.subrace} (${basic.race})`
          : basic.race ?? ''
        const raceMatch = raceSkills[raceName] ?? raceSkills[basic.race ?? '']
        if (raceMatch) {
          for (const s of raceMatch.fixed) {
            suggestions.push({ skill: s, source: `Race: ${raceName}`, type: 'proficiency' })
          }
          if (raceMatch.choose) {
            for (const s of raceMatch.choose.from) {
              suggestions.push({ skill: s, source: `Race: ${raceName} (choose ${raceMatch.choose.count})`, type: 'choice' })
            }
          }
          if (raceMatch.any) {
            suggestions.push({ skill: `Any ${raceMatch.any} skills`, source: `Race: ${raceName}`, type: 'choice' })
          }
        }

        // Features that mention advantage on skills
        for (const f of localFeatures) {
          const desc = (f.description ?? '').toLowerCase()
          // Check for advantage mentions
          if (desc.includes('advantage') || desc.includes('ventaja')) {
            const allSkillKeys = ['acrobatics','animal handling','arcana','athletics','deception','history',
              'insight','intimidation','investigation','medicine','nature','perception',
              'performance','persuasion','religion','sleight of hand','stealth','survival']
            for (const sk of allSkillKeys) {
              if (desc.includes(sk.toLowerCase())) {
                suggestions.push({ skill: sk, source: f.name, type: 'advantage' })
              }
            }
            // Common patterns
            if (desc.includes('perception') && !suggestions.some(s => s.skill === 'perception' && s.source === f.name)) {
              // already handled above
            }
          }
          // Check for proficiency mentions
          if (desc.includes('proficiency') || desc.includes('competencia') || desc.includes('proficient')) {
            const allSkillKeys = ['acrobatics','animal handling','arcana','athletics','deception','history',
              'insight','intimidation','investigation','medicine','nature','perception',
              'performance','persuasion','religion','sleight of hand','stealth','survival']
            for (const sk of allSkillKeys) {
              if (desc.includes(sk.toLowerCase())) {
                suggestions.push({ skill: sk, source: f.name, type: 'proficiency' })
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading skill suggestions:', err)
      }

      setSkillSuggestions(suggestions)
      setLoadingSuggestions(false)
    }
    loadSuggestions()
  }, [backgroundSkills, basic.background, basic.race, basic.subrace, classDetails, localClasses, localFeatures, raceSkills])

  /* ══════════════════════════════════════════════════════════════
     SAVE HELPERS
     ══════════════════════════════════════════════════════════════ */

  function showSaved() {
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveBasic() {
    setSaving(true)
    await Promise.all([
      supabase.from('characters').update(basic).eq('id', character.id),
      saveLanguages(),
    ])
    showSaved()
  }

  async function saveLanguages() {
    const { autoFixed } = getLanguageGrants({
      race: basic.race || undefined,
      subrace: basic.subrace || undefined,
      background: basic.background || undefined,
    })
    // Combine auto + user choices, deduplicated
    const all = [...new Set([...autoFixed, ...langChoices.filter(Boolean)])]
    await supabase.from('character_proficiencies')
      .delete().eq('character_id', character.id).eq('type', 'language')
    if (all.length > 0) {
      await supabase.from('character_proficiencies').insert(
        all.map(name => ({
          character_id: character.id,
          type: 'language' as const,
          name,
          proficiency_level: 'proficient' as const,
          has_advantage: false,
        }))
      )
    }
  }

  async function saveCombat() {
    setSaving(true)
    await supabase.from('characters').update(combat).eq('id', character.id)
    showSaved()
  }

  /* ══════════════════════════════════════════════════════════════
     CLASSES — CRUD
     ══════════════════════════════════════════════════════════════ */

  function clsPayload(c: {
    class_name: string; subclass_name: string | null; level: number; is_primary: boolean
    spellcasting_ability: Ability | null | ''; spell_save_dc: number | null; spell_attack_mod: number | null
    is_homebrew: boolean; homebrew_url: string | null; homebrew_description: string | null
  }) {
    return {
      class_name: c.class_name,
      subclass_name: c.subclass_name || null,
      level: c.level,
      is_primary: c.is_primary,
      spellcasting_ability: (c.spellcasting_ability || null) as Ability | null,
      spell_save_dc: c.spell_save_dc ?? null,
      spell_attack_mod: c.spell_attack_mod ?? null,
      is_homebrew: c.is_homebrew,
      homebrew_url: c.homebrew_url || null,
      homebrew_description: c.homebrew_description || null,
    }
  }

  async function saveClass(cls: CharacterClass) {
    await supabase.from('character_classes').update(clsPayload(cls)).eq('id', cls.id)
  }

  async function addClass() {
    if (!newCls.class_name.trim()) return
    const { data } = await supabase.from('character_classes').insert({
      character_id: character.id,
      ...clsPayload(newCls),
    }).select().single()
    if (data) setLocalClasses(prev => [...prev, data as CharacterClass])
    setNewCls({
      class_name: '', subclass_name: '', level: 1, is_primary: false,
      spellcasting_ability: '', spell_save_dc: null, spell_attack_mod: null,
      is_homebrew: false, homebrew_url: '', homebrew_description: '',
    })
  }

  async function deleteClass(id: string) {
    await supabase.from('character_classes').delete().eq('id', id)
    setLocalClasses(prev => prev.filter(c => c.id !== id))
  }

  function updateLocalClass(id: string, patch: Partial<CharacterClass>) {
    setLocalClasses(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  async function saveAllClasses() {
    setSaving(true)
    await Promise.all(localClasses.map(saveClass))
    showSaved()
  }

  /* ══════════════════════════════════════════════════════════════
     SPELLS — CRUD + autocomplete
     ══════════════════════════════════════════════════════════════ */

  function handleSpellSelect(spell: SpellEntry) {
    setNewSpell(p => ({
      ...p,
      name: spell.name,
      spell_level: spell.level,
      range: spell.range ?? '',
      damage: '',
      components: spell.components ?? '',
      custom_notes: [
        spell.concentration ? 'Concentration' : '',
        spell.ritual ? 'Ritual' : '',
        spell.duration ?? '',
      ].filter(Boolean).join(', '),
    }))
    setSpellModalOpen(false)
  }

  async function addSpell() {
    if (!newSpell.name.trim() || !newSpell.class_id) return
    const base = {
      character_id: character.id,
      class_id: newSpell.class_id,
      spell_level: newSpell.spell_level,
      name: newSpell.name,
      custom_notes: newSpell.custom_notes || null,
      range: newSpell.range || null,
      damage: newSpell.damage || null,
      components: newSpell.components || null,
      is_prepared: newSpell.is_prepared,
      sort_order: localSpells.length,
    }
    // Try with source_type columns; fall back if migration not yet applied
    const insertResult = await supabase.from('character_spells').insert({
      ...base,
      source_type: newSpell.source_type,
      charges_max: newSpell.source_type === 'charges' ? (newSpell.charges_max ?? 1) : null,
      charges_used: 0,
    }).select().single()
    let data = insertResult.data
    if (insertResult.error && insertResult.error.message?.includes('source_type')) {
      const res = await supabase.from('character_spells').insert(base).select().single()
      data = res.data
    }
    if (data) setLocalSpells(prev => [...prev, data])
    setNewSpell(p => ({ ...p, name: '', custom_notes: '', range: '', damage: '', components: '', source_type: 'spell', charges_max: null }))
  }

  async function deleteSpell(id: string) {
    await supabase.from('character_spells').delete().eq('id', id)
    setLocalSpells(prev => prev.filter(s => s.id !== id))
  }

  /* ══════════════════════════════════════════════════════════════
     WEAPONS — CRUD + autocomplete
     ══════════════════════════════════════════════════════════════ */

  function handleWeaponAutocomplete(name: string) {
    setNewWeapon(p => ({ ...p, name }))
    const match = weaponItems.find(w => w.name === name)
    if (match) {
      setNewWeapon(p => ({
        ...p,
        name,
        damage: match.damage ?? '',
        damage_type: match.damageType
          ? (DMG_TYPE_MAP[match.damageType] ?? match.damageType)
          : '',
        range: match.range ?? '',
      }))
    }
  }

  async function addWeapon() {
    if (!newWeapon.name.trim()) return
    const { data } = await supabase.from('character_weapons').insert({
      character_id: character.id,
      ...newWeapon,
      sort_order: localWeapons.length,
    }).select().single()
    if (data) setLocalWeapons(prev => [...prev, data])
    setNewWeapon({ name: '', atk_bonus: '', damage: '', damage_type: '', range: '', notes: '', ability_mod: '', is_proficient: false, extra_damage: '' })
  }

  async function deleteWeapon(id: string) {
    await supabase.from('character_weapons').delete().eq('id', id)
    setLocalWeapons(prev => prev.filter(w => w.id !== id))
  }

  function startEditWeapon(w: typeof localWeapons[0]) {
    setEditingWeaponId(w.id)
    setEditWeapon({
      name: w.name ?? '',
      atk_bonus: w.atk_bonus ?? '',
      damage: w.damage ?? '',
      damage_type: w.damage_type ?? '',
      range: w.range ?? '',
      notes: w.notes ?? '',
      ability_mod: w.ability_mod ?? '',
      is_proficient: w.is_proficient ?? false,
      extra_damage: w.extra_damage ?? '',
    })
  }

  async function saveWeapon(id: string) {
    await supabase.from('character_weapons').update({ ...editWeapon }).eq('id', id)
    setLocalWeapons(prev => prev.map(w => w.id === id ? { ...w, ...editWeapon } : w))
    setEditingWeaponId(null)
  }

  /* ══════════════════════════════════════════════════════════════
     EQUIPMENT — CRUD + autocomplete + sell
     ══════════════════════════════════════════════════════════════ */

  function handleEquipAutocomplete(name: string) {
    setNewEquip(p => ({ ...p, name }))
    const match = equipmentItems.find(e => e.name === name)
    if (match) {
      setNewEquip(p => ({
        ...p,
        name,
        weight: match.weight ? `${match.weight} lb` : '',
        notes: match.value != null ? `value:${match.value}` : '',
      }))
      setEquipContents(match.contents && match.contents.length > 0 ? match.contents : null)
    } else {
      setEquipContents(null)
    }
  }

  async function addEquipment() {
    if (!newEquip.name.trim()) return
    const { data: packRow } = await supabase.from('character_equipment').insert({
      character_id: character.id, ...newEquip, sort_order: localEquipment.length,
    }).select().single()
    const added: typeof localEquipment = packRow ? [packRow] : []

    // Auto-expand pack contents as individual rows
    if (equipContents && equipContents.length > 0) {
      const contentInserts = equipContents.map((c, i) => {
        const multiMatch = c.match(/^(\d+)x (.+)$/)
        const qty = multiMatch ? parseInt(multiMatch[1]) : 1
        const rawName = multiMatch ? multiMatch[2] : c.split('|')[0]
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1)
        return { character_id: character.id, name, quantity: qty, weight: '', notes: '', sort_order: localEquipment.length + 1 + i }
      })
      const { data: contentRows } = await supabase.from('character_equipment').insert(contentInserts).select()
      if (contentRows) added.push(...contentRows)
    }

    setLocalEquipment(prev => [...prev, ...added])
    setNewEquip({ name: '', quantity: 1, weight: '', notes: '' })
    setEquipContents(null)
  }

  async function deleteEquipment(id: string) {
    await supabase.from('character_equipment').delete().eq('id', id)
    setLocalEquipment(prev => prev.filter(e => e.id !== id))
  }

  async function sellItem(item: CharacterEquipment) {
    const value = parseItemValue(item.notes)
    if (value == null || value <= 0) return
    const totalValue = Math.round(value * item.quantity * 100) / 100
    // Remove from equipment
    await supabase.from('character_equipment').delete().eq('id', item.id)
    setLocalEquipment(prev => prev.filter(e => e.id !== item.id))
    // Add gold
    const newGp = Math.round((combat.gp + totalValue) * 100) / 100
    setCombat(p => ({ ...p, gp: newGp }))
    await supabase.from('characters').update({ gp: newGp }).eq('id', character.id)
    showSaved()
  }

  /* ══════════════════════════════════════════════════════════════
     FEATURES — CRUD + auto-populate
     ══════════════════════════════════════════════════════════════ */

  async function addFeature() {
    if (!newFeature.name.trim()) return
    const { data } = await supabase.from('character_features').insert({
      character_id: character.id, ...newFeature, sort_order: localFeatures.length,
    }).select().single()
    if (data) setLocalFeatures(prev => [...prev, data])
    setNewFeature({ name: '', description: '', source: '' })
  }

  async function deleteFeature(id: string) {
    await supabase.from('character_features').delete().eq('id', id)
    setLocalFeatures(prev => prev.filter(f => f.id !== id))
  }

  async function loadAutoTraits() {
    setLoadingTraits(true)
    try {
      const newTraits: { name: string; description: string; source: string }[] = []
      const existingNames = new Set(localFeatures.map(f => f.name))

      // Race traits
      if (basic.race) {
        const raceKey = basic.subrace
          ? `${basic.subrace} (${basic.race})`
          : basic.race
        const raceTraits = await fetchRaceTraits(raceKey)
        for (const t of raceTraits) {
          if (!existingNames.has(t.name)) {
            newTraits.push({
              name: t.name,
              description: t.description,
              source: `Raza: ${raceKey}`,
            })
            existingNames.add(t.name)
          }
        }
      }

      // Class features (each class the character has)
      for (const cls of localClasses) {
        const classFeats = await fetchClassFeatures(cls.class_name, cls.level)
        for (const t of classFeats) {
          if (!existingNames.has(t.name)) {
            newTraits.push({
              name: t.name,
              description: t.description,
              source: `Clase: ${cls.class_name}`,
            })
            existingNames.add(t.name)
          }
        }

        // Subclass features
        if (cls.subclass_name) {
          const subFeats = await fetchSubclassFeatures(
            cls.class_name, cls.subclass_name, cls.level,
          )
          for (const t of subFeats) {
            if (!existingNames.has(t.name)) {
              newTraits.push({
                name: t.name,
                description: t.description,
                source: `Subclase: ${cls.subclass_name}`,
              })
              existingNames.add(t.name)
            }
          }
        }
      }

      // Insert all new traits into DB
      if (newTraits.length > 0) {
        const inserts = newTraits.map((t, i) => ({
          character_id: character.id,
          name: t.name,
          description: t.description,
          source: t.source,
          sort_order: localFeatures.length + i,
        }))
        const { data } = await supabase.from('character_features').insert(inserts).select()
        if (data) setLocalFeatures(prev => [...prev, ...data])
      }
      showSaved()
    } catch (err) {
      console.error('Error loading auto traits:', err)
    } finally {
      setLoadingTraits(false)
    }
  }

  /* ══════════════════════════════════════════════════════════════
     RESOURCES — CRUD
     ══════════════════════════════════════════════════════════════ */

  async function addResource() {
    if (!newResource.name.trim()) return
    const { data } = await supabase.from('character_class_resources').insert({
      character_id: character.id, ...newResource, sort_order: localResources.length,
    }).select().single()
    if (data) setLocalResources(prev => [...prev, data])
    setNewResource({ name: '', current: 0, maximum: 0, reset_on: 'long_rest' })
  }

  async function deleteResource(id: string) {
    await supabase.from('character_class_resources').delete().eq('id', id)
    setLocalResources(prev => prev.filter(r => r.id !== id))
  }

  function startEditResource(r: typeof localResources[0]) {
    setEditingResourceId(r.id)
    setEditResource({ name: r.name, current: r.current, maximum: r.maximum, reset_on: r.reset_on as ResetOn })
  }

  async function saveResource(id: string) {
    await supabase.from('character_class_resources').update({ ...editResource }).eq('id', id)
    setLocalResources(prev => prev.map(r => r.id === id ? { ...r, ...editResource } : r))
    setEditingResourceId(null)
  }

  /* ══════════════════════════════════════════════════════════════
     CUSTOM STATS — CRUD
     ══════════════════════════════════════════════════════════════ */

  async function addCustomStat() {
    if (!newCustom.name.trim()) return
    const { data } = await supabase.from('character_custom_stats').insert({
      character_id: character.id, ...newCustom, sort_order: localCustom.length,
    }).select().single()
    if (data) setLocalCustom(prev => [...prev, data])
    setNewCustom({
      name: '', current_value: 0, max_value: 0,
      text_value: '', stat_type: 'counter', notes: '',
    })
  }

  async function deleteCustomStat(id: string) {
    await supabase.from('character_custom_stats').delete().eq('id', id)
    setLocalCustom(prev => prev.filter(c => c.id !== id))
  }

  /* ══════════════════════════════════════════════════════════════
     SKILLS — proficiency cycling + advantage + save
     ══════════════════════════════════════════════════════════════ */

  function getSkillProf(skillKey: string): CharacterProficiency | undefined {
    return localProfs.find(p => p.name === skillKey)
  }

  function cycleProf(skillKey: string) {
    const existing = getSkillProf(skillKey)
    const order: ProficiencyLevel[] = ['none', 'proficient', 'expertise']
    if (!existing) {
      // Create a local entry (will be saved on "Guardar")
      setLocalProfs(prev => [...prev, {
        id: `new_${skillKey}`,
        character_id: character.id,
        type: 'skill' as const,
        name: skillKey,
        proficiency_level: 'proficient',
        has_advantage: false,
      }])
    } else {
      const idx = order.indexOf(existing.proficiency_level)
      const next = order[(idx + 1) % order.length]
      setLocalProfs(prev => prev.map(p => p.name === skillKey ? { ...p, proficiency_level: next } : p))
    }
  }

  function toggleAdvantage(skillKey: string) {
    const existing = getSkillProf(skillKey)
    if (!existing) {
      setLocalProfs(prev => [...prev, {
        id: `new_${skillKey}`,
        character_id: character.id,
        type: 'skill' as const,
        name: skillKey,
        proficiency_level: 'none',
        has_advantage: true,
      }])
    } else {
      setLocalProfs(prev => prev.map(p => p.name === skillKey ? { ...p, has_advantage: !p.has_advantage } : p))
    }
  }

  function calcSkillBonus(skillKey: string, ability: string): number {
    const abilityScore = combat[ability as keyof typeof combat] as number
    const abilityMod = Math.floor((abilityScore - 10) / 2)
    const prof = getSkillProf(skillKey)
    if (!prof || prof.proficiency_level === 'none') return abilityMod
    if (prof.proficiency_level === 'expertise') return abilityMod + combat.proficiency_bonus * 2
    return abilityMod + combat.proficiency_bonus
  }

  async function saveSkills() {
    setSaving(true)
    // Delete all existing skill proficiencies for this character
    await supabase.from('character_proficiencies')
      .delete()
      .eq('character_id', character.id)
      .eq('type', 'skill')

    // Insert all current ones (excluding 'none' with no advantage)
    const toInsert = localProfs
      .filter(p => p.proficiency_level !== 'none' || p.has_advantage)
      .map(p => ({
        character_id: character.id,
        type: 'skill' as const,
        name: p.name,
        proficiency_level: p.proficiency_level,
        has_advantage: p.has_advantage ?? false,
      }))

    if (toInsert.length > 0) {
      const { data } = await supabase.from('character_proficiencies').insert(toInsert).select()
      if (data) {
        setLocalProfs(data as CharacterProficiency[])
      }
    } else {
      setLocalProfs([])
    }
    showSaved()
  }

  /* ══════════════════════════════════════════════════════════════
     TABS CONFIG
     ══════════════════════════════════════════════════════════════ */

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic', label: 'Basico' },
    { key: 'classes', label: 'Clases' },
    { key: 'combat', label: 'Combate' },
    { key: 'skills', label: 'Habilidades' },
    { key: 'spells', label: 'Hechizos' },
    { key: 'weapons', label: 'Armas' },
    { key: 'equipment', label: 'Equipo' },
    { key: 'features', label: 'Rasgos' },
    { key: 'resources', label: 'Recursos' },
    { key: 'custom', label: 'Custom' },
  ]

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* ── Tab navigation ── */}
      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-bookmark ${tab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
        {(saved || saving) && (
          <span className="ml-auto self-center text-sm" style={{ color: 'var(--success)' }}>
            {saving ? 'Guardando...' : 'Guardado'}
          </span>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
         BASIC TAB
         ════════════════════════════════════════════════════════ */}
      {tab === 'basic' && (
        <div className="space-y-4">
          <div className="parchment-page rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <F label="Nombre">
                <input value={basic.name}
                  onChange={e => setBasic(p => ({ ...p, name: e.target.value }))}
                  className="ifield" />
              </F>
              <Autocomplete label="Raza" value={basic.race}
                onChange={v => setBasic(p => ({ ...p, race: v }))}
                options={raceOptions} placeholder="Elf, Human, Tiefling..." />
              <F label="Subraza">
                <input value={basic.subrace}
                  onChange={e => setBasic(p => ({ ...p, subrace: e.target.value }))}
                  className="ifield" />
              </F>
              <Autocomplete label="Trasfondo" value={basic.background}
                onChange={v => setBasic(p => ({ ...p, background: v }))}
                options={backgroundOptions} placeholder="Far Traveler, Sage..." />
              <F label="Alineamiento">
                <select value={basic.alignment}
                  onChange={e => setBasic(p => ({ ...p, alignment: e.target.value }))}
                  className="ifield">
                  <option value="">— Select —</option>
                  {['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </F>
              <F label="Velocidad">
                <input type="number" value={basic.speed}
                  onChange={e => setBasic(p => ({ ...p, speed: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="XP">
                <input type="number" value={basic.experience_points}
                  onChange={e => setBasic(p => ({ ...p, experience_points: +e.target.value }))}
                  onKeyDown={e => {
                    const lvl = getLevelFromXP(basic.experience_points)
                    if (e.key === 'ArrowUp' && lvl < 20) { e.preventDefault(); setBasic(p => ({ ...p, experience_points: XP_THRESHOLDS[lvl] })) }
                    if (e.key === 'ArrowDown' && lvl > 1) { e.preventDefault(); setBasic(p => ({ ...p, experience_points: XP_THRESHOLDS[lvl - 2] })) }
                  }}
                  className="ifield" />
              </F>
            </div>
          </div>

          {/* ── Idiomas ── */}
          <LanguageSection
            race={basic.race}
            subrace={basic.subrace}
            background={basic.background}
            langChoices={langChoices}
            setLangChoices={setLangChoices}
            customLangInput={customLangInput}
            setCustomLangInput={setCustomLangInput}
          />

          {/* ── Trasfondo Homebrew ── */}
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="hb-bg-toggle" checked={isHomebrewBackground}
                onChange={e => setIsHomebrewBackground(e.target.checked)} />
              <label htmlFor="hb-bg-toggle" className="text-sm font-semibold cursor-pointer"
                style={{ color: 'var(--cs-gold)', fontFamily: 'var(--font-cinzel, serif)' }}>
                Trasfondo personalizado / Homebrew
              </label>
            </div>
            {isHomebrewBackground && (
              <div className="space-y-3">
                <F label="Enlace (URL del trasfondo)">
                  <input value={basic.homebrew_background_url}
                    onChange={e => setBasic(p => ({ ...p, homebrew_background_url: e.target.value }))}
                    className="ifield" placeholder="https://..." />
                </F>
                <F label="Descripción del trasfondo">
                  <textarea value={basic.homebrew_background_description}
                    onChange={e => setBasic(p => ({ ...p, homebrew_background_description: e.target.value }))}
                    rows={4} className="ifield resize-none"
                    placeholder="Describe el trasfondo, su historia, lo que otorga..." />
                </F>
                <F label="Rasgos, bonos y subidas de nivel">
                  <textarea value={basic.homebrew_background_notes}
                    onChange={e => setBasic(p => ({ ...p, homebrew_background_notes: e.target.value }))}
                    rows={5} className="ifield resize-none"
                    placeholder="+2 CHA, +1 INT&#10;Habilidades: Persuasión, Historia&#10;Tiradas de salvación: CHA&#10;Nivel 1: ..." />
                </F>
                <p className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                  Las tiradas de salvación y habilidades del trasfondo también se pueden agregar en la tab Habilidades.
                </p>
              </div>
            )}
          </div>

          <div className="parchment-page rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4">
              {(['age', 'height', 'weight', 'eyes', 'skin', 'hair'] as const).map(k => (
                <F key={k} label={k}>
                  <input value={basic[k]}
                    onChange={e => setBasic(p => ({ ...p, [k]: e.target.value }))}
                    className="ifield" />
                </F>
              ))}
            </div>
          </div>

          <div className="parchment-page rounded-xl p-4 space-y-3">
            {(['personality', 'ideals', 'bonds', 'flaws', 'backstory'] as const).map(k => (
              <F key={k} label={k}>
                <textarea value={basic[k]}
                  onChange={e => setBasic(p => ({ ...p, [k]: e.target.value }))}
                  rows={3} className="ifield resize-none" />
              </F>
            ))}
          </div>

          <SaveBtn onClick={saveBasic} saving={saving} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         CLASSES TAB
         ════════════════════════════════════════════════════════ */}
      {tab === 'classes' && (
        <div className="space-y-4">
          {/* Existing classes */}
          {localClasses.map(cls => (
            <div key={cls.id} className="parchment-page rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold" style={{ color: 'var(--cs-gold)', fontFamily: 'var(--font-cinzel, serif)' }}>
                  {cls.class_name} {cls.subclass_name ? `— ${cls.subclass_name}` : ''} Nv{cls.level}
                </h3>
                <button onClick={() => deleteClass(cls.id)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                  Eliminar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Clase">
                  <select value={cls.class_name}
                    onChange={e => updateLocalClass(cls.id, { class_name: e.target.value, subclass_name: null })}
                    className="ifield">
                    {Object.keys(classMap).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    {!classMap[cls.class_name] && (
                      <option value={cls.class_name}>{cls.class_name}</option>
                    )}
                  </select>
                </F>
                <F label="Subclase">
                  {cls.is_homebrew ? (
                    <input value={cls.subclass_name ?? ''}
                      onChange={e => updateLocalClass(cls.id, { subclass_name: e.target.value })}
                      className="ifield" placeholder="Nombre de la subclase homebrew..." />
                  ) : (
                    <select value={cls.subclass_name ?? ''}
                      onChange={e => updateLocalClass(cls.id, { subclass_name: e.target.value || null })}
                      className="ifield">
                      <option value="">— Sin subclase —</option>
                      {(classMap[cls.class_name] ?? []).map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  )}
                </F>
                <F label="Nivel">
                  <input type="number" min={1} max={20} value={cls.level}
                    onChange={e => updateLocalClass(cls.id, { level: +e.target.value })}
                    className="ifield" />
                </F>
                <F label="Habilidad de conjuración">
                  <select value={cls.spellcasting_ability ?? ''}
                    onChange={e => updateLocalClass(cls.id, { spellcasting_ability: (e.target.value as Ability) || null })}
                    className="ifield">
                    <option value="">— Ninguna —</option>
                    {SPELLCASTING_ABILITIES.map(a => (
                      <option key={a} value={a}>{a.toUpperCase()}</option>
                    ))}
                  </select>
                </F>
                <F label="CD salvación de hechizos">
                  <input type="number" value={cls.spell_save_dc ?? ''}
                    onChange={e => updateLocalClass(cls.id, { spell_save_dc: e.target.value ? +e.target.value : null })}
                    className="ifield" placeholder="8 + prof + mod" />
                </F>
                <F label="Mod. ataque de hechizos">
                  <input type="number" value={cls.spell_attack_mod ?? ''}
                    onChange={e => updateLocalClass(cls.id, { spell_attack_mod: e.target.value ? +e.target.value : null })}
                    className="ifield" placeholder="prof + mod" />
                </F>
              </div>
              {/* Homebrew toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id={`hb-${cls.id}`} checked={cls.is_homebrew}
                  onChange={e => updateLocalClass(cls.id, { is_homebrew: e.target.checked })} />
                <label htmlFor={`hb-${cls.id}`} className="text-sm cursor-pointer"
                  style={{ color: 'var(--cs-gold)' }}>
                  Subclase homebrew
                </label>
              </div>
              {cls.is_homebrew && (
                <div className="space-y-2 pt-1 border-t" style={{ borderColor: 'rgba(201,173,106,0.2)' }}>
                  <F label="Enlace (URL)">
                    <input value={cls.homebrew_url ?? ''}
                      onChange={e => updateLocalClass(cls.id, { homebrew_url: e.target.value })}
                      className="ifield" placeholder="https://homebrewery.naturalcrit.com/..." />
                  </F>
                  <F label="Descripción de la subclase homebrew">
                    <textarea value={cls.homebrew_description ?? ''}
                      onChange={e => updateLocalClass(cls.id, { homebrew_description: e.target.value })}
                      rows={6} className="ifield resize-none"
                      placeholder="Describe los rasgos y habilidades de la subclase..." />
                  </F>
                  <p className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                    Agrega los rasgos individuales en la tab Rasgos con fuente «Subclase: {cls.subclass_name || cls.class_name}».
                    Las tiradas de salvación se agregan en Habilidades.
                  </p>
                </div>
              )}
              <button onClick={() => saveClass(cls)}
                className="btn-primary text-sm">
                Guardar esta clase
              </button>
            </div>
          ))}

          {/* Add new class */}
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Agregar clase / multiclase
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Clase">
                <select value={newCls.class_name}
                  onChange={e => setNewCls(p => ({ ...p, class_name: e.target.value, subclass_name: '' }))}
                  className="ifield">
                  <option value="">— Seleccionar —</option>
                  {Object.keys(classMap).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </F>
              <F label="Subclase">
                {newCls.is_homebrew ? (
                  <input value={newCls.subclass_name}
                    onChange={e => setNewCls(p => ({ ...p, subclass_name: e.target.value }))}
                    className="ifield" placeholder="Nombre homebrew..." />
                ) : (
                  <select value={newCls.subclass_name}
                    onChange={e => setNewCls(p => ({ ...p, subclass_name: e.target.value }))}
                    className="ifield">
                    <option value="">— Sin subclase —</option>
                    {(classMap[newCls.class_name] ?? []).map(sc => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                )}
              </F>
              <F label="Nivel">
                <input type="number" min={1} max={20} value={newCls.level}
                  onChange={e => setNewCls(p => ({ ...p, level: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Habilidad de conjuración">
                <select value={newCls.spellcasting_ability}
                  onChange={e => setNewCls(p => ({ ...p, spellcasting_ability: e.target.value as Ability | '' }))}
                  className="ifield">
                  <option value="">— Ninguna —</option>
                  {SPELLCASTING_ABILITIES.map(a => (
                    <option key={a} value={a}>{a.toUpperCase()}</option>
                  ))}
                </select>
              </F>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="newcls-hb" checked={newCls.is_homebrew}
                onChange={e => setNewCls(p => ({ ...p, is_homebrew: e.target.checked }))} />
              <label htmlFor="newcls-hb" className="text-sm cursor-pointer"
                style={{ color: 'var(--cs-gold)' }}>
                Subclase homebrew
              </label>
              <input type="checkbox" id="newcls-primary" checked={newCls.is_primary}
                onChange={e => setNewCls(p => ({ ...p, is_primary: e.target.checked }))} />
              <label htmlFor="newcls-primary" className="text-sm cursor-pointer"
                style={{ color: 'var(--cs-text-muted)' }}>
                Clase primaria
              </label>
            </div>
            {newCls.is_homebrew && (
              <div className="space-y-2">
                <F label="URL de la subclase homebrew">
                  <input value={newCls.homebrew_url}
                    onChange={e => setNewCls(p => ({ ...p, homebrew_url: e.target.value }))}
                    className="ifield" placeholder="https://..." />
                </F>
                <F label="Descripción">
                  <textarea value={newCls.homebrew_description}
                    onChange={e => setNewCls(p => ({ ...p, homebrew_description: e.target.value }))}
                    rows={4} className="ifield resize-none"
                    placeholder="Rasgos y descripción de la subclase..." />
                </F>
              </div>
            )}
            <button onClick={addClass} className="btn-primary">+ Agregar clase</button>
          </div>

          <SaveBtn onClick={saveAllClasses} saving={saving} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         COMBAT TAB — compact D&D stat block layout
         ════════════════════════════════════════════════════════ */}
      {tab === 'combat' && (
        <div className="space-y-4">
          {/* Section: Ability Scores */}
          <h3 className="font-semibold text-sm"
            style={{ color: 'var(--cs-text-muted)' }}>
            Puntuaciones de característica
          </h3>
          <div className="parchment-page rounded-xl p-4">
            <div className="grid grid-cols-6 gap-2">
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => {
                const baseKey = `base_${ab}` as `base_str` | `base_dex` | `base_con` | `base_int` | `base_wis` | `base_cha`
                const base = combat[baseKey]
                const bonus = base != null ? combat[ab] - base : null
                return (
                  <div key={ab} className="stat-box rounded text-center"
                    style={{ padding: '0.4rem 0.25rem' }}>
                    <div className="text-[0.65rem] font-bold uppercase tracking-wide mb-1"
                      style={{ color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>
                      {ABILITY_LABELS[ab]}
                    </div>

                    {/* Total score */}
                    <input
                      type="number" value={combat[ab]} min={1} max={30}
                      onChange={e => setCombat(p => ({ ...p, [ab]: +e.target.value }))}
                      className="ifield text-center text-lg font-bold"
                      style={{ padding: '2px 4px', background: 'transparent', border: 'none' }}
                    />
                    <div className="text-xs font-semibold mb-2" style={{ color: 'var(--cs-accent)' }}>
                      {mod(combat[ab])}
                    </div>

                    {/* Breakdown */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.3rem' }}>
                      <div className="text-[0.6rem] mb-0.5"
                        style={{ color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>
                        Base
                      </div>
                      <input
                        type="number"
                        value={base ?? ''}
                        placeholder="—"
                        min={1} max={20}
                        onChange={e => {
                          const v = e.target.value === '' ? null : +e.target.value
                          setCombat(p => ({ ...p, [baseKey]: v }))
                        }}
                        className="ifield text-center text-xs"
                        style={{ padding: '1px 2px', background: 'transparent', border: 'none', width: '100%' }}
                      />
                      {bonus != null && (
                        <div className="text-[0.6rem] mt-0.5"
                          style={{ color: bonus > 0 ? 'var(--cs-gold)' : 'var(--danger)' }}>
                          {bonus >= 0 ? `+${bonus}` : bonus} bono
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section: HP / AC / Prof */}
          <h3 className="font-semibold text-sm"
            style={{ color: 'var(--cs-text-muted)' }}>
            Combate
          </h3>
          <div className="parchment-page rounded-xl p-4">
            <div className="grid grid-cols-4 gap-3 mb-3">
              <F label="HP max">
                <input type="number" value={combat.hp_max}
                  onChange={e => setCombat(p => ({ ...p, hp_max: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="HP actual">
                <input type="number" value={combat.hp_current}
                  onChange={e => setCombat(p => ({ ...p, hp_current: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="HP temp">
                <input type="number" value={combat.hp_temp}
                  onChange={e => setCombat(p => ({ ...p, hp_temp: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Dados de golpe">
                <input value={combat.hit_dice_total}
                  onChange={e => setCombat(p => ({ ...p, hit_dice_total: e.target.value }))}
                  placeholder="5d6+1d8" className="ifield" />
              </F>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <F label="CA">
                <input type="number" value={combat.ac}
                  onChange={e => setCombat(p => ({ ...p, ac: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Bonus Prof.">
                <input type="number" value={combat.proficiency_bonus}
                  onChange={e => setCombat(p => ({ ...p, proficiency_bonus: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Bonus Iniciativa">
                <input type="number" value={combat.initiative_bonus}
                  onChange={e => setCombat(p => ({ ...p, initiative_bonus: +e.target.value }))}
                  className="ifield" />
              </F>
            </div>
          </div>

          {/* Section: Coins */}
          <h3 className="font-semibold text-sm"
            style={{ color: 'var(--cs-text-muted)' }}>
            Monedas
          </h3>
          <div className="parchment-page rounded-xl p-3">
            <div className="grid grid-cols-4 gap-2">
              {(['pp', 'gp', 'sp', 'cp'] as const).map(c => (
                <F key={c} label={c.toUpperCase()}>
                  <input type="number" value={combat[c]}
                    onChange={e => setCombat(p => ({ ...p, [c]: +e.target.value }))}
                    className="ifield text-center" />
                </F>
              ))}
            </div>
          </div>

          <SaveBtn onClick={saveCombat} saving={saving} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         SKILLS TAB — proficiency, expertise, advantage
         ════════════════════════════════════════════════════════ */}
      {tab === 'skills' && (
        <div className="space-y-4">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1rem', alignItems: 'start' }}>
            {/* Left: Skills list */}
            <div className="parchment-page rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--cs-text-muted)' }}>
                Skills
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--cs-text-muted)' }}>
                Click the dot to cycle: none → proficient → expertise.
              </p>
              <div className="space-y-0.5">
                {SKILLS.map(skill => {
                  const prof = getSkillProf(skill.key)
                  const level = prof?.proficiency_level ?? 'none'
                  const adv = prof?.has_advantage ?? false
                  const bonus = calcSkillBonus(skill.key, skill.ability)
                  const sign = bonus >= 0 ? '+' : ''
                  return (
                    <div key={skill.key} className="flex items-center gap-2 py-1"
                      style={{ borderBottom: '1px solid var(--cs-gold)' }}>
                      <button
                        onClick={() => cycleProf(skill.key)}
                        title={level === 'none' ? 'None' : level === 'proficient' ? 'Proficient' : 'Expertise'}
                        style={{
                          width: 14, height: 14, borderRadius: '50%', border: 'none',
                          cursor: 'pointer', flexShrink: 0,
                          background: level === 'expertise'
                            ? 'var(--cs-gold)'
                            : level === 'proficient'
                              ? 'var(--cs-accent)'
                              : 'rgba(201,173,106,0.3)',
                          boxShadow: level !== 'none' ? '0 0 3px rgba(0,0,0,0.3)' : 'none',
                        }}
                      />
                      <span className="flex-1 text-sm" style={{
                        color: level !== 'none' ? 'var(--cs-text)' : 'var(--cs-text-muted)',
                        fontWeight: level !== 'none' ? 600 : 400,
                      }}>
                        {skill.name}
                      </span>
                      <span className="text-sm font-semibold w-8 text-right" style={{
                        color: level === 'expertise'
                          ? 'var(--cs-gold)'
                          : level === 'proficient'
                            ? 'var(--cs-accent)'
                            : 'var(--cs-text-muted)',
                      }}>
                        {sign}{bonus}
                      </span>
                      <span className="text-xs w-8 text-right" style={{ color: 'var(--cs-text-muted)' }}>
                        {ABILITY_LABELS[skill.ability]}
                      </span>
                      <button
                        onClick={() => toggleAdvantage(skill.key)}
                        title={adv ? 'Has advantage' : 'No advantage'}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: adv ? 'var(--hp-good)' : 'transparent',
                          color: adv ? 'white' : 'var(--cs-text)',
                          border: adv ? 'none' : '1px solid var(--cs-gold)',
                          cursor: 'pointer', fontSize: '0.65rem',
                          fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                          letterSpacing: '0.03em', minWidth: 30,
                        }}>
                        ADV
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(201,173,106,0.3)', display: 'inline-block' }} /> None
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cs-accent)', display: 'inline-block' }} /> Proficient
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cs-gold)', display: 'inline-block' }} /> Expertise
                </span>
              </div>
            </div>

            {/* Right: Suggestions from class/race/background/feats */}
            <div className="parchment-page rounded-xl p-4" style={{ position: 'sticky', top: '1rem' }}>
              <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--cs-text-muted)', fontFamily: 'var(--font-cinzel, Cinzel, serif)' }}>
                Available from your build
              </h3>
              {loadingSuggestions ? (
                <p className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>Loading...</p>
              ) : skillSuggestions.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                  No suggestions found. Make sure your class, race, and background are set.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Group by type */}
                  {(['proficiency', 'choice', 'expertise', 'advantage'] as const).map(type => {
                    const items = skillSuggestions.filter(s => s.type === type)
                    if (items.length === 0) return null
                    const label = type === 'proficiency' ? 'Proficiency (granted)'
                      : type === 'choice' ? 'Proficiency (choose)'
                      : type === 'expertise' ? 'Expertise'
                      : 'Advantage'
                    const color = type === 'proficiency' ? 'var(--cs-accent)'
                      : type === 'choice' ? 'var(--cs-text)'
                      : type === 'expertise' ? 'var(--cs-gold)'
                      : 'var(--hp-good)'
                    return (
                      <div key={type}>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1"
                          style={{ color, fontFamily: 'var(--font-cinzel, Cinzel, serif)', letterSpacing: '0.05em' }}>
                          {label}
                        </div>
                        {items.map((s, i) => {
                          const isApplicable = s.type === 'proficiency' || s.type === 'advantage' || s.type === 'choice'
                          const skillKey = s.skill.charAt(0).toUpperCase() + s.skill.slice(1)
                          const alreadySet = localProfs.some(p => p.name.toLowerCase() === s.skill.toLowerCase() &&
                            (s.type === 'proficiency' || s.type === 'choice' ? p.proficiency_level !== 'none' : s.type === 'advantage' ? p.has_advantage : false))
                          return (
                            <div key={`${s.skill}-${s.source}-${i}`}
                              className="flex items-center gap-1.5 py-0.5"
                              style={{ borderBottom: '1px solid var(--cs-gold)' }}>
                              <span className="flex-1 text-xs" style={{
                                color: alreadySet ? 'var(--cs-text)' : 'var(--cs-text)',
                                textDecoration: alreadySet ? 'line-through' : 'none',
                              }}>
                                {skillKey}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--cs-text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.source}
                              </span>
                              {isApplicable && !alreadySet && (
                                <button
                                  onClick={() => {
                                    if (s.type === 'proficiency' || s.type === 'choice') {
                                      const match = SKILLS.find(sk => sk.key.toLowerCase() === s.skill.toLowerCase())
                                      const key = match?.key ?? skillKey
                                      const existing = localProfs.find(p => p.name === key)
                                      if (!existing) {
                                        setLocalProfs(prev => [...prev, {
                                          id: `new_${key}`,
                                          character_id: character.id,
                                          type: 'skill' as const,
                                          name: key,
                                          proficiency_level: 'proficient' as ProficiencyLevel,
                                          has_advantage: false,
                                        }])
                                      } else if (existing.proficiency_level === 'none') {
                                        setLocalProfs(prev => prev.map(p => p.name === key ? { ...p, proficiency_level: 'proficient' as ProficiencyLevel } : p))
                                      }
                                    } else if (s.type === 'advantage') {
                                      const match = SKILLS.find(sk => sk.key.toLowerCase() === s.skill.toLowerCase())
                                      const key = match?.key ?? skillKey
                                      toggleAdvantage(key)
                                    }
                                  }}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: color, color: 'white', border: 'none',
                                    cursor: 'pointer', fontSize: '0.6rem', fontWeight: 700,
                                  }}>
                                  +
                                </button>
                              )}
                              {alreadySet && (
                                <span className="text-xs" style={{ color: 'var(--hp-good)' }}>✓</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <SaveBtn onClick={saveSkills} saving={saving} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         SPELLS TAB — with 5etools spell browsing
         ════════════════════════════════════════════════════════ */}
      {tab === 'spells' && (
        <div className="space-y-4">
          {/* Add spell form */}
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Agregar hechizo
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Clase">
                <select value={newSpell.class_id}
                  onChange={e => setNewSpell(p => ({ ...p, class_id: e.target.value }))}
                  className="ifield">
                  {localClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </F>
              <F label="Nivel">
                <select value={newSpell.spell_level}
                  onChange={e => setNewSpell(p => ({ ...p, spell_level: +e.target.value }))}
                  className="ifield">
                  <option value={0}>Cantrip (0)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <option key={n} value={n}>Level {n}</option>
                  ))}
                </select>
              </F>
            </div>

            {/* Spell name: button to open modal, or manual input */}
            <div className="flex items-center gap-2 mb-1">
              <input type="checkbox" id="offclass" checked={isOffClassSpell}
                onChange={e => setIsOffClassSpell(e.target.checked)} />
              <label htmlFor="offclass" className="text-xs"
                style={{ color: 'var(--cs-text-muted)' }}>
                Entrada manual (nombre libre)
              </label>
            </div>

            {isOffClassSpell ? (
              <F label="Spell name">
                <input value={newSpell.name}
                  onChange={e => setNewSpell(p => ({ ...p, name: e.target.value }))}
                  className="ifield" placeholder="Spell name..." />
              </F>
            ) : (
              <div>
                <label className="block text-xs font-medium mb-1 capitalize"
                  style={{ color: 'var(--cs-text-muted)' }}>Spell name</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input value={newSpell.name} readOnly className="ifield"
                    placeholder="Click to browse spells..."
                    style={{ cursor: 'pointer', flex: 1 }}
                    onClick={() => setSpellModalOpen(true)} />
                  <button onClick={() => setSpellModalOpen(true)} className="btn-primary"
                    style={{ whiteSpace: 'nowrap', padding: '0.4rem 0.8rem' }}>
                    Browse Spells
                  </button>
                </div>
              </div>
            )}

            {/* Spell source type */}
            <div className="grid grid-cols-2 gap-3">
              <F label="Tipo">
                <select value={newSpell.source_type}
                  onChange={e => setNewSpell(p => ({ ...p, source_type: e.target.value as 'spell' | 'scroll' | 'charges' }))}
                  className="ifield">
                  <option value="spell">Hechizo (spell slot)</option>
                  <option value="scroll">Pergamino (un uso)</option>
                  <option value="charges">Cargas (item)</option>
                </select>
              </F>
              {newSpell.source_type === 'charges' && (
                <F label="Cargas max.">
                  <input type="number" value={newSpell.charges_max ?? ''}
                    onChange={e => setNewSpell(p => ({ ...p, charges_max: e.target.value ? +e.target.value : null }))}
                    className="ifield" placeholder="3" min={1} />
                </F>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <F label="Components">
                <input value={newSpell.components}
                  onChange={e => setNewSpell(p => ({ ...p, components: e.target.value }))}
                  className="ifield" placeholder="V, S, M" />
              </F>
              <F label="Range">
                <input value={newSpell.range}
                  onChange={e => setNewSpell(p => ({ ...p, range: e.target.value }))}
                  className="ifield" placeholder="120 feet, Touch..." />
              </F>
              <F label="Damage">
                <input value={newSpell.damage}
                  onChange={e => setNewSpell(p => ({ ...p, damage: e.target.value }))}
                  className="ifield" placeholder="1d10..." />
              </F>
              <F label="Notes">
                <input value={newSpell.custom_notes}
                  onChange={e => setNewSpell(p => ({ ...p, custom_notes: e.target.value }))}
                  className="ifield" placeholder="Concentration, DC 15..." />
              </F>
            </div>

            <button onClick={addSpell} className="btn-primary">+ Add Spell</button>
          </div>

          {/* Spell list grouped by level */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => {
            const lvlSpells = localSpells.filter(s => s.spell_level === lvl)
            if (!lvlSpells.length) return null
            return (
              <div key={lvl}>
                <h4 className="text-xs font-bold uppercase tracking-wide mb-2"
                  style={{ color: 'var(--cs-text-muted)' }}>
                  {lvl === 0 ? 'Cantrips' : `Level ${lvl}`}
                </h4>
                <div className="space-y-2">
                  {lvlSpells.map(s => (
                    <div key={s.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg parchment-page">
                      {s.is_always_prepared && (
                        <span title="Always prepared" className="text-xs opacity-70">&#128274;</span>
                      )}
                      {/* Source type badge */}
                      {s.source_type === 'scroll' && (
                        <span title="Pergamino" className="text-xs"
                          style={{ color: 'var(--cs-gold-dk)', fontWeight: 600 }}>
                          &#128220;
                        </span>
                      )}
                      {s.source_type === 'charges' && (
                        <span title={`Cargas: ${(s.charges_max ?? 0) - (s.charges_used ?? 0)}/${s.charges_max ?? 0}`}
                          className="text-xs"
                          style={{ color: 'var(--hp-warn)', fontWeight: 600 }}>
                          &#9889; {(s.charges_max ?? 0) - (s.charges_used ?? 0)}/{s.charges_max ?? 0}
                        </span>
                      )}
                      <span className="flex-1 text-sm font-medium"
                        style={{ color: 'var(--cs-text)' }}>
                        {s.name}
                      </span>
                      {s.components && (
                        <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                          {s.components}
                        </span>
                      )}
                      {s.range && (
                        <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                          {s.range}
                        </span>
                      )}
                      {s.damage && (
                        <span className="text-xs" style={{ color: 'var(--cs-gold)' }}>
                          {s.damage}
                        </span>
                      )}
                      {s.custom_notes && (
                        <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                          {s.custom_notes}
                        </span>
                      )}
                      <button onClick={() => deleteSpell(s.id)}
                        className="text-xs" style={{ color: 'var(--danger)' }}>
                        &#10005;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Spell Modal */}
          <SpellModal
            open={spellModalOpen}
            onClose={() => setSpellModalOpen(false)}
            onSelect={handleSpellSelect}
            spells={spellList}
            characterClasses={localClasses.map(c => c.class_name)}
            defaultClass={localClasses.find(c => c.id === newSpell.class_id)?.class_name ?? localClasses[0]?.class_name ?? ''}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         WEAPONS TAB — with 5etools weapon autocomplete
         ════════════════════════════════════════════════════════ */}
      {tab === 'weapons' && (
        <div className="space-y-4">
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Agregar ataque
            </h3>
            {/* Weapon category filter */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'simple', 'martial'] as const).map(f => (
                <button key={f} onClick={() => setWeaponCatFilter(f)}
                  className="text-xs px-3 py-1 rounded-full border transition-all"
                  style={{
                    background: weaponCatFilter === f ? 'var(--cs-accent)' : 'transparent',
                    borderColor: weaponCatFilter === f ? 'var(--cs-accent)' : 'rgba(201,173,106,0.3)',
                    color: weaponCatFilter === f ? '#fff' : 'var(--cs-text-muted)',
                  }}>
                  {f === 'all' ? 'Todas' : f === 'simple' ? 'Simple' : 'Marcial'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre">
                <Autocomplete
                  value={newWeapon.name}
                  onChange={handleWeaponAutocomplete}
                  options={weaponItems
                    .filter(w => weaponCatFilter === 'all' || w.weaponCategory === weaponCatFilter)
                    .map(w => w.name)}
                  placeholder="Buscar arma..."
                />
              </F>
              <F label="Bonus Ataque">
                <input value={newWeapon.atk_bonus}
                  onChange={e => setNewWeapon(p => ({ ...p, atk_bonus: e.target.value }))}
                  className="ifield" placeholder="+4" />
              </F>
              <F label="Dano">
                <input value={newWeapon.damage}
                  onChange={e => setNewWeapon(p => ({ ...p, damage: e.target.value }))}
                  className="ifield" placeholder="1d8+1" />
              </F>
              <F label="Tipo de dano">
                <input value={newWeapon.damage_type}
                  onChange={e => setNewWeapon(p => ({ ...p, damage_type: e.target.value }))}
                  className="ifield" placeholder="Perforante..." />
              </F>
              <F label="Alcance">
                <input value={newWeapon.range}
                  onChange={e => setNewWeapon(p => ({ ...p, range: e.target.value }))}
                  className="ifield" placeholder="80/320ft" />
              </F>
              <F label="Notas">
                <input value={newWeapon.notes}
                  onChange={e => setNewWeapon(p => ({ ...p, notes: e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Mod. de habilidad">
                <select value={newWeapon.ability_mod}
                  onChange={e => setNewWeapon(p => ({ ...p, ability_mod: e.target.value }))}
                  className="ifield">
                  <option value="">— ninguno —</option>
                  {(['str','dex','con','int','wis','cha'] as const).map(a => (
                    <option key={a} value={a}>{ABILITY_LABELS[a] ?? a.toUpperCase()}</option>
                  ))}
                </select>
              </F>
              <F label="Daño extra (fórmula)">
                <input value={newWeapon.extra_damage}
                  onChange={e => setNewWeapon(p => ({ ...p, extra_damage: e.target.value }))}
                  className="ifield" placeholder="1d6 frío, 2d4 fuego" />
              </F>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-1"
              style={{ color: 'var(--cs-text-muted)' }}>
              <input type="checkbox" checked={newWeapon.is_proficient}
                onChange={e => setNewWeapon(p => ({ ...p, is_proficient: e.target.checked }))} />
              Proficiente con esta arma
            </label>
            <button onClick={addWeapon} className="btn-primary mt-2">+ Agregar</button>
          </div>

          <div className="space-y-2">
            {localWeapons.map(w => (
              <div key={w.id} className="rounded-lg parchment-page overflow-hidden">
                {editingWeaponId === w.id ? (
                  /* ── inline edit form ── */
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <F label="Nombre">
                        <input value={editWeapon.name}
                          onChange={e => setEditWeapon(p => ({ ...p, name: e.target.value }))}
                          className="ifield" />
                      </F>
                      <F label="Bonus Ataque">
                        <input value={editWeapon.atk_bonus}
                          onChange={e => setEditWeapon(p => ({ ...p, atk_bonus: e.target.value }))}
                          className="ifield" placeholder="+4" />
                      </F>
                      <F label="Daño">
                        <input value={editWeapon.damage}
                          onChange={e => setEditWeapon(p => ({ ...p, damage: e.target.value }))}
                          className="ifield" placeholder="1d8+1" />
                      </F>
                      <F label="Tipo de daño">
                        <input value={editWeapon.damage_type}
                          onChange={e => setEditWeapon(p => ({ ...p, damage_type: e.target.value }))}
                          className="ifield" placeholder="Perforante..." />
                      </F>
                      <F label="Alcance">
                        <input value={editWeapon.range}
                          onChange={e => setEditWeapon(p => ({ ...p, range: e.target.value }))}
                          className="ifield" placeholder="80/320ft" />
                      </F>
                      <F label="Notas">
                        <input value={editWeapon.notes}
                          onChange={e => setEditWeapon(p => ({ ...p, notes: e.target.value }))}
                          className="ifield" />
                      </F>
                      <F label="Mod. de habilidad">
                        <select value={editWeapon.ability_mod}
                          onChange={e => setEditWeapon(p => ({ ...p, ability_mod: e.target.value }))}
                          className="ifield">
                          <option value="">— ninguno —</option>
                          {(['str','dex','con','int','wis','cha'] as const).map(a => (
                            <option key={a} value={a}>{ABILITY_LABELS[a] ?? a.toUpperCase()}</option>
                          ))}
                        </select>
                      </F>
                      <F label="Daño extra (fórmula)">
                        <input value={editWeapon.extra_damage}
                          onChange={e => setEditWeapon(p => ({ ...p, extra_damage: e.target.value }))}
                          className="ifield" placeholder="1d6 frío, 2d4 fuego" />
                      </F>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer"
                      style={{ color: 'var(--cs-text-muted)' }}>
                      <input type="checkbox" checked={editWeapon.is_proficient}
                        onChange={e => setEditWeapon(p => ({ ...p, is_proficient: e.target.checked }))} />
                      Proficiente con esta arma
                    </label>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => saveWeapon(w.id)} className="btn-primary text-xs px-3 py-1">Guardar</button>
                      <button onClick={() => setEditingWeaponId(null)}
                        className="text-xs px-3 py-1 rounded"
                        style={{ border: '1px solid var(--cs-gold)', color: 'var(--cs-text-muted)', background: 'transparent' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── read row ── */
                  <div className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="flex-1 font-medium" style={{ color: 'var(--cs-text)' }}>{w.name}</span>
                    {w.atk_bonus && <span style={{ color: 'var(--cs-gold)' }}>{w.atk_bonus}</span>}
                    {w.damage && <span style={{ color: 'var(--cs-text-muted)' }}>{w.damage}</span>}
                    {w.damage_type && <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>{w.damage_type}</span>}
                    {w.range && <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>{w.range}</span>}
                    <button onClick={() => startEditWeapon(w)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ border: '1px solid var(--cs-gold)', color: 'var(--cs-gold)', background: 'transparent' }}>
                      Editar
                    </button>
                    <button onClick={() => deleteWeapon(w.id)} style={{ color: 'var(--danger)' }}>&#10005;</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         EQUIPMENT TAB — with sell-for-gold
         ════════════════════════════════════════════════════════ */}
      {tab === 'equipment' && (
        <div className="space-y-4">
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Agregar item
            </h3>
            {/* Equipment category filter */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                ['all', 'Todos'],
                ['weapon', 'Arma'],
                ['armor', 'Armadura'],
                ['potion', 'Poción'],
                ['scroll', 'Pergamino'],
                ['rod', 'Vara'],
                ['wand', 'Varita'],
                ['ring', 'Anillo'],
                ['focus', 'Foco'],
                ['tool', 'Herramienta'],
                ['gear', 'Equipo'],
                ['other', 'Otro'],
              ].map(([f, label]) => (
                <button key={f} onClick={() => setEquipCatFilter(f)}
                  className="text-xs px-2.5 py-0.5 rounded-full border transition-all"
                  style={{
                    background: equipCatFilter === f ? 'var(--cs-accent)' : 'transparent',
                    borderColor: equipCatFilter === f ? 'var(--cs-accent)' : 'rgba(201,173,106,0.3)',
                    color: equipCatFilter === f ? '#fff' : 'var(--cs-text-muted)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {/* Rarity filter */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                ['all', 'Toda rareza'],
                ['none', 'No mágico'],
                ['common', 'Común'],
                ['uncommon', 'Poco común'],
                ['rare', 'Raro'],
                ['very rare', 'Muy raro'],
                ['legendary', 'Legendario'],
                ['artifact', 'Artefacto'],
              ].map(([f, label]) => {
                const isActive = equipRarityFilter === f;
                const accent = RARITY_COLORS[f] || 'var(--cs-accent)';
                return (
                  <button key={f} onClick={() => setEquipRarityFilter(f)}
                    className="text-xs px-2.5 py-0.5 rounded-full border transition-all"
                    style={{
                      background: isActive ? accent : 'transparent',
                      borderColor: isActive ? accent : 'rgba(201,173,106,0.3)',
                      color: isActive ? '#fff' : 'var(--cs-text-muted)',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre">
                <Autocomplete
                  value={newEquip.name}
                  onChange={handleEquipAutocomplete}
                  options={equipmentItems
                    .filter(e =>
                      (equipCatFilter === 'all' || e.category === equipCatFilter) &&
                      (equipRarityFilter === 'all' || e.rarity === equipRarityFilter)
                    )
                    .map(e => e.name)}
                  placeholder="Buscar item..."
                />
              </F>
              <F label="Cantidad">
                <input type="number" value={newEquip.quantity} min={1}
                  onChange={e => setNewEquip(p => ({ ...p, quantity: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Peso">
                <input value={newEquip.weight}
                  onChange={e => setNewEquip(p => ({ ...p, weight: e.target.value }))}
                  className="ifield" placeholder="1 lb" />
              </F>
              <F label="Notas">
                <input value={newEquip.notes}
                  onChange={e => setNewEquip(p => ({ ...p, notes: e.target.value }))}
                  className="ifield" />
              </F>
            </div>
            {newEquip.notes && parseItemValue(newEquip.notes) != null && (
              <p className="text-xs" style={{ color: 'var(--cs-gold)' }}>
                Valor: {parseItemValue(newEquip.notes)} gp
              </p>
            )}
            {equipContents && equipContents.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--ink-light)', fontStyle: 'italic' }}>
                Contiene: {equipContents.join(', ')}
              </p>
            )}
            <button onClick={addEquipment} className="btn-primary">+ Agregar</button>
          </div>

          <div className="space-y-2">
            {localEquipment.map(item => {
              const itemValue = parseItemValue(item.notes)
              const extraNotes = cleanNotes(item.notes)
              const catalogItem = equipmentItems.find(e => e.name === item.name)
              const contents = catalogItem?.contents ?? []
              return (
                <div key={item.id} className="rounded-lg parchment-page overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm font-medium"
                      style={{ color: 'var(--cs-text-muted)' }}>
                      x{item.quantity}
                    </span>
                    <span className="flex-1 font-medium text-sm"
                      style={{ color: 'var(--cs-text)' }}>
                      {item.name}
                    </span>
                    {itemValue != null && (
                      <span className="text-xs"
                        style={{ color: 'var(--cs-gold)' }}>
                        {itemValue} gp
                      </span>
                    )}
                    {extraNotes && (
                      <span className="text-xs"
                        style={{ color: 'var(--cs-text-muted)' }}>
                        {extraNotes}
                      </span>
                    )}
                    {itemValue != null && itemValue > 0 && (
                      <button onClick={() => sellItem(item)}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: 'var(--cs-gold-dk)',
                          color: 'var(--cs-card)',
                          fontSize: '0.7rem',
                          fontFamily: 'Cinzel, serif',
                          letterSpacing: '0.03em',
                        }}>
                        Vender
                      </button>
                    )}
                    <button onClick={() => deleteEquipment(item.id)}
                      style={{ color: 'var(--danger)' }}>
                      &#10005;
                    </button>
                  </div>
                  {contents.length > 0 && (
                    <div className="px-4 pb-3 pt-0"
                      style={{ borderTop: '1px solid var(--border)', marginTop: '-1px' }}>
                      <p className="text-xs font-semibold mb-1"
                        style={{ color: 'var(--cs-text-muted)' }}>Contenido:</p>
                      <div className="flex flex-wrap gap-1">
                        {contents.map((c, i) => {
                          const [qty, ...nameParts] = /^\d+x /.test(c)
                            ? [c.match(/^(\d+)x /)?.[1] ?? '1', c.replace(/^\d+x /, '')]
                            : ['1', c.split('|')[0]]
                          const label = nameParts.join(' ') || c.split('|')[0]
                          return (
                            <span key={i} className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: 'var(--cs-card)',
                                color: 'var(--cs-text)',
                                border: '1px solid var(--border)',
                              }}>
                              {qty !== '1' ? `${qty}× ` : ''}{label}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         FEATURES TAB — with auto-populate from 5etools
         ════════════════════════════════════════════════════════ */}
      {tab === 'features' && (
        <div className="space-y-4">
          {/* Auto-populate button */}
          <button onClick={loadAutoTraits} disabled={loadingTraits}
            className="btn-primary"
            style={{ opacity: loadingTraits ? 0.6 : 1 }}>
            {loadingTraits ? 'Loading traits...' : 'Load Auto Traits'}
          </button>

          {/* Feats picker */}
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Elegir Dote (Feat)
            </h3>
            <Autocomplete
              value={featQuery}
              onChange={q => {
                setFeatQuery(q)
                const f = allFeats.find(x => x.name === q)
                if (f) {
                  setNewFeature({
                    name: f.name,
                    description: cleanTaggedText(f.description ?? null),
                    source: 'Feat',
                  })
                  setFeatQuery('')
                }
              }}
              options={allFeats.map(f => f.name)}
              placeholder="Buscar dote..."
            />
            {allFeats.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                Cargando dotes...
              </p>
            )}
          </div>

          {/* Manual add form */}
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Agregar rasgo / habilidad
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre">
                <input value={newFeature.name}
                  onChange={e => setNewFeature(p => ({ ...p, name: e.target.value }))}
                  className="ifield" placeholder="Darkvision..." />
              </F>
              <F label="Fuente">
                <input value={newFeature.source}
                  onChange={e => setNewFeature(p => ({ ...p, source: e.target.value }))}
                  className="ifield" placeholder="raza, clase, homebrew..." />
              </F>
            </div>
            <F label="Descripción">
              <textarea value={newFeature.description}
                onChange={e => setNewFeature(p => ({ ...p, description: e.target.value }))}
                rows={3} className="ifield resize-none" />
            </F>
            <button onClick={addFeature} className="btn-primary">+ Agregar</button>
          </div>

          {/* Feature grid — 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {localFeatures.map(f => {
              const isExpanded = expandedFeature === f.id
              const cleanDesc = cleanTaggedText(f.description)
              const hasDesc = cleanDesc.length > 0
              return (
                <div key={f.id}
                  className="parchment-page rounded-lg"
                  style={{
                    cursor: hasDesc ? 'pointer' : 'default',
                    transition: 'box-shadow 0.15s',
                    gridColumn: isExpanded ? '1 / -1' : undefined,
                  }}
                  onClick={() => hasDesc && setExpandedFeature(isExpanded ? null : f.id)}>
                  <div style={{ padding: '0.6rem 0.75rem' }}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 flex-wrap" style={{ flex: 1 }}>
                        <span style={{
                          fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                          fontSize: '0.88rem', fontWeight: 600,
                          color: 'var(--cs-gold)',
                        }}>
                          {f.name}
                        </span>
                        {f.source && (
                          <span style={{
                            fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: '2px',
                            background: f.source.startsWith('Raza:') || f.source.startsWith('Race:')
                              ? 'var(--cs-gold-dk)'
                              : f.source.startsWith('Clase:') || f.source.startsWith('Class:')
                                ? 'var(--cs-accent)'
                                : f.source.startsWith('Subclase:') || f.source.startsWith('Subclass:')
                                  ? 'rgba(201,173,106,0.4)'
                                  : 'rgba(201,173,106,0.5)',
                            color: 'var(--cs-card)',
                            fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                            letterSpacing: '0.03em',
                          }}>
                            {f.source}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                        {hasDesc && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--cs-text)' }}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); deleteFeature(f.id) }}
                          style={{ color: 'var(--danger)', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.2rem' }}>
                          &#10005;
                        </button>
                      </div>
                    </div>
                    {!isExpanded && hasDesc && (
                      <p style={{
                        fontSize: '0.78rem', color: 'var(--cs-text-muted)',
                        marginTop: '0.25rem', lineHeight: 1.35,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {cleanDesc.length > 80 ? cleanDesc.slice(0, 77) + '...' : cleanDesc}
                      </p>
                    )}
                    {isExpanded && (
                      <p style={{
                        fontSize: '0.85rem', color: 'var(--cs-text)',
                        marginTop: '0.35rem', lineHeight: 1.45,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {cleanDesc}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         RESOURCES TAB
         ════════════════════════════════════════════════════════ */}
      {tab === 'resources' && (
        <div className="space-y-4">
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Agregar recurso de clase (Sorcery Points, Ki, Superiority Dice, etc.)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre">
                <input value={newResource.name}
                  onChange={e => setNewResource(p => ({ ...p, name: e.target.value }))}
                  className="ifield" placeholder="Sorcery Points..." />
              </F>
              <F label="Maximo">
                <input type="number" value={newResource.maximum} min={0}
                  onChange={e => setNewResource(p => ({
                    ...p, maximum: +e.target.value, current: +e.target.value,
                  }))}
                  className="ifield" />
              </F>
              <F label="Actual">
                <input type="number" value={newResource.current} min={0}
                  onChange={e => setNewResource(p => ({ ...p, current: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Recupera en">
                <select value={newResource.reset_on}
                  onChange={e => setNewResource(p => ({
                    ...p, reset_on: e.target.value as ResetOn,
                  }))}
                  className="ifield">
                  <option value="long_rest">Descanso largo</option>
                  <option value="short_rest">Descanso corto</option>
                  <option value="manual">Manual</option>
                </select>
              </F>
            </div>
            <button onClick={addResource} className="btn-primary">+ Agregar recurso</button>
          </div>

          <div className="space-y-2">
            {localResources.map(r => (
              <div key={r.id} className="rounded-lg parchment-page overflow-hidden">
                {editingResourceId === r.id ? (
                  <div className="p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <F label="Nombre">
                        <input value={editResource.name}
                          onChange={e => setEditResource(p => ({ ...p, name: e.target.value }))}
                          className="ifield" />
                      </F>
                      <F label="Recupera en">
                        <select value={editResource.reset_on}
                          onChange={e => setEditResource(p => ({ ...p, reset_on: e.target.value as ResetOn }))}
                          className="ifield">
                          <option value="long_rest">Descanso largo</option>
                          <option value="short_rest">Descanso corto</option>
                          <option value="manual">Manual</option>
                        </select>
                      </F>
                      <F label="Actual">
                        <input type="number" value={editResource.current} min={0}
                          onChange={e => setEditResource(p => ({ ...p, current: +e.target.value }))}
                          className="ifield" />
                      </F>
                      <F label="Máximo">
                        <input type="number" value={editResource.maximum} min={0}
                          onChange={e => setEditResource(p => ({ ...p, maximum: +e.target.value }))}
                          className="ifield" />
                      </F>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => saveResource(r.id)} className="btn-primary text-xs px-3 py-1">Guardar</button>
                      <button onClick={() => setEditingResourceId(null)}
                        className="text-xs px-3 py-1 rounded"
                        style={{ border: '1px solid var(--cs-gold)', color: 'var(--cs-text-muted)', background: 'transparent' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="flex-1 font-medium" style={{ color: 'var(--cs-text)' }}>{r.name}</span>
                    <span style={{ color: 'var(--cs-text-muted)' }}>{r.current}/{r.maximum}</span>
                    <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                      {r.reset_on === 'short_rest' ? 'desc. corto' : r.reset_on === 'long_rest' ? 'desc. largo' : 'manual'}
                    </span>
                    <button onClick={() => startEditResource(r)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ border: '1px solid var(--cs-gold)', color: 'var(--cs-gold)', background: 'transparent' }}>
                      Editar
                    </button>
                    <button onClick={() => deleteResource(r.id)} style={{ color: 'var(--danger)' }}>&#10005;</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom tab removed — use Recursos instead */}
      {tab === 'custom' && (
        <div className="parchment-page rounded-xl p-6 text-center">
          <p className="text-sm" style={{ color: 'var(--cs-text-muted)' }}>
            Usa el tab <strong>Recursos</strong> para rastrear contadores y recursos personalizados.
          </p>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   LANGUAGE SECTION
   ══════════════════════════════════════════════════════════════ */

function LanguageSection({
  race, subrace, background,
  langChoices, setLangChoices,
  customLangInput, setCustomLangInput,
}: {
  race: string; subrace: string; background: string
  langChoices: string[]; setLangChoices: (v: string[]) => void
  customLangInput: string; setCustomLangInput: (v: string) => void
}) {
  const { grants, autoFixed } = getLanguageGrants({
    race: race || undefined,
    subrace: subrace || undefined,
    background: background || undefined,
  })

  // Total choice slots from all grants
  const choiceSlots: Array<{ source: string; from: string[] }> = []
  for (const g of grants) {
    if (g.chooseFrom.length > 0) {
      for (let i = 0; i < g.chooseFrom.length; i++) {
        choiceSlots.push({ source: g.source, from: g.chooseFrom })
      }
    } else {
      for (let i = 0; i < g.anyStandard; i++) {
        choiceSlots.push({ source: g.source, from: ALL_LANGUAGES })
      }
    }
  }

  // Choices that are not auto-fixed (user picks)
  const nonAutoChoices = langChoices.filter(l => !autoFixed.includes(l))
  // Custom languages = anything beyond choice slots
  const customLangs = nonAutoChoices.slice(choiceSlots.length)

  function setChoiceAt(i: number, val: string) {
    const next = [...nonAutoChoices]
    next[i] = val
    // Rebuild: choices first, then custom
    const customs = next.slice(choiceSlots.length)
    setLangChoices([...next.slice(0, choiceSlots.length).filter(Boolean), ...customs])
  }

  function addCustom() {
    const trimmed = customLangInput.trim()
    if (!trimmed) return
    const alreadyHave = [...autoFixed, ...nonAutoChoices]
    if (!alreadyHave.includes(trimmed)) {
      setLangChoices([...langChoices.filter(l => !autoFixed.includes(l)), trimmed])
    }
    setCustomLangInput('')
  }

  function removeCustom(lang: string) {
    setLangChoices(langChoices.filter(l => l !== lang))
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em',
    color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif',
    textTransform: 'uppercase', marginBottom: '0.5rem',
  }
  const badge: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.2rem 0.6rem',
    background: 'rgba(201,173,106,0.18)', border: '1px solid var(--cs-gold)',
    borderRadius: '2px', fontSize: '0.82rem', color: 'var(--cs-text)',
    fontFamily: 'Crimson Text, serif',
  }
  const sourceLabel: React.CSSProperties = {
    fontSize: '0.65rem', color: 'var(--cs-text-muted)', opacity: 0.7,
  }

  return (
    <div className="parchment-page rounded-xl p-4 space-y-3">
      <div style={sectionTitle}>Idiomas</div>

      {/* Auto languages */}
      {autoFixed.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--cs-text-muted)', marginBottom: '0.4rem' }}>
            Automáticos
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {autoFixed.map(lang => {
              // Find which source gave this language
              const src = grants.find(g => g.fixed.includes(lang))?.source
                ?? (race ? `Raza: ${race}` : '')
              return (
                <span key={lang} style={badge}>
                  {lang}
                  {src && <span style={sourceLabel}>({src})</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Choice dropdowns */}
      {choiceSlots.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--cs-text-muted)', marginBottom: '0.4rem' }}>
            A elegir
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {choiceSlots.map((slot, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--cs-text-muted)', minWidth: 130 }}>
                  {slot.source}
                </span>
                <select
                  value={nonAutoChoices[i] ?? ''}
                  onChange={e => setChoiceAt(i, e.target.value)}
                  className="ifield"
                  style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.88rem' }}
                >
                  <option value="">— Elige idioma —</option>
                  {slot.from.map(l => (
                    <option key={l} value={l}
                      disabled={
                        autoFixed.includes(l) ||
                        nonAutoChoices.some((c, j) => j !== i && c === l)
                      }
                    >{l}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom languages */}
      {customLangs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {customLangs.map(lang => (
            <span key={lang} style={{ ...badge, gap: '0.4rem' }}>
              {lang}
              <button
                onClick={() => removeCustom(lang)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-accent)', fontSize: '0.8rem', padding: 0, lineHeight: 1 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Add extra language */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select
          value={customLangInput}
          onChange={e => setCustomLangInput(e.target.value)}
          className="ifield"
          style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.88rem' }}
        >
          <option value="">+ Añadir idioma adicional</option>
          {ALL_LANGUAGES.map(l => (
            <option key={l} value={l}
              disabled={[...autoFixed, ...nonAutoChoices].includes(l)}
            >{l}</option>
          ))}
          <option value="__custom__">Otro (escribir)...</option>
        </select>
        {customLangInput === '__custom__' && (
          <input
            type="text"
            placeholder="Idioma..."
            className="ifield"
            style={{ flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') addCustom() }}
            onChange={e => setCustomLangInput(e.target.value)}
            autoFocus
          />
        )}
        {customLangInput && customLangInput !== '__custom__' && (
          <button
            onClick={addCustom}
            style={{
              padding: '0.3rem 0.8rem', background: 'var(--cs-accent)', color: '#fff',
              border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '0.82rem',
              fontFamily: 'Cinzel, serif', letterSpacing: '0.05em',
            }}
          >
            Añadir
          </button>
        )}
      </div>

      {autoFixed.length === 0 && choiceSlots.length === 0 && customLangs.length === 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--cs-text-muted)', fontStyle: 'italic' }}>
          Selecciona raza y trasfondo para ver los idiomas automáticos.
        </p>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/** Field wrapper — used inside parchment cards, so labels use --text-muted (dark on light). */
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 capitalize"
        style={{ color: 'var(--cs-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="btn-primary mt-2 px-6 py-2.5 font-semibold text-sm"
      style={{ opacity: saving ? 0.6 : 1 }}>
      {saving ? 'Guardando...' : 'Guardar cambios'}
    </button>
  )
}
