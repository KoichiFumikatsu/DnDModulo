'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DeathSavesClient({
  characterId,
  successes: initialSuccesses,
  failures: initialFailures,
}: {
  characterId: string
  successes: number
  failures: number
}) {
  const [successes, setSuccesses] = useState(initialSuccesses)
  const [failures, setFailures] = useState(initialFailures)
  const supabase = createClient()

  async function toggle(type: 'success' | 'failure', index: number) {
    if (type === 'success') {
      const newVal = index < successes ? index : index + 1
      setSuccesses(newVal)
      await supabase.from('characters').update({ death_saves_successes: newVal }).eq('id', characterId)
    } else {
      const newVal = index < failures ? index : index + 1
      setFailures(newVal)
      await supabase.from('characters').update({ death_saves_failures: newVal }).eq('id', characterId)
    }
  }

  async function reset() {
    setSuccesses(0)
    setFailures(0)
    await supabase.from('characters').update({ death_saves_successes: 0, death_saves_failures: 0 }).eq('id', characterId)
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}>
          Tiradas de muerte
        </h3>
        <button onClick={reset} className="text-xs opacity-60 hover:opacity-100"
          style={{ color: 'var(--text-muted)' }}>
          Resetear
        </button>
      </div>
      <div className="rounded-xl border p-4 space-y-3"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <span className="text-sm w-20" style={{ color: 'var(--success)' }}>Éxitos</span>
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <button key={i} onClick={() => toggle('success', i)}
                className="w-8 h-8 rounded-full border-2 transition-all"
                style={{
                  borderColor: 'var(--success)',
                  background: i < successes ? 'var(--success)' : 'transparent',
                }} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm w-20" style={{ color: 'var(--danger)' }}>Fallos</span>
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <button key={i} onClick={() => toggle('failure', i)}
                className="w-8 h-8 rounded-full border-2 transition-all"
                style={{
                  borderColor: 'var(--danger)',
                  background: i < failures ? 'var(--danger)' : 'transparent',
                }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
