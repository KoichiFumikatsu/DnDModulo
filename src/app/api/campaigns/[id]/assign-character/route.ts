import { NextResponse } from 'next/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface Token {
  id: string
  label: string
  color: string
  col: number
  row: number
  portrait_url?: string | null
  character_id?: string | null
  owner_user_id?: string | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params

  let body: { characterId: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const { characterId } = body

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: membership } = await supabase
    .from('campaign_members')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return NextResponse.json({ error: 'not a member' }, { status: 403 })

  if (characterId) {
    const { data: char } = await supabase
      .from('characters')
      .select('id, user_id')
      .eq('id', characterId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!char) return NextResponse.json({ error: 'character not found' }, { status: 404 })
  }

  const admin = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { error: updateErr } = await admin
    .from('campaign_members')
    .update({ character_id: characterId })
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (!characterId) return NextResponse.json({ ok: true, token: null })

  const [{ data: char }, { data: images }, { data: currentMap }] = await Promise.all([
    admin.from('characters').select('name').eq('id', characterId).single(),
    admin.from('character_images').select('image_url, is_active').eq('character_id', characterId),
    admin.from('campaign_map_state').select('*').eq('campaign_id', campaignId).maybeSingle(),
  ])
  if (!char) return NextResponse.json({ error: 'character not found' }, { status: 404 })

  const portrait = images?.find(i => i.is_active)?.image_url ?? null
  const existingTokens = (currentMap?.tokens as Token[] | undefined) ?? []
  const alreadyHas = existingTokens.some(t => t.owner_user_id === user.id)

  if (alreadyHas) {
    return NextResponse.json({ ok: true, token: null, tokens: existingTokens })
  }

  const newToken: Token = {
    id: crypto.randomUUID(),
    label: char.name.slice(0, 3).toUpperCase(),
    color: '#3a6fa8',
    col: 0,
    row: 0,
    portrait_url: portrait,
    character_id: characterId,
    owner_user_id: user.id,
  }
  const updatedTokens = [...existingTokens, newToken]

  const { error: mapErr } = await admin.from('campaign_map_state').upsert({
    campaign_id: campaignId,
    map_image_url: currentMap?.map_image_url ?? null,
    grid_cols: currentMap?.grid_cols ?? 20,
    grid_rows: currentMap?.grid_rows ?? 15,
    tokens: updatedTokens,
    map_offset_x: currentMap?.map_offset_x ?? 0,
    map_offset_y: currentMap?.map_offset_y ?? 0,
    map_scale: currentMap?.map_scale ?? 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'campaign_id' })
  if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, token: newToken, tokens: updatedTokens })
}
