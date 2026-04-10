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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Navbar */}
      <header className="border-b px-6 py-3 flex items-center justify-between"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-6">
          <Link href="/dashboard"
            className="text-lg font-bold flex items-center gap-2"
            style={{ color: 'var(--accent-gold)' }}>
            ⚔️ DnD Manager
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard"
              className="transition-colors hover:opacity-100 opacity-70"
              style={{ color: 'var(--text-primary)' }}>
              Mis PJs
            </Link>
            <Link href="/dashboard/profile"
              className="transition-colors hover:opacity-100 opacity-70"
              style={{ color: 'var(--text-primary)' }}>
              Perfil
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>
            {profile?.username ?? user.email}
            {profile?.role === 'dm' && (
              <span className="ml-2 px-2 py-0.5 rounded text-xs"
                style={{ background: 'var(--accent)', color: 'white' }}>
                DM
              </span>
            )}
          </span>
          <form action={logout}>
            <button type="submit"
              className="text-sm opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-primary)' }}>
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  )
}
