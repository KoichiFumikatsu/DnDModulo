import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        Mi Perfil
      </h1>

      <div className="rounded-xl border p-6 space-y-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Nombre de usuario
          </label>
          <p className="mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
            {profile?.username}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Email
          </label>
          <p className="mt-1" style={{ color: 'var(--text-primary)' }}>
            {user.email}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Rol
          </label>
          <p className="mt-1 capitalize" style={{ color: 'var(--text-primary)' }}>
            {profile?.role === 'dm' ? 'Dungeon Master' : 'Jugador'}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Miembro desde
          </label>
          <p className="mt-1" style={{ color: 'var(--text-primary)' }}>
            {new Date(profile?.created_at).toLocaleDateString('es-ES', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Edición de perfil disponible próximamente.
      </p>
    </main>
  )
}
