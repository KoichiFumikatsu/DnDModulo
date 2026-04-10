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
      style={{ background: 'var(--cover)' }}>

      <div className="parchment-page ornate-border w-full" style={{ maxWidth: 380, padding: '2.5rem 2rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎲</div>
          <h1 style={{ fontFamily: 'var(--font-cinzel, serif)', color: 'var(--crimson)', fontSize: '1.5rem' }}>
            Nuevo Aventurero
          </h1>
          <p style={{ color: 'var(--ink-faded)', fontSize: '0.85rem', fontStyle: 'italic', marginTop: '0.25rem' }}>
            Inscribe tu nombre en el grimorio
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--ink-faded)', marginBottom: '0.35rem', fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em' }}>
              Nombre de usuario
            </label>
            <input name="username" type="text" required minLength={3} className="ifield" placeholder="KoichyKun..." />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--ink-faded)', marginBottom: '0.35rem', fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em' }}>
              Correo
            </label>
            <input name="email" type="email" required className="ifield" placeholder="tu@correo.com" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--ink-faded)', marginBottom: '0.35rem', fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em' }}>
              Contraseña
            </label>
            <input name="password" type="password" required minLength={6} className="ifield" />
          </div>

          {error && (
            <p style={{ background: '#3d0a0a', color: '#f5c0c0', padding: '0.5rem 0.75rem', fontSize: '0.85rem', border: '1px solid #8b1a1a' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-crimson"
            style={{ width: '100%', padding: '0.65rem', marginTop: '0.5rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="ornate-divider" style={{ margin: '1.25rem 0 1rem' }} />

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--ink-faded)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" style={{ color: 'var(--crimson)', fontWeight: 600 }}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
