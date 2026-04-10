'use client'

import { useState } from 'react'
import Link from 'next/link'
import { register } from '../actions'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await register(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen px-4"
      style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm p-8 rounded-xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎲</div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--accent-gold)' }}>
            Crear Cuenta
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-muted)' }}>
              Nombre de usuario
            </label>
            <input
              name="username"
              type="text"
              required
              minLength={3}
              className="w-full px-3 py-2 rounded-lg border outline-none focus:ring-2"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-muted)' }}>
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 rounded-lg border outline-none focus:ring-2"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-muted)' }}>
              Contraseña
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full px-3 py-2 rounded-lg border outline-none focus:ring-2"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg"
              style={{ background: '#3d1515', color: '#f87171' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" style={{ color: 'var(--accent-hover)' }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
