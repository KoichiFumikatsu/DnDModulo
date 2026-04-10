'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchRaces, fetchBackgrounds } from '@/lib/5etools/data'
import Autocomplete from '@/components/ui/Autocomplete'

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

interface ClassEntry { class_name: string; level: number; subclass_name: string; is_primary: boolean }

// Label con texto claro para fondo oscuro
function L({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: '0.82rem', marginBottom: '0.35rem',
      fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em',
      color: 'var(--on-dark)',
    }}>
      {children}
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><L>{label}</L>{children}</div>
}

export default function NewCharacterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 5etools data
  const [races, setRaces] = useState<string[]>([])
  const [backgrounds, setBackgrounds] = useState<string[]>([])
  useEffect(() => {
    fetchRaces().then(setRaces)
    fetchBackgrounds().then(setBackgrounds)
  }, [])

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

    const { data: character, error: charErr } = await supabase
      .from('characters')
      .insert({
        user_id: user.id, name, race, background, alignment,
        experience_points: xp, speed, ...abilities,
        hp_max: hpMax, hp_current: hpMax, ac, proficiency_bonus: profBonus,
        personality, ideals, bonds, flaws,
      })
      .select().single()

    if (charErr || !character) {
      setError(charErr?.message ?? 'Error al crear personaje')
      setLoading(false)
      return
    }

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
        .select().single()

      if (classData && spellcastingAbility) {
        const slots = getSpellSlots(cls.class_name, cls.level)
        for (const [lvl, total] of Object.entries(slots)) {
          if (total > 0) {
            await supabase.from('character_spell_slots').insert({
              character_id: character.id, class_id: classData.id,
              spell_level: parseInt(lvl), slots_total: total, slots_used: 0,
            })
          }
        }
      }
    }

    router.push(`/characters/${character.id}/edit`)
  }

  const totalLevel = classes.reduce((sum, c) => sum + (c.level || 0), 0)

  // Estilos base para inputs sobre fondo oscuro
  const darkInput: React.CSSProperties = {
    width: '100%', padding: '0.45rem 0.75rem',
    background: 'rgba(245,233,204,0.12)', border: '1px solid var(--gold-dark)',
    color: 'var(--on-dark)', fontFamily: 'var(--font-crimson, serif)', fontSize: '1rem',
    outline: 'none', borderRadius: '2px',
  }

  const darkSelect: React.CSSProperties = {
    ...darkInput, cursor: 'pointer',
    appearance: 'auto' as const,
  }

  const STEPS = ['Básico', 'Clases', 'Stats', 'Personalidad']

  return (
    <div className="min-h-screen" style={{ background: 'var(--cover)' }}>
      {/* Header */}
      <div className="book-nav px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard"
          style={{ color: 'var(--on-dark-muted)', fontSize: '0.82rem', textDecoration: 'none', fontFamily: 'var(--font-cinzel, serif)' }}>
          ← Grimorio
        </Link>
        <h1 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold)', fontSize: '1.1rem' }}>
          Nuevo Personaje
        </h1>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '1rem 1.5rem 0', maxWidth: 760, margin: '0 auto' }}>
        {STEPS.map((label, i) => (
          <button key={i} onClick={() => setStep(i + 1)}
            className={`tab-bookmark ${step === i + 1 ? 'active' : ''}`}
            style={{ flex: 1 }}>
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem' }}>
        {error && (
          <div style={{ background: '#3d0a0a', color: '#f5c0c0', padding: '0.6rem 1rem', marginBottom: '1rem', border: '1px solid #8b1a1a', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {/* ── Paso 1: Básico ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold)', fontSize: '1.1rem' }}>
              Información Básica
            </h2>

            <Field label="Nombre del personaje *">
              <input value={name} onChange={e => setName(e.target.value)}
                style={darkInput} placeholder="Y'Sera..." />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Autocomplete
                label="Raza"
                value={race}
                onChange={setRace}
                options={races}
                placeholder="Elf, Human, Tiefling..."
              />
              <Autocomplete
                label="Trasfondo"
                value={background}
                onChange={setBackground}
                options={backgrounds}
                placeholder="Far Traveler, Sage..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Field label="Alineamiento">
                <select value={alignment} onChange={e => setAlignment(e.target.value)} style={darkSelect}>
                  <option value="">— Seleccionar —</option>
                  {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Velocidad (ft)">
                <input type="number" value={speed} onChange={e => setSpeed(parseInt(e.target.value) || 30)} style={darkInput} />
              </Field>
            </div>

            <Field label="Experiencia (XP)">
              <input type="number" value={xp} onChange={e => setXp(parseInt(e.target.value) || 0)} style={darkInput} min={0} />
            </Field>
          </div>
        )}

        {/* ── Paso 2: Clases ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold)', fontSize: '1.1rem' }}>
              Clases {totalLevel > 0 && <span style={{ color: 'var(--on-dark-muted)', fontSize: '0.9rem' }}>— Nivel total: {totalLevel}</span>}
            </h2>

            {classes.map((cls, i) => (
              <div key={i} style={{ border: '1px solid var(--gold-dark)', padding: '1rem', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--on-dark-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-cinzel, serif)' }}>
                    Clase {i + 1} {cls.is_primary && '(principal)'}
                  </span>
                  {classes.length > 1 && (
                    <button onClick={() => removeClassEntry(i)} style={{ color: '#f87171', fontSize: '0.82rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Field label="Clase">
                    <select value={cls.class_name} onChange={e => updateClass(i, 'class_name', e.target.value)} style={darkSelect}>
                      <option value="">— Seleccionar —</option>
                      {D5E_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="Custom">Personalizada</option>
                    </select>
                  </Field>
                  <Field label="Nivel">
                    <input type="number" value={cls.level} min={1} max={20}
                      onChange={e => updateClass(i, 'level', parseInt(e.target.value) || 1)} style={darkInput} />
                  </Field>
                </div>
                <Field label="Subclase (opcional)">
                  <input value={cls.subclass_name}
                    onChange={e => updateClass(i, 'subclass_name', e.target.value)}
                    style={darkInput} placeholder="Wild Magic, Life Domain..." />
                </Field>
              </div>
            ))}

            <button onClick={addClassEntry} style={{
              padding: '0.6rem', border: '1px dashed var(--gold-dark)',
              color: 'var(--on-dark-muted)', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.82rem', letterSpacing: '0.05em',
            }}>
              + Agregar multiclase
            </button>
          </div>
        )}

        {/* ── Paso 3: Stats ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold)', fontSize: '1.1rem' }}>
              Estadísticas
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {(Object.keys(abilities) as (keyof typeof abilities)[]).map(ab => (
                <div key={ab} style={{ border: '1px solid var(--gold-dark)', padding: '0.75rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.75rem', color: 'var(--on-dark-muted)', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
                    {ab.toUpperCase()}
                  </div>
                  <input type="number" value={abilities[ab]} min={1} max={30}
                    onChange={e => setAbilities(prev => ({ ...prev, [ab]: parseInt(e.target.value) || 10 }))}
                    style={{ ...darkInput, textAlign: 'center', fontSize: '1.3rem', fontWeight: 700, padding: '0.3rem' }} />
                  <div style={{ color: 'var(--gold-light)', fontWeight: 700, marginTop: '0.3rem', fontSize: '0.9rem' }}>
                    {mod(abilities[ab])}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <Field label="HP máximo">
                <input type="number" value={hpMax} min={1} onChange={e => setHpMax(parseInt(e.target.value) || 1)} style={darkInput} />
              </Field>
              <Field label="Clase de Armadura (CA)">
                <input type="number" value={ac} min={1} onChange={e => setAc(parseInt(e.target.value) || 10)} style={darkInput} />
              </Field>
              <Field label="Bonus Proficiencia">
                <input type="number" value={profBonus} min={2} max={6} onChange={e => setProfBonus(parseInt(e.target.value) || 2)} style={darkInput} />
              </Field>
            </div>
          </div>
        )}

        {/* ── Paso 4: Personalidad ── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--gold)', fontSize: '1.1rem' }}>
              Personalidad
            </h2>
            {[
              { label: 'Rasgos de personalidad', val: personality, set: setPersonality, ph: '¿Cómo se comporta tu personaje?' },
              { label: 'Ideales', val: ideals, set: setIdeals, ph: '¿Qué cree o valora?' },
              { label: 'Vínculos', val: bonds, set: setBonds, ph: '¿Con qué o quién está conectado?' },
              { label: 'Defectos', val: flaws, set: setFlaws, ph: '¿Cuáles son sus debilidades?' },
            ].map(({ label, val, set, ph }) => (
              <Field key={label} label={label}>
                <textarea value={val} onChange={e => set(e.target.value)} rows={3} placeholder={ph}
                  style={{ ...darkInput, resize: 'none' }} />
              </Field>
            ))}
          </div>
        )}

        {/* Navegación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            className="btn-parchment" style={{ opacity: step === 1 ? 0.3 : 1 }}>
            Anterior
          </button>
          {step < 4 ? (
            <button onClick={() => setStep(s => Math.min(4, s + 1))} className="btn-crimson">
              Siguiente →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-crimson"
              style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Creando...' : 'Crear Personaje →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function getSpellSlots(className: string, level: number): Record<number, number> {
  const fullCaster: Record<number, number[]> = {
    1: [2,0,0,0,0,0,0,0,0], 2: [3,0,0,0,0,0,0,0,0],
    3: [4,2,0,0,0,0,0,0,0], 4: [4,3,0,0,0,0,0,0,0],
    5: [4,3,2,0,0,0,0,0,0], 6: [4,3,3,0,0,0,0,0,0],
    7: [4,3,3,1,0,0,0,0,0], 8: [4,3,3,2,0,0,0,0,0],
    9: [4,3,3,3,1,0,0,0,0], 10:[4,3,3,3,2,0,0,0,0],
    11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0],
    15:[4,3,3,3,2,1,1,1,0], 16:[4,3,3,3,2,1,1,1,0],
    17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1],
  }
  const fullCasters = ['Bardo','Clérigo','Druida','Hechicero','Mago']
  if (!fullCasters.includes(className)) return {}
  const slots = fullCaster[Math.min(20, Math.max(1, level))] ?? []
  const result: Record<number, number> = {}
  slots.forEach((count, i) => { result[i + 1] = count })
  return result
}
