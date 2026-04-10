'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useCharacterUpdate(characterId: string) {
  const [saving, setSaving] = useState(false)

  const update = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('characters').update(patch).eq('id', characterId)
    setSaving(false)
  }, [characterId])

  return { update, saving }
}

export function useResourceUpdate() {
  const update = useCallback(async (
    table: string,
    id: string,
    patch: Record<string, unknown>
  ) => {
    const supabase = createClient()
    await supabase.from(table).update(patch).eq('id', id)
  }, [])

  return { update }
}
