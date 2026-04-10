import Link from 'next/link'

export default function HomePage() {
  return (
    <main
      className="flex flex-col items-center justify-center min-h-screen gap-10 px-4"
      style={{ background: 'var(--cover)' }}
    >
      {/* Portada del grimorio */}
      <div
        className="parchment-page ornate-border text-center"
        style={{ maxWidth: 420, width: '100%', padding: '3rem 2.5rem' }}
      >
        {/* Ornamento superior */}
        <div style={{ color: 'var(--gold-dark)', fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.7 }}>
          ✦ ✦ ✦
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-cinzel, serif)',
            fontSize: '2.2rem',
            color: 'var(--crimson)',
            lineHeight: 1.1,
            marginBottom: '0.25rem',
          }}
        >
          Grimorio
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-cinzel, serif)',
            fontSize: '0.85rem',
            color: 'var(--gold-dark)',
            letterSpacing: '0.2em',
            marginBottom: '1.5rem',
          }}
        >
          D&amp;D CHARACTER MANAGER
        </p>

        <div className="ornate-divider" />

        <p
          style={{
            fontStyle: 'italic',
            color: 'var(--ink-faded)',
            fontSize: '0.95rem',
            margin: '1rem 0 2rem',
            lineHeight: 1.6,
          }}
        >
          Registra a tus aventureros,<br />
          lleva sus hazañas y estadísticas<br />
          en estas páginas eternas.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link
            href="/auth/login"
            className="btn-crimson"
            style={{ textDecoration: 'none', display: 'block', textAlign: 'center', padding: '0.7rem 1.5rem' }}
          >
            Abrir el Grimorio
          </Link>
          <Link
            href="/auth/register"
            className="btn-parchment"
            style={{ textDecoration: 'none', display: 'block', textAlign: 'center', padding: '0.65rem 1.5rem' }}
          >
            Registrar Nuevo Aventurero
          </Link>
        </div>

        {/* Ornamento inferior */}
        <div style={{ color: 'var(--gold-dark)', fontSize: '1.5rem', marginTop: '1.5rem', opacity: 0.7 }}>
          ✦ ✦ ✦
        </div>
      </div>
    </main>
  )
}
