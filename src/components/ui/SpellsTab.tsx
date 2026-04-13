'use client'

import { useState, useTransition } from 'react'
import { updateSlotUsed } from '@/app/characters/[id]/actions'

interface SpellSlot {
  classId: string
  spell_level: number
  slots_total: number
  slots_used: number
}

interface Spell {
  id: string
  spell_level: number
  name: string
  custom_notes: string | null
  is_prepared: boolean
}

interface ClassData {
  id: string
  class_name: string
  spell_save_dc: number | null
  spell_attack_mod: number | null
  spellcasting_ability: string | null
}

interface Props {
  characterId: string
  classes: ClassData[]
  slots: SpellSlot[]
  spells: Spell[]
}

const LEVEL_LABELS = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export default function SpellsTab({ characterId, classes, slots: initialSlots, spells }: Props) {
  const [slots, setSlots] = useState<SpellSlot[]>(initialSlots)
  const [, startTransition] = useTransition()

  // Group spells by level
  const byLevel: Record<number, Spell[]> = {}
  for (const s of spells) {
    if (!byLevel[s.spell_level]) byLevel[s.spell_level] = []
    byLevel[s.spell_level].push(s)
  }

  const slotsByLevel: Record<number, SpellSlot> = {}
  for (const s of slots) slotsByLevel[s.spell_level] = s

  const mainClass = classes.find(c => c.spell_save_dc || c.spell_attack_mod) ?? classes[0]

  function handleDotClick(slot: SpellSlot, dotIndex: number) {
    // Click dot i: if already used (i < used), restore to i; else use to i+1
    const newUsed = dotIndex < slot.slots_used ? dotIndex : dotIndex + 1
    const clamped = Math.max(0, Math.min(slot.slots_total, newUsed))

    // Optimistic update
    setSlots(prev => prev.map(s =>
      s.classId === slot.classId && s.spell_level === slot.spell_level
        ? { ...s, slots_used: clamped }
        : s
    ))

    startTransition(() => {
      updateSlotUsed(characterId, slot.classId, slot.spell_level, clamped)
    })
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 1rem' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, transform: 'scaleX(-1)', opacity: 0.95 }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-new-rocker, Cinzel, serif)',
            fontSize: '3rem', color: 'var(--cs-accent)', lineHeight: 1, margin: 0,
          }}>
            Magic Spells
          </h2>
        </div>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, opacity: 0.95 }} />
      </div>

      {/* Spell stats row */}
      {mainClass && (mainClass.spell_save_dc || mainClass.spell_attack_mod) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginBottom: '1.5rem' }}>
          {([
            { label: 'Spell Save DC', value: String(mainClass.spell_save_dc ?? '') },
            { label: 'Spell Casting Ability', value: mainClass.spellcasting_ability?.toUpperCase() ?? '' },
            { label: 'Spell Attack Bonus', value: mainClass.spell_attack_mod != null ? `+${mainClass.spell_attack_mod}` : '' },
          ] as { label: string; value: string }[]).filter(x => x.value).map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-new-rocker, Cinzel, serif)',
                fontSize: '0.65rem', color: 'var(--cs-accent)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem',
              }}>
                {label}
              </div>
              <div className="cs-num" style={{ fontSize: '2.5rem', lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Spell slots — interactive dots */}
      {slots.some(s => s.slots_total > 0) && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 2rem' }}>
            {[1,2,3,4,5,6,7,8,9].map(lvl => {
              const slot = slotsByLevel[lvl]
              if (!slot || slot.slots_total === 0) return null
              const remaining = slot.slots_total - slot.slots_used
              return (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right', minWidth: 72 }}>
                    <div style={{
                      fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                      fontSize: '0.58rem', color: 'var(--cs-text-muted)', textTransform: 'uppercase',
                    }}>
                      {LEVEL_LABELS[lvl]} Level
                    </div>
                    <div className="cs-num" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                      {String(remaining).padStart(2, '0')}
                    </div>
                    <div style={{
                      fontSize: '0.55rem', color: 'var(--cs-text-muted)',
                      fontFamily: 'var(--font-cinzel, Cinzel, serif)', textTransform: 'uppercase',
                    }}>
                      Remaining
                    </div>
                  </div>
                  {/* Clickable dots */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 100 }}>
                    {Array.from({ length: slot.slots_total }).map((_, i) => {
                      const used = i < slot.slots_used
                      return (
                        <button
                          key={i}
                          onClick={() => handleDotClick(slot, i)}
                          title={used ? 'Click to restore' : 'Click to use'}
                          style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: used ? 'var(--cs-accent)' : 'transparent',
                            border: `2px solid ${used ? 'var(--cs-accent)' : 'var(--cs-text-muted)'}`,
                            cursor: 'pointer', padding: 0, flexShrink: 0,
                            transition: 'background 0.1s, border-color 0.1s',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            }).filter(Boolean)}
          </div>
          <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginTop: '1rem' }} />
        </div>
      )}

      {/* Spell list */}
      <div style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '1.5rem 2rem' }}>
        {spells.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', fontSize: '0.9rem', padding: '2rem 0' }}>
            No spells added yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cs-gold)' }}>
                {['Spell Name', 'Bonus/DC', 'Damage', 'Notes'].map(h => (
                  <th key={h} style={{
                    fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                    fontSize: '0.68rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--cs-text-muted)', padding: '0 0 0.6rem', textAlign: 'left',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spells.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < spells.length - 1 ? '1px solid rgba(201,173,106,0.35)' : 'none' }}>
                  <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', verticalAlign: 'top' }}>
                    <span style={{
                      fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                      fontSize: '0.85rem', fontStyle: 'italic',
                      color: 'var(--cs-accent)', fontWeight: 600,
                    }}>
                      {s.name}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0.5rem', verticalAlign: 'top', fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.82rem', color: 'var(--cs-text-muted)' }}>
                    —
                  </td>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0.5rem', verticalAlign: 'top', fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.82rem', color: 'var(--cs-text-muted)' }}>
                    —
                  </td>
                  <td style={{ padding: '0.5rem 0 0.5rem 0.5rem', verticalAlign: 'top' }}>
                    <span style={{ fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.82rem', color: 'var(--cs-text)' }}>
                      {s.spell_level === 0 ? 'Cantrip' : `Lvl ${s.spell_level}`}
                      {s.custom_notes && ` · ${s.custom_notes}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
