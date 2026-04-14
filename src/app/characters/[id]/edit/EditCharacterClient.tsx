'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Autocomplete from '@/components/ui/Autocomplete'
import SpellModal from '@/components/ui/SpellModal'
import {
  fetchAllSpells, type SpellEntry,
  fetchEquipmentItems, type EquipmentItem,
  fetchRaceTraits, fetchClassFeatures, fetchSubclassFeatures,
  fetchClassDetails, fetchBackgroundSkills, fetchRaceSkills,
  type ClassDetail, type RaceSkillProf,
} from '@/lib/5etools/data'
import type {
  Character, CharacterClass, SpellSlot, CharacterSpell,
  CharacterWeapon, CharacterEquipment, CharacterFeature,
  CharacterProficiency, ClassResource, CustomStat, CustomStatType, ResetOn,
  ProficiencyLevel,
} from '@/modules/characters/types'
import { SKILLS, ABILITY_NAMES as AB_LABELS } from '@/lib/constants'

/* ── Constants ── */

const ABILITY_LABELS: Record<string, string> = AB_LABELS

const DMG_TYPE_MAP: Record<string, string> = {
  S: 'Cortante', P: 'Perforante', B: 'Contundente',
  A: 'Ácido', C: 'Frío', F: 'Fuego', L: 'Relámpago',
  N: 'Necrótico', O: 'Veneno', R: 'Radiante', T: 'Trueno',
}

type Tab = 'basic' | 'combat' | 'skills' | 'spells' | 'weapons' | 'equipment' | 'features' | 'resources' | 'custom'

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
  spellSlots,
  spells,
  weapons,
  equipment,
  features,
  proficiencies,
  classResources,
  customStats,
}: {
  character: Character
  classes: CharacterClass[]
  spellSlots: SpellSlot[]
  spells: CharacterSpell[]
  weapons: CharacterWeapon[]
  equipment: CharacterEquipment[]
  features: CharacterFeature[]
  proficiencies: CharacterProficiency[]
  classResources: ClassResource[]
  customStats: CustomStat[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  /* ── 5etools data ── */
  const [spellList, setSpellList] = useState<SpellEntry[]>([])
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [weaponItems, setWeaponItems] = useState<EquipmentItem[]>([])
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
  })

  /* ── Combat state ── */
  const [combat, setCombat] = useState({
    str: character.str, dex: character.dex, con: character.con,
    int: character.int, wis: character.wis, cha: character.cha,
    hp_max: character.hp_max, hp_current: character.hp_current, hp_temp: character.hp_temp,
    ac: character.ac, initiative_bonus: character.initiative_bonus,
    proficiency_bonus: character.proficiency_bonus,
    hit_dice_total: character.hit_dice_total ?? '',
    pp: character.pp, gp: character.gp, sp: character.sp, cp: character.cp,
  })

  /* ── Spells ── */
  const [localSpells, setLocalSpells] = useState(spells)
  const [isOffClassSpell, setIsOffClassSpell] = useState(false)
  const [newSpell, setNewSpell] = useState({
    class_id: classes[0]?.id ?? '',
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
  })

  /* ── Equipment ── */
  const [localEquipment, setLocalEquipment] = useState(equipment)
  const [newEquip, setNewEquip] = useState({ name: '', quantity: 1, weight: '', notes: '' })

  /* ── Features ── */
  const [localFeatures, setLocalFeatures] = useState(features)
  const [newFeature, setNewFeature] = useState({ name: '', description: '', source: '' })

  /* ── Resources ── */
  const [localResources, setLocalResources] = useState(classResources)
  const [newResource, setNewResource] = useState({
    name: '', current: 0, maximum: 0, reset_on: 'long_rest' as ResetOn,
  })

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

  // Spells — fetch all spells once (class filtering done in SpellModal)
  useEffect(() => {
    fetchAllSpells()
      .then(setSpellList)
      .catch(() => setSpellList([]))
  }, [])

  // Skill suggestions — from class, race, background, features
  useEffect(() => {
    async function loadSuggestions() {
      setLoadingSuggestions(true)
      const suggestions: SkillSuggestion[] = []

      try {
        // Class skill proficiencies
        const classDetails = await fetchClassDetails()
        for (const cls of classes) {
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
        const bgSkills = await fetchBackgroundSkills()
        const bgName = character.background ?? ''
        const bgMatch = bgSkills[bgName]
        if (bgMatch) {
          for (const s of bgMatch) {
            suggestions.push({ skill: s, source: `Background: ${bgName}`, type: 'proficiency' })
          }
        }

        // Race skills
        const raceSkills = await fetchRaceSkills()
        const raceName = character.subrace
          ? `${character.subrace} (${character.race})`
          : character.race ?? ''
        const raceMatch = raceSkills[raceName] ?? raceSkills[character.race ?? '']
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
        for (const f of features) {
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
  }, [classes, character.background, character.race, character.subrace, features])

  // Equipment & weapons on mount
  useEffect(() => {
    fetchEquipmentItems()
      .then(items => {
        setEquipmentItems(items)
        setWeaponItems(items.filter(i => i.weaponCategory || i.damage))
      })
      .catch(() => {
        setEquipmentItems([])
        setWeaponItems([])
      })
  }, [])

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
    await supabase.from('characters').update(basic).eq('id', character.id)
    showSaved()
  }

  async function saveCombat() {
    setSaving(true)
    await supabase.from('characters').update(combat).eq('id', character.id)
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
    let { data, error } = await supabase.from('character_spells').insert({
      ...base,
      source_type: newSpell.source_type,
      charges_max: newSpell.source_type === 'charges' ? (newSpell.charges_max ?? 1) : null,
      charges_used: 0,
    }).select().single()
    if (error && error.message?.includes('source_type')) {
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
    setNewWeapon({ name: '', atk_bonus: '', damage: '', damage_type: '', range: '', notes: '' })
  }

  async function deleteWeapon(id: string) {
    await supabase.from('character_weapons').delete().eq('id', id)
    setLocalWeapons(prev => prev.filter(w => w.id !== id))
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
    }
  }

  async function addEquipment() {
    if (!newEquip.name.trim()) return
    const { data } = await supabase.from('character_equipment').insert({
      character_id: character.id, ...newEquip, sort_order: localEquipment.length,
    }).select().single()
    if (data) setLocalEquipment(prev => [...prev, data])
    setNewEquip({ name: '', quantity: 1, weight: '', notes: '' })
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
      if (character.race) {
        const raceKey = character.subrace
          ? `${character.subrace} (${character.race})`
          : character.race
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
      for (const cls of classes) {
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
              <F label="Raza">
                <input value={basic.race}
                  onChange={e => setBasic(p => ({ ...p, race: e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Subraza">
                <input value={basic.subrace}
                  onChange={e => setBasic(p => ({ ...p, subrace: e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Trasfondo">
                <input value={basic.background}
                  onChange={e => setBasic(p => ({ ...p, background: e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Alineamiento">
                <input value={basic.alignment}
                  onChange={e => setBasic(p => ({ ...p, alignment: e.target.value }))}
                  className="ifield" />
              </F>
              <F label="Velocidad">
                <input type="number" value={basic.speed}
                  onChange={e => setBasic(p => ({ ...p, speed: +e.target.value }))}
                  className="ifield" />
              </F>
              <F label="XP">
                <input type="number" value={basic.experience_points}
                  onChange={e => setBasic(p => ({ ...p, experience_points: +e.target.value }))}
                  className="ifield" />
              </F>
            </div>
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
         COMBAT TAB — compact D&D stat block layout
         ════════════════════════════════════════════════════════ */}
      {tab === 'combat' && (
        <div className="space-y-4">
          {/* Section: Ability Scores */}
          <h3 className="font-semibold text-sm"
            style={{ color: 'var(--cs-text-muted)' }}>
            Puntuaciones de caracteristica
          </h3>
          <div className="parchment-page rounded-xl p-4">
            <div className="grid grid-cols-6 gap-2">
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => (
                <div key={ab} className="stat-box rounded text-center">
                  <div className="text-[0.65rem] font-bold uppercase tracking-wide mb-1"
                    style={{ color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>
                    {ABILITY_LABELS[ab]}
                  </div>
                  <input
                    type="number" value={combat[ab]} min={1} max={30}
                    onChange={e => setCombat(p => ({ ...p, [ab]: +e.target.value }))}
                    className="ifield text-center text-lg font-bold"
                    style={{ padding: '2px 4px', background: 'transparent', border: 'none' }}
                  />
                  <div className="text-xs font-semibold" style={{ color: 'var(--crimson)' }}>
                    {mod(combat[ab])}
                  </div>
                </div>
              ))}
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
                            ? 'var(--crimson)'
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
                          const isApplicable = s.type === 'proficiency' || s.type === 'advantage'
                          const skillKey = s.skill.charAt(0).toUpperCase() + s.skill.slice(1)
                          const alreadySet = localProfs.some(p => p.name.toLowerCase() === s.skill.toLowerCase() &&
                            (s.type === 'proficiency' ? p.proficiency_level !== 'none' : s.type === 'advantage' ? p.has_advantage : false))
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
                                    if (s.type === 'proficiency') {
                                      const existing = getSkillProf(s.skill.charAt(0).toUpperCase() + s.skill.slice(1))
                                        ?? getSkillProf(s.skill)
                                        ?? getSkillProf(skillKey)
                                      // Find the matching SKILLS key
                                      const match = SKILLS.find(sk => sk.key.toLowerCase() === s.skill.toLowerCase())
                                      const key = match?.key ?? skillKey
                                      if (!existing || existing.proficiency_level === 'none') {
                                        if (!existing) {
                                          setLocalProfs(prev => [...prev, {
                                            id: `new_${key}`,
                                            character_id: character.id,
                                            type: 'skill' as const,
                                            name: key,
                                            proficiency_level: 'proficient',
                                            has_advantage: false,
                                          }])
                                        } else {
                                          setLocalProfs(prev => prev.map(p => p.name === key ? { ...p, proficiency_level: 'proficient' as const } : p))
                                        }
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
                  {classes.map(c => (
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
            characterClasses={classes.map(c => c.class_name)}
            defaultClass={classes.find(c => c.id === newSpell.class_id)?.class_name ?? classes[0]?.class_name ?? ''}
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
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre">
                <Autocomplete
                  value={newWeapon.name}
                  onChange={handleWeaponAutocomplete}
                  options={weaponItems.map(w => w.name)}
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
            </div>
            <button onClick={addWeapon} className="btn-primary">+ Agregar</button>
          </div>

          <div className="space-y-2">
            {localWeapons.map(w => (
              <div key={w.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg parchment-page">
                <span className="flex-1 font-medium text-sm"
                  style={{ color: 'var(--cs-text)' }}>
                  {w.name}
                </span>
                {w.atk_bonus && (
                  <span className="text-sm" style={{ color: 'var(--cs-gold)' }}>
                    {w.atk_bonus}
                  </span>
                )}
                {w.damage && (
                  <span className="text-sm" style={{ color: 'var(--cs-text-muted)' }}>
                    {w.damage}
                  </span>
                )}
                {w.damage_type && (
                  <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                    {w.damage_type}
                  </span>
                )}
                {w.range && (
                  <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                    {w.range}
                  </span>
                )}
                <button onClick={() => deleteWeapon(w.id)}
                  style={{ color: 'var(--danger)' }}>
                  &#10005;
                </button>
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
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre">
                <Autocomplete
                  value={newEquip.name}
                  onChange={handleEquipAutocomplete}
                  options={equipmentItems.map(e => e.name)}
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
            <button onClick={addEquipment} className="btn-primary">+ Agregar</button>
          </div>

          <div className="space-y-2">
            {localEquipment.map(item => {
              const itemValue = parseItemValue(item.notes)
              const extraNotes = cleanNotes(item.notes)
              return (
                <div key={item.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg parchment-page">
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
                  {item.weight && (
                    <span className="text-xs"
                      style={{ color: 'var(--cs-text-muted)' }}>
                      {item.weight}
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
                        color: 'var(--parchment)',
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

          {/* Manual add form */}
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Add trait / feature
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name">
                <input value={newFeature.name}
                  onChange={e => setNewFeature(p => ({ ...p, name: e.target.value }))}
                  className="ifield" placeholder="Darkvision..." />
              </F>
              <F label="Source">
                <input value={newFeature.source}
                  onChange={e => setNewFeature(p => ({ ...p, source: e.target.value }))}
                  className="ifield" placeholder="race, class, homebrew..." />
              </F>
            </div>
            <F label="Description">
              <textarea value={newFeature.description}
                onChange={e => setNewFeature(p => ({ ...p, description: e.target.value }))}
                rows={3} className="ifield resize-none" />
            </F>
            <button onClick={addFeature} className="btn-primary">+ Add</button>
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
                                ? 'var(--crimson)'
                                : f.source.startsWith('Subclase:') || f.source.startsWith('Subclass:')
                                  ? 'var(--cover-light)'
                                  : 'var(--parchment-shadow)',
                            color: 'var(--parchment)',
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
              <div key={r.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg parchment-page">
                <span className="flex-1 font-medium text-sm"
                  style={{ color: 'var(--cs-text)' }}>
                  {r.name}
                </span>
                <span className="text-sm" style={{ color: 'var(--cs-text-muted)' }}>
                  {r.current}/{r.maximum}
                </span>
                <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                  {r.reset_on === 'short_rest'
                    ? 'desc. corto'
                    : r.reset_on === 'long_rest'
                      ? 'desc. largo'
                      : 'manual'}
                </span>
                <button onClick={() => deleteResource(r.id)}
                  style={{ color: 'var(--danger)' }}>
                  &#10005;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
         CUSTOM STATS TAB
         ════════════════════════════════════════════════════════ */}
      {tab === 'custom' && (
        <div className="space-y-4">
          <div className="parchment-page rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--cs-text-muted)' }}>
              Agregar stat personalizado / homebrew
            </h3>
            <p className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
              Usalo para cualquier cosa especial de tu campana, como el anillo de recuperacion de tu personaje.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre">
                <input value={newCustom.name}
                  onChange={e => setNewCustom(p => ({ ...p, name: e.target.value }))}
                  className="ifield" placeholder="Anillo de Recuperacion..." />
              </F>
              <F label="Tipo">
                <select value={newCustom.stat_type}
                  onChange={e => setNewCustom(p => ({
                    ...p, stat_type: e.target.value as CustomStatType,
                  }))}
                  className="ifield">
                  <option value="counter">Contador (actual/max)</option>
                  <option value="tracker">Tracker (sin max)</option>
                  <option value="checkbox">Checkbox (si/no)</option>
                  <option value="text">Texto libre</option>
                </select>
              </F>
              {(newCustom.stat_type === 'counter' || newCustom.stat_type === 'tracker') && (
                <>
                  <F label="Valor actual">
                    <input type="number" value={newCustom.current_value}
                      onChange={e => setNewCustom(p => ({ ...p, current_value: +e.target.value }))}
                      className="ifield" />
                  </F>
                  {newCustom.stat_type === 'counter' && (
                    <F label="Maximo">
                      <input type="number" value={newCustom.max_value}
                        onChange={e => setNewCustom(p => ({ ...p, max_value: +e.target.value }))}
                        className="ifield" />
                    </F>
                  )}
                </>
              )}
              {newCustom.stat_type === 'text' && (
                <F label="Valor">
                  <input value={newCustom.text_value}
                    onChange={e => setNewCustom(p => ({ ...p, text_value: e.target.value }))}
                    className="ifield" />
                </F>
              )}
              <F label="Notas">
                <input value={newCustom.notes}
                  onChange={e => setNewCustom(p => ({ ...p, notes: e.target.value }))}
                  className="ifield" placeholder="Descripcion opcional..." />
              </F>
            </div>
            <button onClick={addCustomStat} className="btn-primary">+ Agregar stat</button>
          </div>

          <div className="space-y-2">
            {localCustom.map(c => (
              <div key={c.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg parchment-page">
                <span className="flex-1 font-medium text-sm"
                  style={{ color: 'var(--cs-text)' }}>
                  {c.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(201,173,106,0.3)',
                    color: 'var(--cs-text-muted)',
                  }}>
                  {c.stat_type}
                </span>
                {(c.stat_type === 'counter' || c.stat_type === 'tracker') && (
                  <span className="text-sm" style={{ color: 'var(--cs-text-muted)' }}>
                    {c.current_value}{c.max_value ? `/${c.max_value}` : ''}
                  </span>
                )}
                {c.notes && (
                  <span className="text-xs" style={{ color: 'var(--cs-text-muted)' }}>
                    {c.notes}
                  </span>
                )}
                <button onClick={() => deleteCustomStat(c.id)}
                  style={{ color: 'var(--danger)' }}>
                  &#10005;
                </button>
              </div>
            ))}
          </div>
        </div>
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
