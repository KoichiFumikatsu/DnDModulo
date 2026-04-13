/* Weapons page — matches Armas.png reference */

interface Weapon {
  id: string
  name: string
  atk_bonus: string | null
  damage: string | null
  damage_type: string | null
  range: string | null
  notes: string | null
}

interface Props {
  weapons: Weapon[]
}

export default function WeaponsTab({ weapons }: Props) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 1rem' }}>

      {/* Page header — dragon + title + dragon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, transform: 'scaleX(-1)', opacity: 0.95 }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-new-rocker, Cinzel, serif)',
            fontSize: '3.5rem',
            color: 'var(--cs-accent)',
            lineHeight: 1,
            margin: 0,
          }}>
            Weapons
          </h2>
        </div>
        <img src="/assets/dnd/dragon-right.svg" alt="" aria-hidden="true"
          style={{ width: 110, height: 110, opacity: 0.95 }} />
      </div>

      {/* Table frame */}
      <div className="cs-frame cs-frame-corners" style={{
        border: '1px solid var(--cs-gold)',
        background: 'var(--cs-card)',
        padding: '1.5rem 2rem',
      }}>
        {weapons.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', fontSize: '0.9rem', padding: '2rem 0' }}>
            No weapons added yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cs-gold)' }}>
                {['Weapon Name', 'Att bonus/DC', 'Damage Type', 'Notes'].map(h => (
                  <th key={h} style={{
                    fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--cs-text-muted)',
                    padding: '0 0 0.6rem',
                    textAlign: 'left',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weapons.map((w, i) => (
                <tr key={w.id} style={{
                  borderBottom: i < weapons.length - 1 ? '1px solid rgba(201,173,106,0.35)' : 'none',
                }}>
                  <td style={{ padding: '0.75rem 0.5rem 0.75rem 0', verticalAlign: 'top' }}>
                    <span style={{
                      fontFamily: 'var(--font-cinzel, Cinzel, serif)',
                      fontSize: '0.88rem',
                      fontStyle: 'italic',
                      color: 'var(--cs-accent)',
                      fontWeight: 600,
                    }}>
                      {w.name}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem 0.75rem 0.5rem', verticalAlign: 'top' }}>
                    <span style={{
                      fontFamily: 'var(--font-montaga, Georgia, serif)',
                      fontSize: '0.88rem',
                      color: 'var(--cs-text)',
                    }}>
                      {w.atk_bonus || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem 0.75rem 0.5rem', verticalAlign: 'top' }}>
                    <div style={{ fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.88rem', color: 'var(--cs-text)' }}>
                      {w.damage && <div>{w.damage}</div>}
                      {w.damage_type && <div style={{ color: 'var(--cs-text-muted)', fontSize: '0.78rem' }}>{w.damage_type}</div>}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 0 0.75rem 0.5rem', verticalAlign: 'top' }}>
                    <div style={{ fontFamily: 'var(--font-montaga, Georgia, serif)', fontSize: '0.82rem', color: 'var(--cs-text)' }}>
                      {w.notes && <div style={{ whiteSpace: 'pre-wrap' }}>{w.notes}</div>}
                      {w.range && <div style={{ color: 'var(--cs-text-muted)', fontSize: '0.75rem', marginTop: 2 }}>Range: {w.range}</div>}
                    </div>
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
