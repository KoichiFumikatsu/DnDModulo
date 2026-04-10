import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4"
      style={{ background: 'var(--bg-primary)' }}>

      <div className="text-center">
        <div className="text-6xl mb-4">⚔️</div>
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--accent-gold)' }}>
          DnD Character Manager
        </h1>
        <p style={{ color: 'var(--text-muted)' }} className="text-lg">
          Crea y gestiona tus personajes de D&amp;D 5e
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/auth/login"
          className="px-6 py-3 rounded-lg font-semibold transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}>
          Iniciar sesión
        </Link>
        <Link href="/auth/register"
          className="px-6 py-3 rounded-lg font-semibold transition-colors border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Registrarse
        </Link>
      </div>
    </main>
  )
}
