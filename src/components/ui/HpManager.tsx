'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  characterId: string
  hpCurrent: number
  hpMax: number
  hpTemp: number
  deathSuccesses: number
  deathFailures: number
}

export default function HpManager({
  characterId,
  hpCurrent,
  hpMax,
  hpTemp: initialTemp,
  deathSuccesses: initSuccesses,
  deathFailures: initFailures,
}: Props) {
  const supabase = createClient()
  const [hp, setHp] = useState(hpCurrent)
  const [temp, setTemp] = useState(initialTemp)
  const [dmg, setDmg] = useState('')
  const [heal, setHeal] = useState('')
  const [successes, setSuccesses] = useState(initSuccesses)
  const [failures, setFailures] = useState(initFailures)

  // ── HP helpers ────────────────────────────────────────────────────

  async function saveHp(newHp: number, newTemp: number) {
    await supabase.from('characters')
      .update({ hp_current: newHp, hp_temp: newTemp })
      .eq('id', characterId)
  }

  function applyDamage() {
    const val = parseInt(dmg)
    if (!val || val <= 0) return
    // Temp HP absorbs first
    const newTemp = Math.max(0, temp - val)
    const remaining = val - temp
    const newHp = remaining > 0 ? Math.max(-hpMax, hp - remaining) : hp
    setTemp(newTemp); setHp(newHp); setDmg('')
    saveHp(newHp, newTemp)
  }

  function applyHeal() {
    const val = parseInt(heal)
    if (!val || val <= 0) return
    const newHp = Math.min(hpMax, hp + val)
    setHp(newHp); setHeal('')
    saveHp(newHp, temp)
  }

  function setHpDirect(val: number) {
    const clamped = Math.max(-hpMax, Math.min(hpMax, val))
    setHp(clamped)
    saveHp(clamped, temp)
  }

  function setTempDirect(val: number) {
    const clamped = Math.max(0, val)
    setTemp(clamped)
    saveHp(hp, clamped)
  }

  // ── Death saves ───────────────────────────────────────────────────

  function toggleSave(type: 'success' | 'failure', index: number) {
    if (type === 'success') {
      const newVal = index < successes ? index : index + 1
      setSuccesses(newVal)
      supabase.from('characters').update({ death_saves_successes: newVal }).eq('id', characterId)
    } else {
      const newVal = index < failures ? index : index + 1
      setFailures(newVal)
      supabase.from('characters').update({ death_saves_failures: newVal }).eq('id', characterId)
    }
  }

  function resetDeathSaves() {
    setSuccesses(0); setFailures(0)
    supabase.from('characters').update({ death_saves_successes: 0, death_saves_failures: 0 }).eq('id', characterId)
  }

  // ── Derived state ─────────────────────────────────────────────────

  const isDead = failures >= 3
  const isStable = successes >= 3
  const isUnconscious = hp <= 0
  const isBlooded = hp > 0 && hp <= Math.floor(hpMax / 2)

  const pct = hpMax > 0 ? Math.max(0, Math.min(100, (hp / hpMax) * 100)) : 0
  const barColor = isDead ? '#555'
    : isUnconscious ? 'var(--cs-accent)'
    : isBlooded ? '#b06000'
    : '#2d6a2d'

  // ── Styles ────────────────────────────────────────────────────────

  const inputSt: React.CSSProperties = {
    flex: 1, padding: '0.3rem 0.4rem',
    border: '1px solid var(--cs-gold)',
    background: 'rgba(255,255,255,0.6)',
    color: 'var(--cs-text)',
    fontFamily: 'var(--font-montaga, Georgia, serif)',
    fontSize: '0.85rem', outline: 'none',
    textAlign: 'center', borderRadius: 2,
  }
  const stepBtn: React.CSSProperties = {
    width: 24, height: 24, flexShrink: 0,
    background: 'var(--cs-gold)', color: 'var(--cs-card)',
    border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: '1rem', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 2,
  }
  const numInput: React.CSSProperties = {
    width: 46, textAlign: 'center',
    border: '1px solid var(--cs-gold)',
    background: 'rgba(255,255,255,0.6)',
    color: hp < 0 ? 'var(--cs-accent)' : 'var(--cs-text)',
    fontFamily: 'var(--font-cinzel, Cinzel, serif)',
    fontSize: '0.9rem', fontWeight: 700,
    outline: 'none', padding: '0.1rem 0', borderRadius: 2,
  }

  return (
    <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>

      {/* Status banner */}
      {isDead && (
        <div style={{ background: '#3a0000', color: '#ff6b6b', padding: '0.3rem 0.6rem', marginBottom: '0.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-cinzel)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', border: '1px solid var(--cs-accent)' }}>
          ☠ Muerto — 3 fallos en tiradas de muerte
        </div>
      )}
      {!isDead && isStable && isUnconscious && (
        <div style={{ background: '#1a3a1a', color: '#6fcf6f', padding: '0.3rem 0.6rem', marginBottom: '0.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-cinzel)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', border: '1px solid #2d6a2d' }}>
          ✦ Estabilizado — inconsciente pero a salvo
        </div>
      )}
      {!isDead && !isStable && isUnconscious && (
        <div style={{ background: '#3a1200', color: '#ffaa44', padding: '0.3rem 0.6rem', marginBottom: '0.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-cinzel)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', border: '1px solid #b06000' }}>
          ⚠ Inconsciente — Realiza tiradas de muerte
        </div>
      )}
      {!isUnconscious && isBlooded && (
        <div style={{ background: '#3a2200', color: '#ffcc66', padding: '0.3rem 0.6rem', marginBottom: '0.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-cinzel)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', border: '1px solid #b06000' }}>
          ⚡ Gravemente herido — Tirada de salvación de CON
        </div>
      )}

      {/* HP bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
        <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cs-text-muted)' }}>
          HP
        </span>
        <span className="cs-num" style={{ fontSize: '1.1rem', color: barColor }}>
          {hp < 0 && '−'}{Math.abs(hp)}
          <span style={{ fontSize: '0.7rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}> / {hpMax}</span>
          {temp > 0 && <span style={{ fontSize: '0.7rem', color: '#5b8dd9', marginLeft: 6 }}>+{temp} tmp</span>}
          {hp < 0 && <span style={{ fontSize: '0.65rem', color: 'var(--cs-text-muted)', marginLeft: 6 }}>min: -{hpMax}</span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(201,173,106,0.25)', borderRadius: 3, marginBottom: '0.65rem', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s, background 0.3s' }} />
      </div>

      {/* Damage / Heal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input style={inputSt} type="number" min={1} value={dmg} placeholder="Daño"
            onChange={e => setDmg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyDamage()} />
          <button onClick={applyDamage} style={{ padding: '0.3rem 0.75rem', background: 'var(--cs-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-cinzel)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', borderRadius: 2 }}>
            Daño
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input style={inputSt} type="number" min={1} value={heal} placeholder="Curar"
            onChange={e => setHeal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyHeal()} />
          <button onClick={applyHeal} style={{ padding: '0.3rem 0.75rem', background: '#2d6a2d', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-cinzel)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', borderRadius: 2 }}>
            Curar
          </button>
        </div>
      </div>

      {/* Steppers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {([
          { label: 'HP actual', val: hp, color: numInput.color as string, min: -hpMax, onChange: setHpDirect, isTemp: false },
          { label: 'HP temporal', val: temp, color: '#5b8dd9', min: 0, onChange: setTempDirect, isTemp: true },
        ] as const).map(({ label, val, color, min, onChange }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.56rem', fontFamily: 'var(--font-cinzel)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--cs-text-muted)' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button style={stepBtn} onClick={() => onChange(val - 1)}>−</button>
              <input
                type="number" value={val} min={min} max={hpMax}
                onChange={e => onChange(parseInt(e.target.value) || 0)}
                style={{ ...numInput, color, flex: 1, width: 0 }}
              />
              <button style={stepBtn} onClick={() => onChange(val + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Death saves — shown when HP ≤ 0 */}
      {isUnconscious && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(201,173,106,0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-cinzel)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cs-text-muted)' }}>
              Tiradas de Muerte
            </span>
            <button onClick={resetDeathSaves}
              style={{ fontFamily: 'var(--font-cinzel)', fontSize: '0.6rem', color: 'var(--cs-text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Resetear
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {/* Successes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: '#2d6a2d', minWidth: 52 }}>Éxitos</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <button key={i} onClick={() => toggleSave('success', i)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: '2px solid #2d6a2d',
                      background: i < successes ? '#2d6a2d' : 'transparent',
                      cursor: 'pointer', padding: 0,
                      transition: 'background 0.1s',
                    }} />
                ))}
              </div>
            </div>
            {/* Failures */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.78rem', color: 'var(--cs-accent)', minWidth: 52 }}>Fallos</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <button key={i} onClick={() => toggleSave('failure', i)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: '2px solid var(--cs-accent)',
                      background: i < failures ? 'var(--cs-accent)' : 'transparent',
                      cursor: 'pointer', padding: 0,
                      transition: 'background 0.1s',
                    }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
