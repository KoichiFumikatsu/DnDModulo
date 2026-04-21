'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { setActiveCampaignId } from '@/lib/campaign/broadcast'
import PartyPanel from '@/components/campaign/PartyPanel'
import EventFeed from '@/components/campaign/EventFeed'
import BattleGrid from '@/components/campaign/BattleGrid'
import type { Token } from '@/components/campaign/BattleGrid'

interface Campaign {
  id: string
  name: string
  invite_code: string
  dm_id: string
  is_active: boolean
}

interface MemberRow {
  user_id: string
  character_id: string | null
  characters: {
    name: string
    race: string | null
    personality: string | null
    character_classes: { class_name: string; level: number; is_primary: boolean }[]
    character_images: { image_url: string; is_active: boolean }[]
  } | null
  username: string | null
}

interface MapState {
  map_image_url: string | null
  grid_cols: number
  grid_rows: number
  tokens: Token[]
  map_offset_x: number
  map_offset_y: number
  map_scale: number
}

interface SheetCharacter {
  id: string
  name: string
  race: string | null
  background: string | null
  hp_current: number
  hp_max: number
  strength: number; dexterity: number; constitution: number
  intelligence: number; wisdom: number; charisma: number
  character_classes: { class_name: string; level: number }[]
}

interface MyCharacter {
  id: string
  name: string
  race: string | null
  character_images: { image_url: string; is_active: boolean }[]
}

export default function CampaignRoomPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isDM, setIsDM] = useState(false)
  const [dmUsername, setDmUsername] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [mapState, setMapState] = useState<MapState>({ map_image_url: null, grid_cols: 20, grid_rows: 15, tokens: [], map_offset_x: 0, map_offset_y: 0, map_scale: 1 })
  const [viewingSheet, setViewingSheet] = useState<SheetCharacter | null>(null)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const [showCharPicker, setShowCharPicker] = useState(false)
  const [myCharacters, setMyCharacters] = useState<MyCharacter[]>([])
  const [charPickerLoading, setCharPickerLoading] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from('campaign_members')
      .select('user_id, character_id, characters(name, race, personality, character_classes(class_name, level, is_primary), character_images(image_url, is_active))')
      .eq('campaign_id', id)
    if (!data) return
    const userIds = (data as { user_id: string }[]).map(m => m.user_id)
    const { data: profiles } = await supabase.from('user_profiles').select('id, username').in('id', userIds)
    const nameById = new Map((profiles ?? []).map(p => [p.id, p.username]))
    const merged = (data as unknown as Omit<MemberRow, 'username'>[]).map(m => ({
      ...m,
      username: nameById.get(m.user_id) ?? null,
    }))
    setMembers(merged)
  }, [id])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setCurrentUserId(user.id)

      const [{ data: camp }, { data: membersData }, { data: map }] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', id).single(),
        supabase.from('campaign_members')
          .select('user_id, character_id, characters(name, race, personality, character_classes(class_name, level, is_primary), character_images(image_url, is_active))')
          .eq('campaign_id', id),
        supabase.from('campaign_map_state').select('*').eq('campaign_id', id).single(),
      ])

      if (!camp) { router.push('/campaigns'); return }
      setCampaign(camp as Campaign)
      setIsDM(camp.dm_id === user.id)

      // Fetch usernames for members and DM in one query (no FK to user_profiles, so no embed).
      const memberRows = (membersData ?? []) as unknown as Omit<MemberRow, 'username'>[]
      const profileIds = Array.from(new Set([camp.dm_id, ...memberRows.map(m => m.user_id)]))
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', profileIds)
      const nameById = new Map((profiles ?? []).map(p => [p.id, p.username]))
      setMembers(memberRows.map(m => ({ ...m, username: nameById.get(m.user_id) ?? null })))
      setDmUsername(nameById.get(camp.dm_id) ?? null)

      if (map) setMapState({
        map_image_url: map.map_image_url,
        grid_cols: map.grid_cols,
        grid_rows: map.grid_rows,
        tokens: (map.tokens as Token[]) ?? [],
        map_offset_x: map.map_offset_x ?? 0,
        map_offset_y: map.map_offset_y ?? 0,
        map_scale: map.map_scale ?? 1,
      })

      setActiveCampaignId(id)
      setLoading(false)

      // Auto-open character picker if player has no character assigned.
      // If they have a character but no token on the map (e.g. assigned before
      // the API route existed), trigger the idempotent assign to create it.
      const isPlayerDM = camp.dm_id === user.id
      if (!isPlayerDM) {
        const myRow = memberRows.find(m => m.user_id === user.id)
        if (myRow && !myRow.character_id) {
          const { data: chars } = await supabase.from('characters')
            .select('id, name, race, character_images(image_url, is_active)')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
          setMyCharacters((chars ?? []) as unknown as MyCharacter[])
          setShowCharPicker(true)
        } else if (myRow?.character_id) {
          const tokens = (map?.tokens as Token[] | undefined) ?? []
          const hasToken = tokens.some(t => t.owner_user_id === user.id)
          if (!hasToken) {
            const res = await fetch(`/api/campaigns/${id}/assign-character`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ characterId: myRow.character_id }),
            })
            if (res.ok) {
              const { tokens: newTokens } = await res.json() as { tokens?: Token[] }
              if (newTokens) setMapState(prev => ({ ...prev, tokens: newTokens }))
            }
          }
        }
      }
    }
    load()
    return () => { setActiveCampaignId(null) }
  }, [id])  // eslint-disable-line

  useEffect(() => {
    if (!currentUserId) return
    const channel = supabase.channel(`camp-presence-${id}`, { config: { presence: { key: currentUserId } } })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string }>()
        const ids = new Set(Object.values(state).flat().map((p: { user_id: string }) => p.user_id))
        setOnlineUsers(ids)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ user_id: currentUserId })
      })
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId, id])  // eslint-disable-line

  useEffect(() => {
    const channel = supabase
      .channel(`camp-map-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_map_state', filter: `campaign_id=eq.${id}` },
        (payload) => {
          const r = payload.new as MapState & { tokens: Token[] }
          setMapState({
            map_image_url: r.map_image_url,
            grid_cols: r.grid_cols,
            grid_rows: r.grid_rows,
            tokens: r.tokens ?? [],
            map_offset_x: r.map_offset_x ?? 0,
            map_offset_y: r.map_offset_y ?? 0,
            map_scale: r.map_scale ?? 1,
          })
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])  // eslint-disable-line

  const openSheet = useCallback(async (characterId: string) => {
    setSheetLoading(true)
    const { data } = await supabase
      .from('characters')
      .select('id, name, race, background, hp_current, hp_max, strength, dexterity, constitution, intelligence, wisdom, charisma, character_classes(class_name, level)')
      .eq('id', characterId)
      .single()
    setViewingSheet(data as SheetCharacter ?? null)
    setSheetLoading(false)
  }, [])  // eslint-disable-line

  const openCharPicker = useCallback(async () => {
    if (!currentUserId) return
    setCharPickerLoading(true)
    setShowCharPicker(true)
    const { data } = await supabase.from('characters')
      .select('id, name, race, character_images(image_url, is_active)')
      .eq('user_id', currentUserId)
      .order('updated_at', { ascending: false })
    setMyCharacters((data ?? []) as unknown as MyCharacter[])
    setCharPickerLoading(false)
  }, [currentUserId])  // eslint-disable-line

  const [pickerError, setPickerError] = useState<string | null>(null)

  const assignCharacter = useCallback(async (charId: string | null) => {
    if (!currentUserId) return
    setPickerError(null)
    const res = await fetch(`/api/campaigns/${id}/assign-character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: charId }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      setPickerError(error ?? 'No se pudo asignar el personaje')
      return
    }
    const { tokens } = await res.json() as { tokens?: Token[] }
    if (tokens) setMapState(prev => ({ ...prev, tokens }))
    setShowCharPicker(false)
    await loadMembers()
  }, [currentUserId, id, loadMembers])  // eslint-disable-line

  function copyCode() {
    if (!campaign) return
    navigator.clipboard.writeText(campaign.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }
  function mod(score: number) { return Math.floor((score - 10) / 2) }

  if (loading) return (
    <div className="parchment-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'Cinzel, serif', color: 'var(--cs-text-muted)' }}>Cargando sala...</p>
    </div>
  )

  if (!campaign) return null

  const partyMembers = members.map(m => {
    const cls = m.characters?.character_classes?.find(c => c.is_primary) ?? m.characters?.character_classes?.[0]
    const portrait = m.characters?.character_images?.find(i => i.is_active)?.image_url ?? null
    return {
      userId: m.user_id,
      username: m.username ?? 'Jugador',
      characterId: m.character_id,
      characterName: m.characters?.name ?? null,
      characterUrl: m.character_id ? `/characters/${m.character_id}` : null,
      race: m.characters?.race ?? null,
      className: cls?.class_name ?? null,
      level: cls?.level ?? null,
      portraitUrl: portrait,
      isOnline: onlineUsers.has(m.user_id),
    }
  })

  // Add DM as synthetic party entry (always first)
  const dmEntry = {
    userId: campaign.dm_id,
    username: dmUsername ?? 'Master',
    characterId: null,
    characterName: null,
    characterUrl: null,
    race: null,
    className: null,
    level: null,
    portraitUrl: null,
    isOnline: onlineUsers.has(campaign.dm_id),
    isDMEntry: true,
  }
  const allPartyMembers = [dmEntry, ...partyMembers]

  return (
    <div className="parchment-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      <nav style={{ background: '#2c1a0e', padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <Link href="/campaigns" style={{ fontSize: '0.72rem', color: 'var(--cs-gold)', textDecoration: 'none', fontFamily: 'Cinzel, serif' }}>
          ← Campañas
        </Link>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', fontWeight: 700, color: '#e8d5a3', flex: 1 }}>
          {campaign.name}
          {isDM && <span style={{ marginLeft: 8, fontSize: '0.65rem', color: 'var(--cs-gold)' }}>👑 Master</span>}
        </span>
        <button onClick={copyCode}
          style={{ fontSize: '0.65rem', padding: '2px 10px', borderRadius: 10, border: '1px solid rgba(201,173,106,0.5)', background: 'transparent', color: copied ? '#22c55e' : 'var(--cs-gold)', cursor: 'pointer', fontFamily: 'Cinzel, serif' }}>
          {copied ? '✓ Copiado' : `Código: ${campaign.invite_code}`}
        </button>
        <Link href="/campaigns"
          style={{ fontSize: '0.65rem', padding: '2px 10px', borderRadius: 10, border: '1px solid rgba(220,50,50,0.5)', background: 'transparent', color: 'rgba(220,100,100,0.9)', cursor: 'pointer', fontFamily: 'Cinzel, serif', textDecoration: 'none' }}>
          Salir
        </Link>
      </nav>

      <div className="camp-layout" style={{ flex: 1, overflow: 'hidden' }}>

        <div style={{ padding: '1rem', overflowY: 'auto', borderRight: '1px solid rgba(201,173,106,0.2)' }}>
          <h3 className="cs-heading" style={{ fontSize: '0.72rem', marginBottom: '0.75rem' }}>Grupo</h3>
          <PartyPanel
            members={allPartyMembers}
            isDM={isDM}
            currentUserId={currentUserId ?? ''}
            onViewSheet={openSheet}
            onPickCharacter={openCharPicker}
          />
        </div>

        <div style={{ padding: '1rem', overflowY: 'auto' }}>
          <h3 className="cs-heading" style={{ fontSize: '0.72rem', marginBottom: '0.75rem' }}>Mapa</h3>
          <BattleGrid
            campaignId={id}
            isDM={isDM}
            currentUserId={currentUserId ?? ''}
            initialTokens={mapState.tokens}
            initialMapUrl={mapState.map_image_url}
            initialCols={mapState.grid_cols}
            initialRows={mapState.grid_rows}
            initialOffsetX={mapState.map_offset_x}
            initialOffsetY={mapState.map_offset_y}
            initialScale={mapState.map_scale}
          />
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid rgba(201,173,106,0.2)' }}>
          <h3 className="cs-heading" style={{ fontSize: '0.72rem', marginBottom: '0.75rem', flexShrink: 0 }}>Tiradas</h3>
          <EventFeed campaignId={id} isDM={isDM} />
        </div>
      </div>

      {showCharPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowCharPicker(false)}>
          <div className="parchment-page" style={{ width: '100%', maxWidth: 400, padding: '1.5rem', borderRadius: 8, border: '1px solid var(--cs-gold)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--cs-accent)', margin: 0 }}>Elige tu personaje</h2>
              <button onClick={() => setShowCharPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-text-muted)', fontSize: '1rem' }}>✕</button>
            </div>
            {pickerError && (
              <p style={{ fontFamily: 'var(--font-montaga)', color: 'var(--danger, #b85450)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                {pickerError}
              </p>
            )}
            {charPickerLoading ? (
              <p style={{ fontFamily: 'Cinzel, serif', color: 'var(--cs-text-muted)', fontSize: '0.85rem' }}>Cargando...</p>
            ) : myCharacters.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-montaga)', color: 'var(--cs-text-muted)', fontSize: '0.85rem' }}>
                No tienes personajes creados.{' '}
                <Link href="/characters/new" style={{ color: 'var(--cs-gold)' }}>Crear uno</Link>
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {myCharacters.map(c => {
                  const portrait = c.character_images?.find(i => i.is_active)?.image_url
                  return (
                    <button key={c.id} onClick={() => assignCharacter(c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', cursor: 'pointer', borderRadius: 4, textAlign: 'left', width: '100%' }}>
                      {portrait && (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `url(${portrait}) center/cover`, border: '1px solid var(--cs-gold)', flexShrink: 0 }} />
                      )}
                      <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cs-accent)' }}>{c.name}</span>
                      {c.race && <span style={{ fontSize: '0.72rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>{c.race}</span>}
                    </button>
                  )
                })}
                <button onClick={() => assignCharacter(null)}
                  style={{ padding: '0.4rem', border: '1px dashed rgba(201,173,106,0.3)', background: 'transparent', cursor: 'pointer', borderRadius: 4, fontSize: '0.72rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', width: '100%' }}>
                  Sin personaje
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {(viewingSheet || sheetLoading) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setViewingSheet(null)}>
          <div className="parchment-page" style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', borderRadius: 8, border: '1px solid var(--cs-gold)' }}
            onClick={e => e.stopPropagation()}>
            {sheetLoading ? (
              <p style={{ fontFamily: 'Cinzel, serif', color: 'var(--cs-text-muted)' }}>Cargando...</p>
            ) : viewingSheet && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: 'var(--cs-accent)', margin: 0 }}>{viewingSheet.name}</h2>
                  <button onClick={() => setViewingSheet(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-text-muted)', fontSize: '1rem' }}>✕</button>
                </div>
                <p style={{ fontFamily: 'var(--font-montaga)', fontSize: '0.8rem', color: 'var(--cs-text-muted)', marginBottom: '1rem' }}>
                  {viewingSheet.race} · {viewingSheet.character_classes?.map(c => `${c.class_name} ${c.level}`).join(', ')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.5rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase' }}>HP</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--cs-accent)' }}>{viewingSheet.hp_current} / {viewingSheet.hp_max}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.4rem' }}>
                  {(['strength','dexterity','constitution','intelligence','wisdom','charisma'] as const).map(ab => {
                    const short = ab.slice(0,3).toUpperCase()
                    const score = viewingSheet[ab]
                    return (
                      <div key={ab} style={{ textAlign: 'center', padding: '0.4rem 0.2rem', border: '1px solid var(--cs-gold)', background: 'var(--cs-card)' }}>
                        <div style={{ fontSize: '0.55rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase' }}>{short}</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cs-accent)' }}>{sign(mod(score))}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)' }}>{score}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <Link href={`/characters/${viewingSheet.id}`} target="_blank"
                    style={{ fontSize: '0.72rem', padding: '4px 16px', borderRadius: 20, border: '1px solid var(--cs-gold)', color: 'var(--cs-gold)', textDecoration: 'none', fontFamily: 'Cinzel, serif' }}>
                    Ver hoja completa ↗
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
