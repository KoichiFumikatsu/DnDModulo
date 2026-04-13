'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateSlotUsed(characterId: string, classId: string, spellLevel: number, slotsUsed: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Verify character ownership
  const { data: character } = await supabase
    .from('characters').select('id').eq('id', characterId).eq('user_id', user.id).single()
  if (!character) return { error: 'Not found' }

  await supabase.from('character_spell_slots')
    .update({ slots_used: slotsUsed })
    .eq('class_id', classId)
    .eq('spell_level', spellLevel)

  revalidatePath(`/characters/${characterId}`)
  return { ok: true }
}
