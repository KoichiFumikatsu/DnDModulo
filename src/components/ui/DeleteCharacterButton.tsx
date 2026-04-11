'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeleteCharacterButton({
  characterId,
  characterName,
}: {
  characterId: string
  characterName: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar a ${characterName}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('characters').delete().eq('id', characterId)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Eliminar personaje"
      style={{
        position: 'absolute', top: 8, right: 8,
        background: 'rgba(139,26,26,0.15)', border: '1px solid rgba(139,26,26,0.3)',
        color: 'var(--crimson)', cursor: 'pointer',
        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.85rem', lineHeight: 1, borderRadius: '2px',
        opacity: deleting ? 0.4 : 0.6,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '0.6' }}
    >
      ✕
    </button>
  )
}
