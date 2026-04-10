import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/auth/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('username, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--cover)' }}>
      {/* Cubierta superior — estilo grimorio */}
      <header className="book-nav px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard"
            style={{
              fontFamily: 'var(--font-cinzel, serif)',
              fontSize: '1.1rem',
              color: 'var(--gold)',
              textDecoration: 'none',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
            ⚔️ Grimorio
          </Link>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/dashboard"
              style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.8rem', textDecoration: 'none', opacity: 0.8, letterSpacing: '0.05em' }}>
              Personajes
            </Link>
            <Link href="/dashboard/profile"
              style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-cinzel, serif)', fontSize: '0.8rem', textDecoration: 'none', opacity: 0.8, letterSpacing: '0.05em' }}>
              Perfil
            </Link>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--gold-light)', fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.8 }}>
            {profile?.username ?? user.email}
            {profile?.role === 'dm' && (
              <span style={{
                marginLeft: '0.5rem',
                padding: '0.1rem 0.4rem',
                background: 'var(--gold-dark)',
                color: 'var(--cover)',
                fontFamily: 'var(--font-cinzel, serif)',
                fontSize: '0.65rem',
                letterSpacing: '0.1em',
                fontStyle: 'normal',
              }}>
                DM
              </span>
            )}
          </span>
          <form action={logout}>
            <button type="submit" style={{ color: 'var(--gold-light)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em' }}>
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 sm:p-6">
        {children}
      </div>
    </div>
  )
}
