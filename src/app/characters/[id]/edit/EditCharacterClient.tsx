'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  Character, CharacterClass, SpellSlot, CharacterSpell,
  CharacterWeapon, CharacterEquipment, CharacterFeature,
  CharacterProficiency, ClassResource, CustomStat, CustomStatType, ResetOn
} from '@/modules/characters/types'

type Tab = 'basic' | 'combat' | 'spells' | 'weapons' | 'equipment' | 'features' | 'resources' | 'custom'

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

  // Basic state
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

  const [combat, setCombat] = useState({
    str: character.str, dex: character.dex, con: character.con,
    int: character.int, wis: character.wis, cha: character.cha,
    hp_max: character.hp_max, hp_current: character.hp_current, hp_temp: character.hp_temp,
    ac: character.ac, initiative_bonus: character.initiative_bonus,
    proficiency_bonus: character.proficiency_bonus,
    hit_dice_total: character.hit_dice_total ?? '',
    pp: character.pp, gp: character.gp, sp: character.sp, cp: character.cp,
  })

  // Spells
  const [localSpells, setLocalSpells] = useState(spells)
  const [newSpell, setNewSpell] = useState({
    class_id: classes[0]?.id ?? '',
    spell_level: 0,
    name: '',
    custom_notes: '',
    range: '',
    damage: '',
    is_prepared: true,
  })

  // Weapons
  const [localWeapons, setLocalWeapons] = useState(weapons)
  const [newWeapon, setNewWeapon] = useState({ name: '', atk_bonus: '', damage: '', damage_type: '', range: '', notes: '' })

  // Equipment
  const [localEquipment, setLocalEquipment] = useState(equipment)
  const [newEquip, setNewEquip] = useState({ name: '', quantity: 1, weight: '', notes: '' })

  // Features
  const [localFeatures, setLocalFeatures] = useState(features)
  const [newFeature, setNewFeature] = useState({ name: '', description: '', source: '' })

  // Class Resources
  const [localResources, setLocalResources] = useState(classResources)
  const [newResource, setNewResource] = useState({ name: '', current: 0, maximum: 0, reset_on: 'long_rest' as ResetOn })

  // Custom Stats
  const [localCustom, setLocalCustom] = useState(customStats)
  const [newCustom, setNewCustom] = useState({
    name: '', current_value: 0, max_value: 0,
    text_value: '', stat_type: 'counter' as CustomStatType, notes: ''
  })

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

  function showSaved() {
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Spells
  async function addSpell() {
    if (!newSpell.name.trim() || !newSpell.class_id) return
    const { data } = await supabase.from('character_spells').insert({
      character_id: character.id,
      ...newSpell,
      sort_order: localSpells.length,
    }).select().single()
    if (data) setLocalSpells(prev => [...prev, data])
    setNewSpell(p => ({ ...p, name: '', custom_notes: '', range: '', damage: '' }))
  }

  async function deleteSpell(id: string) {
    await supabase.from('character_spells').delete().eq('id', id)
    setLocalSpells(prev => prev.filter(s => s.id !== id))
  }

  // Weapons
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

  // Equipment
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

  // Features
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

  // Resources
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

  // Custom Stats
  async function addCustomStat() {
    if (!newCustom.name.trim()) return
    const { data } = await supabase.from('character_custom_stats').insert({
      character_id: character.id, ...newCustom, sort_order: localCustom.length,
    }).select().single()
    if (data) setLocalCustom(prev => [...prev, data])
    setNewCustom({ name: '', current_value: 0, max_value: 0, text_value: '', stat_type: 'counter', notes: '' })
  }

  async function deleteCustomStat(id: string) {
    await supabase.from('character_custom_stats').delete().eq('id', id)
    setLocalCustom(prev => prev.filter(c => c.id !== id))
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic', label: 'Básico' },
    { key: 'combat', label: 'Combate' },
    { key: 'spells', label: 'Hechizos' },
    { key: 'weapons', label: 'Armas' },
    { key: 'equipment', label: 'Equipo' },
    { key: 'features', label: 'Rasgos' },
    { key: 'resources', label: 'Recursos' },
    { key: 'custom', label: 'Custom' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            style={{
              background: tab === t.key ? 'var(--accent)' : 'var(--bg-card)',
              color: tab === t.key ? 'white' : 'var(--text-muted)',
            }}>
            {t.label}
          </button>
        ))}
        {(saved || saving) && (
          <span className="ml-auto self-center text-sm" style={{ color: 'var(--success)' }}>
            {saving ? 'Guardando...' : '✓ Guardado'}
          </span>
        )}
      </div>

      {/* Basic Tab */}
      {tab === 'basic' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="Nombre"><input value={basic.name} onChange={e => setBasic(p => ({...p, name: e.target.value}))} className="ifield" /></F>
            <F label="Raza"><input value={basic.race} onChange={e => setBasic(p => ({...p, race: e.target.value}))} className="ifield" /></F>
            <F label="Subraza"><input value={basic.subrace} onChange={e => setBasic(p => ({...p, subrace: e.target.value}))} className="ifield" /></F>
            <F label="Trasfondo"><input value={basic.background} onChange={e => setBasic(p => ({...p, background: e.target.value}))} className="ifield" /></F>
            <F label="Alineamiento"><input value={basic.alignment} onChange={e => setBasic(p => ({...p, alignment: e.target.value}))} className="ifield" /></F>
            <F label="Velocidad"><input type="number" value={basic.speed} onChange={e => setBasic(p => ({...p, speed: +e.target.value}))} className="ifield" /></F>
            <F label="XP"><input type="number" value={basic.experience_points} onChange={e => setBasic(p => ({...p, experience_points: +e.target.value}))} className="ifield" /></F>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(['age','height','weight','eyes','skin','hair'] as const).map(k => (
              <F key={k} label={k}><input value={basic[k]} onChange={e => setBasic(p => ({...p, [k]: e.target.value}))} className="ifield" /></F>
            ))}
          </div>
          {(['personality','ideals','bonds','flaws','backstory'] as const).map(k => (
            <F key={k} label={k}>
              <textarea value={basic[k]} onChange={e => setBasic(p => ({...p, [k]: e.target.value}))}
                rows={3} className="ifield resize-none" />
            </F>
          ))}
          <SaveBtn onClick={saveBasic} saving={saving} />
        </div>
      )}

      {/* Combat Tab */}
      {tab === 'combat' && (
        <div className="space-y-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-muted)' }}>Puntuaciones de característica</h3>
          <div className="grid grid-cols-3 gap-3">
            {(['str','dex','con','int','wis','cha'] as const).map(ab => (
              <F key={ab} label={ab.toUpperCase()}>
                <input type="number" value={combat[ab]} min={1} max={30}
                  onChange={e => setCombat(p => ({...p, [ab]: +e.target.value}))}
                  className="ifield text-center" />
              </F>
            ))}
          </div>
          <h3 className="font-semibold" style={{ color: 'var(--text-muted)' }}>Combate</h3>
          <div className="grid grid-cols-3 gap-3">
            <F label="HP máx"><input type="number" value={combat.hp_max} onChange={e => setCombat(p => ({...p, hp_max: +e.target.value}))} className="ifield" /></F>
            <F label="HP actual"><input type="number" value={combat.hp_current} onChange={e => setCombat(p => ({...p, hp_current: +e.target.value}))} className="ifield" /></F>
            <F label="HP temporal"><input type="number" value={combat.hp_temp} onChange={e => setCombat(p => ({...p, hp_temp: +e.target.value}))} className="ifield" /></F>
            <F label="CA"><input type="number" value={combat.ac} onChange={e => setCombat(p => ({...p, ac: +e.target.value}))} className="ifield" /></F>
            <F label="Bonus Prof."><input type="number" value={combat.proficiency_bonus} onChange={e => setCombat(p => ({...p, proficiency_bonus: +e.target.value}))} className="ifield" /></F>
            <F label="Bonus Iniciativa"><input type="number" value={combat.initiative_bonus} onChange={e => setCombat(p => ({...p, initiative_bonus: +e.target.value}))} className="ifield" /></F>
            <F label="Dados de golpe"><input value={combat.hit_dice_total} onChange={e => setCombat(p => ({...p, hit_dice_total: e.target.value}))} placeholder="5d6+1d8" className="ifield" /></F>
          </div>
          <h3 className="font-semibold" style={{ color: 'var(--text-muted)' }}>Monedas</h3>
          <div className="grid grid-cols-4 gap-3">
            {(['pp','gp','sp','cp'] as const).map(c => (
              <F key={c} label={c.toUpperCase()}><input type="number" value={combat[c]} onChange={e => setCombat(p => ({...p, [c]: +e.target.value}))} className="ifield" /></F>
            ))}
          </div>
          <SaveBtn onClick={saveCombat} saving={saving} />
        </div>
      )}

      {/* Spells Tab */}
      {tab === 'spells' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>Agregar hechizo</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Clase">
                <select value={newSpell.class_id} onChange={e => setNewSpell(p => ({...p, class_id: e.target.value}))} className="ifield">
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </F>
              <F label="Nivel">
                <select value={newSpell.spell_level} onChange={e => setNewSpell(p => ({...p, spell_level: +e.target.value}))} className="ifield">
                  <option value={0}>Truco (0)</option>
                  {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Nivel {n}</option>)}
                </select>
              </F>
              <F label="Nombre del hechizo">
                <input value={newSpell.name} onChange={e => setNewSpell(p => ({...p, name: e.target.value}))} className="ifield" placeholder="Fireball..." />
              </F>
              <F label="Notas personalizadas">
                <input value={newSpell.custom_notes} onChange={e => setNewSpell(p => ({...p, custom_notes: e.target.value}))} className="ifield" placeholder="8d6, DC 15..." />
              </F>
              <F label="Alcance">
                <input value={newSpell.range} onChange={e => setNewSpell(p => ({...p, range: e.target.value}))} className="ifield" placeholder="40m, Toque..." />
              </F>
              <F label="Daño">
                <input value={newSpell.damage} onChange={e => setNewSpell(p => ({...p, damage: e.target.value}))} className="ifield" placeholder="1d10..." />
              </F>
            </div>
            <button onClick={addSpell} className="btn-primary">+ Agregar hechizo</button>
          </div>

          {/* Spells list grouped by level */}
          {[0,1,2,3,4,5,6,7,8,9].map(lvl => {
            const lvlSpells = localSpells.filter(s => s.spell_level === lvl)
            if (!lvlSpells.length) return null
            return (
              <div key={lvl}>
                <h4 className="text-xs font-bold uppercase tracking-wide mb-2"
                  style={{ color: 'var(--text-muted)' }}>
                  {lvl === 0 ? 'Trucos' : `Nivel ${lvl}`}
                </h4>
                <div className="space-y-2">
                  {lvlSpells.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                      {s.custom_notes && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.custom_notes}</span>}
                      {s.range && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.range}</span>}
                      <button onClick={() => deleteSpell(s.id)} className="text-xs" style={{ color: 'var(--danger)' }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Weapons Tab */}
      {tab === 'weapons' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>Agregar ataque</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre"><input value={newWeapon.name} onChange={e => setNewWeapon(p => ({...p, name: e.target.value}))} className="ifield" placeholder="Ballesta Ligera..." /></F>
              <F label="Bonus Ataque"><input value={newWeapon.atk_bonus} onChange={e => setNewWeapon(p => ({...p, atk_bonus: e.target.value}))} className="ifield" placeholder="+4" /></F>
              <F label="Daño"><input value={newWeapon.damage} onChange={e => setNewWeapon(p => ({...p, damage: e.target.value}))} className="ifield" placeholder="1d8+1" /></F>
              <F label="Tipo de daño"><input value={newWeapon.damage_type} onChange={e => setNewWeapon(p => ({...p, damage_type: e.target.value}))} className="ifield" placeholder="Perforante..." /></F>
              <F label="Alcance"><input value={newWeapon.range} onChange={e => setNewWeapon(p => ({...p, range: e.target.value}))} className="ifield" placeholder="80/320ft" /></F>
              <F label="Notas"><input value={newWeapon.notes} onChange={e => setNewWeapon(p => ({...p, notes: e.target.value}))} className="ifield" /></F>
            </div>
            <button onClick={addWeapon} className="btn-primary">+ Agregar</button>
          </div>
          <div className="space-y-2">
            {localWeapons.map(w => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="flex-1 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                <span className="text-sm" style={{ color: 'var(--accent-gold)' }}>{w.atk_bonus}</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{w.damage}</span>
                {w.range && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.range}</span>}
                <button onClick={() => deleteWeapon(w.id)} style={{ color: 'var(--danger)' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment Tab */}
      {tab === 'equipment' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>Agregar item</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre"><input value={newEquip.name} onChange={e => setNewEquip(p => ({...p, name: e.target.value}))} className="ifield" /></F>
              <F label="Cantidad"><input type="number" value={newEquip.quantity} min={1} onChange={e => setNewEquip(p => ({...p, quantity: +e.target.value}))} className="ifield" /></F>
              <F label="Peso"><input value={newEquip.weight} onChange={e => setNewEquip(p => ({...p, weight: e.target.value}))} className="ifield" placeholder="1 lb" /></F>
              <F label="Notas"><input value={newEquip.notes} onChange={e => setNewEquip(p => ({...p, notes: e.target.value}))} className="ifield" /></F>
            </div>
            <button onClick={addEquipment} className="btn-primary">+ Agregar</button>
          </div>
          <div className="space-y-2">
            {localEquipment.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>x{e.quantity}</span>
                <span className="flex-1 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{e.name}</span>
                {e.notes && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.notes}</span>}
                <button onClick={() => deleteEquipment(e.id)} style={{ color: 'var(--danger)' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Tab */}
      {tab === 'features' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>Agregar rasgo/habilidad</h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre"><input value={newFeature.name} onChange={e => setNewFeature(p => ({...p, name: e.target.value}))} className="ifield" placeholder="Vision Oscura..." /></F>
              <F label="Fuente"><input value={newFeature.source} onChange={e => setNewFeature(p => ({...p, source: e.target.value}))} className="ifield" placeholder="raza, clase, homebrew..." /></F>
            </div>
            <F label="Descripción">
              <textarea value={newFeature.description} onChange={e => setNewFeature(p => ({...p, description: e.target.value}))}
                rows={3} className="ifield resize-none" />
            </F>
            <button onClick={addFeature} className="btn-primary">+ Agregar</button>
          </div>
          <div className="space-y-3">
            {localFeatures.map(f => (
              <div key={f.id} className="px-4 py-3 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-sm" style={{ color: 'var(--accent-gold)' }}>{f.name}</span>
                    {f.source && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>({f.source})</span>}
                  </div>
                  <button onClick={() => deleteFeature(f.id)} style={{ color: 'var(--danger)' }}>✕</button>
                </div>
                {f.description && <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{f.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {tab === 'resources' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>
              Agregar recurso de clase (Sorcery Points, Ki, Superiority Dice, etc.)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre"><input value={newResource.name} onChange={e => setNewResource(p => ({...p, name: e.target.value}))} className="ifield" placeholder="Sorcery Points..." /></F>
              <F label="Máximo"><input type="number" value={newResource.maximum} min={0} onChange={e => setNewResource(p => ({...p, maximum: +e.target.value, current: +e.target.value}))} className="ifield" /></F>
              <F label="Actual"><input type="number" value={newResource.current} min={0} onChange={e => setNewResource(p => ({...p, current: +e.target.value}))} className="ifield" /></F>
              <F label="Recupera en">
                <select value={newResource.reset_on} onChange={e => setNewResource(p => ({...p, reset_on: e.target.value as ResetOn}))} className="ifield">
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
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="flex-1 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{r.current}/{r.maximum}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {r.reset_on === 'short_rest' ? 'desc. corto' : r.reset_on === 'long_rest' ? 'desc. largo' : 'manual'}
                </span>
                <button onClick={() => deleteResource(r.id)} style={{ color: 'var(--danger)' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Stats Tab */}
      {tab === 'custom' && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 space-y-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>
              Agregar stat personalizado / homebrew
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Úsalo para cualquier cosa especial de tu campaña, como el anillo de recuperación de tu personaje.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre"><input value={newCustom.name} onChange={e => setNewCustom(p => ({...p, name: e.target.value}))} className="ifield" placeholder="Anillo de Recuperación..." /></F>
              <F label="Tipo">
                <select value={newCustom.stat_type} onChange={e => setNewCustom(p => ({...p, stat_type: e.target.value as CustomStatType}))} className="ifield">
                  <option value="counter">Contador (actual/máx)</option>
                  <option value="tracker">Tracker (sin máx)</option>
                  <option value="checkbox">Checkbox (sí/no)</option>
                  <option value="text">Texto libre</option>
                </select>
              </F>
              {(newCustom.stat_type === 'counter' || newCustom.stat_type === 'tracker') && (
                <>
                  <F label="Valor actual"><input type="number" value={newCustom.current_value} onChange={e => setNewCustom(p => ({...p, current_value: +e.target.value}))} className="ifield" /></F>
                  {newCustom.stat_type === 'counter' && (
                    <F label="Máximo"><input type="number" value={newCustom.max_value} onChange={e => setNewCustom(p => ({...p, max_value: +e.target.value}))} className="ifield" /></F>
                  )}
                </>
              )}
              {newCustom.stat_type === 'text' && (
                <F label="Valor"><input value={newCustom.text_value} onChange={e => setNewCustom(p => ({...p, text_value: e.target.value}))} className="ifield" /></F>
              )}
              <F label="Notas (col 2)"><input value={newCustom.notes} onChange={e => setNewCustom(p => ({...p, notes: e.target.value}))} className="ifield" placeholder="Descripción opcional..." /></F>
            </div>
            <button onClick={addCustomStat} className="btn-primary">+ Agregar stat</button>
          </div>
          <div className="space-y-2">
            {localCustom.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="flex-1 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  {c.stat_type}
                </span>
                {(c.stat_type === 'counter' || c.stat_type === 'tracker') && (
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {c.current_value}{c.max_value ? `/${c.max_value}` : ''}
                  </span>
                )}
                {c.notes && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.notes}</span>}
                <button onClick={() => deleteCustomStat(c.id)} style={{ color: 'var(--danger)' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .ifield {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          outline: none;
          font-size: 14px;
        }
        .ifield:focus { border-color: var(--accent); }
        .btn-primary {
          padding: 8px 16px;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          font-size: 14px;
          font-weight: 600;
          transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 capitalize"
        style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="mt-2 px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60"
      style={{ background: 'var(--accent)', color: 'white' }}>
      {saving ? 'Guardando...' : 'Guardar cambios'}
    </button>
  )
}
