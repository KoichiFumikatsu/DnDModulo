'use client'

interface Member {
  userId: string
  username: string
  characterId: string | null
  characterName: string | null
  characterUrl: string | null
  race: string | null
  className: string | null
  level: number | null
  portraitUrl: string | null
  isOnline: boolean
  isDMEntry?: boolean
}

interface Props {
  members: Member[]
  isDM: boolean
  currentUserId: string
  onViewSheet?: (characterId: string) => void
  onPickCharacter?: () => void
}

export default function PartyPanel({ members, isDM, currentUserId, onViewSheet, onPickCharacter }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {members.length === 0 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', padding: '0.5rem 0' }}>
          Esperando jugadores...
        </p>
      )}
      {members.map(m => (
        <div key={m.userId} className="camp-party-card">
          {/* Online indicator + portrait */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: m.portraitUrl ? `url(${m.portraitUrl}) center/cover` : 'rgba(201,173,106,0.2)',
              border: `2px solid ${m.isDMEntry ? '#c9ad6a' : 'var(--cs-gold)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--cs-accent)', fontWeight: 700,
            }}>
              {!m.portraitUrl && (m.isDMEntry ? '👑' : (m.characterName?.[0] ?? m.username?.[0] ?? '?'))}
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 10, height: 10, borderRadius: '50%',
              background: m.isOnline ? '#22c55e' : '#6b7280',
              border: '1.5px solid var(--cs-card)',
            }} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', fontWeight: 700, color: 'var(--cs-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.isDMEntry
                ? <span style={{ color: 'var(--cs-gold)' }}>Master</span>
                : m.characterName
                  ? m.characterName
                  : <span style={{ color: 'var(--cs-text-muted)', fontStyle: 'italic', fontWeight: 400 }}>Sin personaje</span>
              }
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>
              {[m.race, m.className, m.level ? `Nv${m.level}` : null].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: '0.58rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginTop: 1 }}>
              👤 {m.username}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
            {/* DM: ver hoja de otros jugadores */}
            {isDM && !m.isDMEntry && m.characterId && onViewSheet && (
              <button onClick={() => onViewSheet(m.characterId!)}
                style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}>
                Ver PJ
              </button>
            )}

            {/* Player: open own sheet in new tab */}
            {!m.isDMEntry && m.userId === currentUserId && m.characterUrl && (
              <a href={m.characterUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 10, border: '1px solid #3a6fa8', background: '#3a6fa8', color: '#fff', cursor: 'pointer', fontFamily: 'Cinzel, serif', textDecoration: 'none', textAlign: 'center' }}>
                Mi hoja ↗
              </a>
            )}

            {/* Player: pick/change character */}
            {!m.isDMEntry && m.userId === currentUserId && onPickCharacter && (
              <button onClick={onPickCharacter}
                style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--cs-accent)', background: 'transparent', color: 'var(--cs-accent)', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}>
                {m.characterId ? 'Cambiar' : 'Elegir PJ'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
