'use client'

import { useEffect, useMemo, useState } from 'react'
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

const PAGE_SIZE = 10
const TZ = 'America/Bogota'

function rollColor(e: FeedEvent) {
  const d = e.data
  if (d.isCrit) return 'var(--cs-gold)'
  if (d.isMiss) return 'var(--danger)'
  return 'var(--cs-accent)'
}

// Current date in Bogota as YYYY-MM-DD (for <input type="date"> value)
function todayBogota(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value
  return `${y}-${m}-${d}`
}

// Given YYYY-MM-DD (Bogota local day), return ISO start/end in UTC
function dayRangeUtc(dateStr: string): { startIso: string; endIso: string } {
  // Bogota is UTC-5 (no DST). Day starts at 00:00 -05:00, ends at 23:59:59.999 -05:00
  const startIso = new Date(`${dateStr}T00:00:00-05:00`).toISOString()
  const endIso = new Date(`${dateStr}T23:59:59.999-05:00`).toISOString()
  return { startIso, endIso }
}

function formatBogota(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

export default function EventFeed({ campaignId, isDM }: Props) {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [filterDate, setFilterDate] = useState<string>(() => todayBogota())
  const [page, setPage] = useState(0)
  const supabase = createClient()

  // Load events for selected day
  useEffect(() => {
    const { startIso, endIso } = dayRangeUtc(filterDate)
    supabase
      .from('campaign_events')
      .select('*')
      .eq('campaign_id', campaignId)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setEvents(data as FeedEvent[])
        setPage(0)
      })
  }, [campaignId, filterDate])  // eslint-disable-line

  // Realtime subscription — only prepend if the new event falls inside the filter window
  useEffect(() => {
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
        const { startIso, endIso } = dayRangeUtc(filterDate)
        if (ev.created_at < startIso || ev.created_at > endIso) return
        setEvents(prev => [ev, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [campaignId, isDM, filterDate])  // eslint-disable-line

  const visibleEvents = useMemo(
    () => events.filter(ev => !ev.is_private || isDM),
    [events, isDM]
  )

  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageEvents = visibleEvents.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  function prevPage() { setPage(p => Math.max(0, p - 1)) }
  function nextPage() { setPage(p => Math.min(totalPages - 1, p + 1)) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', flexShrink: 0 }}>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value || todayBogota())}
          max={todayBogota()}
          style={{
            fontSize: '0.7rem', padding: '2px 6px', fontFamily: 'Cinzel, serif',
            background: 'var(--cs-card)', color: 'var(--cs-text)',
            border: '1px solid rgba(201,173,106,0.4)', borderRadius: 4,
          }}
        />
        <button
          onClick={() => setFilterDate(todayBogota())}
          style={{
            fontSize: '0.62rem', padding: '2px 8px', borderRadius: 10,
            border: '1px solid rgba(201,173,106,0.4)', background: 'transparent',
            color: 'var(--cs-gold)', cursor: 'pointer', fontFamily: 'Cinzel, serif',
          }}
        >
          Hoy
        </button>
      </div>

      {/* Feed — fixed area, internally scrollable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: 4 }}>
        {visibleEvents.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', textAlign: 'center', marginTop: '2rem' }}>
            Sin tiradas para esta fecha.
          </p>
        )}
        {pageEvents.map(ev => {
          const d = ev.data
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
              <div style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'var(--font-montaga)', marginTop: 2, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--cs-text)' }}>{d.label}</span>
                {d.isCrit && <span style={{ color: 'var(--cs-gold)', fontWeight: 700 }}>¡CRÍTICO!</span>}
                {d.isMiss && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>PIFIA</span>}
                {d.d20 !== undefined && !d.isCrit && !d.isMiss && <span>d20: {d.d20}</span>}
                {d.detail && <span style={{ opacity: 0.7 }}>{d.detail}</span>}
                <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{formatBogota(ev.created_at)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {visibleEvents.length > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', flexShrink: 0, fontSize: '0.65rem', fontFamily: 'Cinzel, serif' }}>
          <button
            onClick={prevPage}
            disabled={safePage === 0}
            style={{
              padding: '2px 10px', borderRadius: 10,
              border: '1px solid rgba(201,173,106,0.4)', background: 'transparent',
              color: safePage === 0 ? 'var(--cs-text-muted)' : 'var(--cs-gold)',
              cursor: safePage === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'Cinzel, serif', fontSize: '0.65rem',
            }}
          >
            ← Anterior
          </button>
          <span style={{ color: 'var(--cs-text-muted)' }}>
            {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={safePage >= totalPages - 1}
            style={{
              padding: '2px 10px', borderRadius: 10,
              border: '1px solid rgba(201,173,106,0.4)', background: 'transparent',
              color: safePage >= totalPages - 1 ? 'var(--cs-text-muted)' : 'var(--cs-gold)',
              cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'Cinzel, serif', fontSize: '0.65rem',
            }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
