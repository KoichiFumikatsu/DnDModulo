'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RollEvent } from '@/lib/campaign/broadcast'

interface FeedEvent {
  id: string
  character_name: string | null
  type: string
  data: RollEvent
  is_private: boolean
  created_at: string
}

interface Props {
  campaignId: string
  isDM: boolean
}

const TYPE_ICON: Record<string, string> = {
  attack: '⚔️',
  damage: '💥',
  skill: '🎲',
  spell: '✨',
}

function rollColor(e: FeedEvent) {
  const d = e.data
  if (d.isCrit) return 'var(--cs-gold)'
  if (d.isMiss) return 'var(--danger)'
  return 'var(--cs-accent)'
}

export default function EventFeed({ campaignId, isDM }: Props) {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    // Load last 50 events
    supabase
      .from('campaign_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setEvents(data.reverse() as FeedEvent[])
      })

    // Realtime subscription
    const channel = supabase
      .channel(`camp-events-${campaignId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'campaign_events',
        filter: `campaign_id=eq.${campaignId}`,
      }, (payload) => {
        const ev = payload.new as FeedEvent
        if (ev.is_private && !isDM) return
        setEvents(prev => [...prev.slice(-99), ev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [campaignId, isDM])  // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: 4 }}>
        {events.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', textAlign: 'center', marginTop: '2rem' }}>
            Las tiradas aparecerán aquí...
          </p>
        )}
        {events.map(ev => {
          const d = ev.data
          const visible = !ev.is_private || isDM
          if (!visible) return null
          return (
            <div key={ev.id} className="camp-feed-item" style={{ opacity: ev.is_private ? 0.75 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem' }}>{TYPE_ICON[d.type] ?? '🎲'}</span>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', color: 'var(--cs-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.character_name ?? '?'}
                  {ev.is_private && <span style={{ marginLeft: 4, fontSize: '0.6rem', color: '#9ca3af' }}>[privado]</span>}
                </span>
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 700, color: rollColor(ev), lineHeight: 1 }}>
                  {d.total}
                </span>
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginTop: 2, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--cs-text)' }}>{d.label}</span>
                {d.isCrit && <span style={{ color: 'var(--cs-gold)', fontWeight: 700 }}>¡CRÍTICO!</span>}
                {d.isMiss && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>PIFIA</span>}
                {d.d20 && !d.isCrit && !d.isMiss && <span>d20: {d.d20}</span>}
                {d.detail && <span style={{ opacity: 0.7 }}>{d.detail}</span>}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
