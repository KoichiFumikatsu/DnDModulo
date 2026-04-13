'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  characterId: string
  hpCurrent: number
  hpMax: number
  hpTemp: number
}

export default function HpManager({ characterId, hpCurrent, hpMax, hpTemp: initialTemp }: Props) {
  const supabase = createClient()
  const [hp, setHp] = useState(hpCurrent)
  const [temp, setTemp] = useState(initialTemp)
  const [dmg, setDmg] = useState('')
  const [heal, setHeal] = useState('')

  async function saveHp(newHp: number, newTemp: number) {
    await supabase.from('characters')
      .update({ hp_current: newHp, hp_temp: newTemp })
      .eq('id', characterId)
  }

  function applyDamage() {
    const val = parseInt(dmg)
    if (!val || val <= 0) return
    const newTemp = Math.max(0, temp - val)
    const remaining = val - temp
    const newHp = remaining > 0 ? Math.max(0, hp - remaining) : hp
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
    const clamped = Math.max(0, Math.min(hpMax, val))
    setHp(clamped)
    saveHp(clamped, temp)
  }

  function setTempDirect(val: number) {
    const clamped = Math.max(0, val)
    setTemp(clamped)
    saveHp(hp, clamped)
  }

  const pct = hpMax > 0 ? Math.max(0, Math.min(100, (hp / hpMax) * 100)) : 0
  const barColor = pct > 50 ? '#2d6a2d' : pct > 25 ? 'var(--cs-gold)' : 'var(--cs-accent)'

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '0.3rem 0.5rem',
    border: '1px solid var(--cs-gold)',
    background: 'rgba(255,255,255,0.6)',
    color: 'var(--cs-text)',
    fontFamily: 'var(--font-montaga, Georgia, serif)',
    fontSize: '0.85rem',
    outline: 'none',
    textAlign: 'center' as const,
    borderRadius: 2,
  }

  const btnDanger: React.CSSProperties = {
    padding: '0.3rem 0.75rem',
    background: 'var(--cs-accent)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-cinzel, Cinzel, serif)',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    borderRadius: 2,
  }

  const btnHeal: React.CSSProperties = {
    ...btnDanger,
    background: '#2d6a2d',
  }

  const stepBtn: React.CSSProperties = {
    width: 24, height: 24,
    background: 'var(--cs-gold)',
    color: 'var(--cs-card)',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '1rem',
    lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 2,
    flexShrink: 0,
  }

  const numInput: React.CSSProperties = {
    width: 46, textAlign: 'center',
    border: '1px solid var(--cs-gold)',
    background: 'rgba(255,255,255,0.6)',
    color: 'var(--cs-text)',
    fontFamily: 'var(--font-cinzel, Cinzel, serif)',
    fontSize: '0.9rem',
    fontWeight: 700,
    outline: 'none',
    padding: '0.1rem 0',
    borderRadius: 2,
  }

  return (
    <div style={{
      border: '1px solid var(--cs-gold)',
      background: 'var(--cs-card)',
      padding: '0.75rem 1rem',
      marginBottom: '0.75rem',
    }}>
      {/* HP bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
        <span style={{
          fontFamily: 'var(--font-cinzel, Cinzel, serif)',
          fontSize: '0.6rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'var(--cs-text-muted)',
        }}>
          HP
        </span>
        <span className="cs-num" style={{ fontSize: '1.1rem', color: barColor }}>
          {hp}<span style={{ fontSize: '0.7rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}> / {hpMax}</span>
          {temp > 0 && <span style={{ fontSize: '0.7rem', color: '#5b8dd9', marginLeft: 6 }}>+{temp} tmp</span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(201,173,106,0.25)', borderRadius: 3, marginBottom: '0.65rem', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s, background 0.3s' }} />
      </div>

      {/* Damage / Heal row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            style={inputStyle}
            type="number" min={1} value={dmg}
            placeholder="Daño"
            onChange={e => setDmg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyDamage()}
          />
          <button style={btnDanger} onClick={applyDamage}>Daño</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            style={inputStyle}
            type="number" min={1} value={heal}
            placeholder="Curar"
            onChange={e => setHeal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyHeal()}
          />
          <button style={btnHeal} onClick={applyHeal}>Curar</button>
        </div>
      </div>

      {/* Manual steppers */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-cinzel)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cs-text-muted)' }}>
            HP actual
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button style={stepBtn} onClick={() => setHpDirect(hp - 1)}>−</button>
            <input
              style={numInput} type="number" value={hp} min={0} max={hpMax}
              onChange={e => setHpDirect(parseInt(e.target.value) || 0)}
            />
            <button style={stepBtn} onClick={() => setHpDirect(hp + 1)}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-cinzel)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cs-text-muted)' }}>
            HP temporal
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button style={stepBtn} onClick={() => setTempDirect(temp - 1)}>−</button>
            <input
              style={{ ...numInput, color: '#5b8dd9' }} type="number" value={temp} min={0}
              onChange={e => setTempDirect(parseInt(e.target.value) || 0)}
            />
            <button style={stepBtn} onClick={() => setTempDirect(temp + 1)}>+</button>
          </div>
        </div>
      </div>
    </div>
  )
}
