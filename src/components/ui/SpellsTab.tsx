/* Spells page — matches Hechizos.png reference */

interface SpellSlot {
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
  classes: ClassData[]
  slots: SpellSlot[]
  spells: Spell[]
}

function SlotDots({ total, used }: { total: number; used: number }) {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 120 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: i < used ? 'var(--cs-accent)' : 'transparent',
          border: `1.5px solid ${i < used ? 'var(--cs-accent)' : 'var(--cs-text-muted)'}`,
        }} />
      ))}
    </div>
  )
}

const LEVEL_LABELS = ['Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export default function SpellsTab({ classes, slots, spells }: Props) {
  // Group spells by level
  const byLevel: Record<number, Spell[]> = {}
  for (const s of spells) {
    if (!byLevel[s.spell_level]) byLevel[s.spell_level] = []
    byLevel[s.spell_level].push(s)
  }

  const slotsByLevel: Record<number, SpellSlot> = {}
  for (const s of slots) slotsByLevel[s.spell_level] = s

  const mainClass = classes.find(c => c.spell_save_dc || c.spell_attack_mod) ?? classes[0]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 1rem' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, transform: 'scaleX(-1)', opacity: 0.95 }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-new-rocker, Cinzel, serif)',
            fontSize: '3rem',
            color: 'var(--cs-accent)',
            lineHeight: 1,
            margin: 0,
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
          {[
            { label: 'Spell Save DC', value: mainClass.spell_save_dc },
            { label: 'Spell Casting Ability', value: mainClass.spellcasting_ability?.toUpperCase() },
            { label: 'Spell Attack Bonus', value: mainClass.spell_attack_mod != null ? `+${mainClass.spell_attack_mod}` : null },
          ].map(({ label, value }) => value != null && (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-new-rocker, Cinzel, serif)',
                fontSize: '0.65rem',
                color: 'var(--cs-accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.2rem',
              }}>
                {label}
              </div>
              <div className="cs-num" style={{ fontSize: '2.5rem', lineHeight: 1 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spell slots grid */}
      {slots.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 2rem' }}>
            {[1,2,3,4,5,6,7,8,9].map(lvl => {
              const slot = slotsByLevel[lvl]
              if (!slot || slot.slots_total === 0) return null
              return (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontFamily: 'var(--font-cinzel, Cinzel, serif)', fontSize: '0.6rem', color: 'var(--cs-text-muted)', textTransform: 'uppercase' }}>
                      {LEVEL_LABELS[lvl]} Spell Level
                    </div>
                    <div className="cs-num" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                      {String(slot.slots_total - slot.slots_used).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-cinzel, Cinzel, serif)', textTransform: 'uppercase' }}>
                      Expanded
                    </div>
                  </div>
                  <SlotDots total={slot.slots_total} used={slot.slots_used} />
                </div>
              )
            }).filter(Boolean)}
          </div>
          <div style={{ height: 2, background: 'var(--cs-gold)', borderRadius: 4, marginTop: '1rem' }} />
        </div>
      )}

      {/* Spell list */}
      <div className="cs-frame cs-frame-corners" style={{ border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', padding: '1.5rem 2rem' }}>
        {spells.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', fontSize: '0.9rem', padding: '2rem 0' }}>
            No spells added yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cs-gold)' }}>
                {['Spell Name', 'Spell bonus/DC', 'Damage Type', 'Notes'].map(h => (
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
                    Spell bonus/DC
                  </td>
                  <td style={{ padding: '0.5rem 1rem 0.5rem 0.5rem', verticalAlign: 'top', fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.82rem', color: 'var(--cs-text-muted)' }}>
                    Damage Type
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
