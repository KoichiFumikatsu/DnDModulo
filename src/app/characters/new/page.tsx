'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ALIGNMENTS = [
  'Legal Bueno', 'Neutral Bueno', 'Caótico Bueno',
  'Legal Neutral', 'Neutral', 'Caótico Neutral',
  'Legal Malvado', 'Neutral Malvado', 'Caótico Malvado',
]

const D5E_CLASSES = [
  'Bárbaro', 'Bardo', 'Clérigo', 'Druida', 'Guerrero', 'Hechicero',
  'Mago', 'Monje', 'Paladín', 'Pícaro', 'Explorador', 'Brujo',
  'Artificiero', 'Sangre de Dracónido',
]

const SPELLCASTING_ABILITIES: Record<string, string> = {
  'Bardo': 'cha', 'Clérigo': 'wis', 'Druida': 'wis', 'Hechicero': 'cha',
  'Mago': 'int', 'Paladín': 'cha', 'Explorador': 'wis', 'Brujo': 'cha',
  'Artificiero': 'int',
}

interface ClassEntry {
  class_name: string
  level: number
  subclass_name: string
  is_primary: boolean
}

export default function NewCharacterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Basic info
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [background, setBackground] = useState('')
  const [alignment, setAlignment] = useState('')
  const [xp, setXp] = useState(0)
  const [speed, setSpeed] = useState(30)

  // Classes
  const [classes, setClasses] = useState<ClassEntry[]>([
    { class_name: '', level: 1, subclass_name: '', is_primary: true }
  ])

  // Ability scores
  const [abilities, setAbilities] = useState({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })

  // HP & Combat
  const [hpMax, setHpMax] = useState(8)
  const [ac, setAc] = useState(10)
  const [profBonus, setProfBonus] = useState(2)

  // Roleplay
  const [personality, setPersonality] = useState('')
  const [ideals, setIdeals] = useState('')
  const [bonds, setBonds] = useState('')
  const [flaws, setFlaws] = useState('')

  function mod(score: number) {
    const m = Math.floor((score - 10) / 2)
    return m >= 0 ? `+${m}` : `${m}`
  }

  function addClassEntry() {
    setClasses(prev => [...prev, { class_name: '', level: 1, subclass_name: '', is_primary: false }])
  }

  function removeClassEntry(i: number) {
    setClasses(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateClass(i: number, field: keyof ClassEntry, value: string | number | boolean) {
    setClasses(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    if (classes.every(c => !c.class_name)) { setError('Al menos una clase es requerida'); return }

    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Create character
    const { data: character, error: charErr } = await supabase
      .from('characters')
      .insert({
        user_id: user.id,
        name,
        race,
        background,
        alignment,
        experience_points: xp,
        speed,
        ...abilities,
        hp_max: hpMax,
        hp_current: hpMax,
        ac,
        proficiency_bonus: profBonus,
        personality,
        ideals,
        bonds,
        flaws,
      })
      .select()
      .single()

    if (charErr || !character) {
      setError(charErr?.message ?? 'Error al crear personaje')
      setLoading(false)
      return
    }

    // Create classes
    const validClasses = classes.filter(c => c.class_name)
    for (const cls of validClasses) {
      const spellcastingAbility = SPELLCASTING_ABILITIES[cls.class_name] ?? null
      const { data: classData } = await supabase
        .from('character_classes')
        .insert({
          character_id: character.id,
          class_name: cls.class_name,
          subclass_name: cls.subclass_name || null,
          level: cls.level,
          is_primary: cls.is_primary,
          spellcasting_ability: spellcastingAbility,
          spell_save_dc: spellcastingAbility
            ? 8 + profBonus + Math.floor((abilities[spellcastingAbility as keyof typeof abilities] - 10) / 2)
            : null,
          spell_attack_mod: spellcastingAbility
            ? profBonus + Math.floor((abilities[spellcastingAbility as keyof typeof abilities] - 10) / 2)
            : null,
        })
        .select()
        .single()

      // Auto-create spell slots for spellcasting classes
      if (classData && spellcastingAbility) {
        const slots = getSpellSlots(cls.class_name, cls.level)
        for (const [lvl, total] of Object.entries(slots)) {
          if (total > 0) {
            await supabase.from('character_spell_slots').insert({
              character_id: character.id,
              class_id: classData.id,
              spell_level: parseInt(lvl),
              slots_total: total,
              slots_used: 0,
            })
          }
        }
      }
    }

    router.push(`/characters/${character.id}/edit`)
  }

  const totalLevel = classes.reduce((sum, c) => sum + (c.level || 0), 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="border-b px-6 py-4 flex items-center gap-4"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <Link href="/dashboard" className="text-sm opacity-60 hover:opacity-100"
          style={{ color: 'var(--text-primary)' }}>← Dashboard</Link>
        <h1 className="text-xl font-bold" style={{ color: 'var(--accent-gold)' }}>
          Nuevo Personaje
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 px-6 py-4 border-b max-w-3xl mx-auto w-full"
        style={{ borderColor: 'var(--border)' }}>
        {['Básico', 'Clases', 'Stats', 'Personalidad'].map((label, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className="flex-1 py-2 rounded text-sm font-medium transition-colors"
            style={{
              background: step === i + 1 ? 'var(--accent)' : 'var(--bg-card)',
              color: step === i + 1 ? 'white' : 'var(--text-muted)',
            }}>
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{ background: '#3d1515', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Información básica
            </h2>
            <Field label="Nombre del personaje *">
              <input value={name} onChange={e => setName(e.target.value)}
                className="input-field" placeholder="Y'Sera..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Raza">
                <input value={race} onChange={e => setRace(e.target.value)}
                  className="input-field" placeholder="Elfo, Humano..." />
              </Field>
              <Field label="Trasfondo">
                <input value={background} onChange={e => setBackground(e.target.value)}
                  className="input-field" placeholder="Far Traveler..." />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Alineamiento">
                <select value={alignment} onChange={e => setAlignment(e.target.value)}
                  className="input-field">
                  <option value="">— Seleccionar —</option>
                  {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Velocidad (ft)">
                <input type="number" value={speed} onChange={e => setSpeed(parseInt(e.target.value) || 30)}
                  className="input-field" />
              </Field>
            </div>
            <Field label="Experiencia (XP)">
              <input type="number" value={xp} onChange={e => setXp(parseInt(e.target.value) || 0)}
                className="input-field" min={0} />
            </Field>
          </div>
        )}

        {/* Step 2: Classes */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Clases {totalLevel > 0 && <span style={{ color: 'var(--text-muted)' }}>— Nivel total: {totalLevel}</span>}
            </h2>
            {classes.map((cls, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-4"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                    Clase {i + 1} {cls.is_primary && '(principal)'}
                  </span>
                  {classes.length > 1 && (
                    <button onClick={() => removeClassEntry(i)}
                      className="text-xs" style={{ color: 'var(--danger)' }}>
                      Eliminar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Clase">
                    <select value={cls.class_name} onChange={e => updateClass(i, 'class_name', e.target.value)}
                      className="input-field">
                      <option value="">— Seleccionar —</option>
                      {D5E_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="Custom">Personalizada</option>
                    </select>
                  </Field>
                  <Field label="Nivel">
                    <input type="number" value={cls.level} min={1} max={20}
                      onChange={e => updateClass(i, 'level', parseInt(e.target.value) || 1)}
                      className="input-field" />
                  </Field>
                </div>
                <Field label="Subclase (opcional)">
                  <input value={cls.subclass_name}
                    onChange={e => updateClass(i, 'subclass_name', e.target.value)}
                    className="input-field" placeholder="Wild Magic, Life Domain..." />
                </Field>
              </div>
            ))}
            <button onClick={addClassEntry}
              className="w-full py-2.5 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              + Agregar multiclase
            </button>
          </div>
        )}

        {/* Step 3: Stats */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Estadísticas
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(abilities) as (keyof typeof abilities)[]).map(ab => (
                <div key={ab} className="rounded-lg border p-3 text-center"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-2"
                    style={{ color: 'var(--text-muted)' }}>
                    {ab.toUpperCase()}
                  </label>
                  <input type="number" value={abilities[ab]} min={1} max={30}
                    onChange={e => setAbilities(prev => ({
                      ...prev, [ab]: parseInt(e.target.value) || 10
                    }))}
                    className="w-full text-center py-1 rounded border text-lg font-bold outline-none"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }} />
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--accent-gold)' }}>
                    {mod(abilities[ab])}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="HP máximo">
                <input type="number" value={hpMax} min={1}
                  onChange={e => setHpMax(parseInt(e.target.value) || 1)}
                  className="input-field" />
              </Field>
              <Field label="Clase de Armadura">
                <input type="number" value={ac} min={1}
                  onChange={e => setAc(parseInt(e.target.value) || 10)}
                  className="input-field" />
              </Field>
              <Field label="Bonus de Proficiencia">
                <input type="number" value={profBonus} min={2} max={6}
                  onChange={e => setProfBonus(parseInt(e.target.value) || 2)}
                  className="input-field" />
              </Field>
            </div>
          </div>
        )}

        {/* Step 4: Personality */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Personalidad
            </h2>
            <Field label="Rasgos de personalidad">
              <textarea value={personality} onChange={e => setPersonality(e.target.value)}
                rows={3} className="input-field resize-none"
                placeholder="¿Cómo se comporta tu personaje?" />
            </Field>
            <Field label="Ideales">
              <textarea value={ideals} onChange={e => setIdeals(e.target.value)}
                rows={2} className="input-field resize-none"
                placeholder="¿Qué cree o valora?" />
            </Field>
            <Field label="Vínculos">
              <textarea value={bonds} onChange={e => setBonds(e.target.value)}
                rows={2} className="input-field resize-none"
                placeholder="¿Con qué o quién está conectado?" />
            </Field>
            <Field label="Defectos">
              <textarea value={flaws} onChange={e => setFlaws(e.target.value)}
                rows={2} className="input-field resize-none"
                placeholder="¿Cuáles son sus debilidades?" />
            </Field>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-5 py-2.5 rounded-lg font-medium text-sm border transition-opacity disabled:opacity-30"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            Anterior
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(s => Math.min(4, s + 1))}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm"
              style={{ background: 'var(--accent)', color: 'white' }}>
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'white' }}>
              {loading ? 'Creando...' : 'Crear personaje →'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-secondary);
          color: var(--text-primary);
          outline: none;
          font-size: 14px;
        }
        .input-field:focus {
          border-color: var(--accent);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// Sorcerer/Wizard/Cleric spell slot table (simplified 5e PHB)
function getSpellSlots(className: string, level: number): Record<number, number> {
  const fullCaster: Record<number, number[]> = {
    1: [2,0,0,0,0,0,0,0,0],
    2: [3,0,0,0,0,0,0,0,0],
    3: [4,2,0,0,0,0,0,0,0],
    4: [4,3,0,0,0,0,0,0,0],
    5: [4,3,2,0,0,0,0,0,0],
    6: [4,3,3,0,0,0,0,0,0],
    7: [4,3,3,1,0,0,0,0,0],
    8: [4,3,3,2,0,0,0,0,0],
    9: [4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],
    11:[4,3,3,3,2,1,0,0,0],
    12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],
    14:[4,3,3,3,2,1,1,0,0],
    15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],
    17:[4,3,3,3,2,1,1,1,1],
    18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],
    20:[4,3,3,3,3,2,2,1,1],
  }
  const fullCasters = ['Bardo','Clérigo','Druida','Hechicero','Mago']
  if (!fullCasters.includes(className)) return {}
  const slots = fullCaster[Math.min(20, Math.max(1, level))] ?? []
  const result: Record<number, number> = {}
  slots.forEach((count, i) => { result[i + 1] = count })
  return result
}
