'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Token {
  id: string
  label: string
  color: string
  col: number
  row: number
  portrait_url?: string | null
  character_id?: string | null
  owner_user_id?: string | null
}

interface Props {
  campaignId: string
  isDM: boolean
  currentUserId: string
  initialTokens: Token[]
  initialMapUrl: string | null
  initialCols: number
  initialRows: number
  initialOffsetX?: number
  initialOffsetY?: number
  initialScale?: number
  onTokensChange?: (tokens: Token[]) => void
}

const TOKEN_COLORS = ['#8b1a1a', '#3a6fa8', '#2d7a4f', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#4b5563']

export default function BattleGrid({
  campaignId, isDM, currentUserId,
  initialTokens, initialMapUrl, initialCols, initialRows,
  initialOffsetX = 0, initialOffsetY = 0, initialScale = 1,
  onTokensChange,
}: Props) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [mapUrl, setMapUrl] = useState(initialMapUrl ?? '')
  const [cols, setCols] = useState(initialCols)
  const [rows, setRows] = useState(initialRows)
  const [mapOffsetX, setMapOffsetX] = useState(initialOffsetX)
  const [mapOffsetY, setMapOffsetY] = useState(initialOffsetY)
  const [mapScale, setMapScale] = useState(initialScale)
  const [mapInput, setMapInput] = useState(initialMapUrl ?? '')
  const [showDMControls, setShowDMControls] = useState(false)
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newTokenColor, setNewTokenColor] = useState(TOKEN_COLORS[0])
  const [dragTokenId, setDragTokenId] = useState<string | null>(null)
  const supabase = createClient()

  const CELL_SIZE = 48

  async function saveMapState(
    updatedTokens: Token[],
    updatedMapUrl?: string,
    updatedCols?: number,
    updatedRows?: number,
    updatedOffsetX?: number,
    updatedOffsetY?: number,
    updatedScale?: number,
  ) {
    await supabase.from('campaign_map_state').upsert({
      campaign_id: campaignId,
      map_image_url: updatedMapUrl ?? mapUrl,
      grid_cols: updatedCols ?? cols,
      grid_rows: updatedRows ?? rows,
      tokens: updatedTokens,
      map_offset_x: updatedOffsetX ?? mapOffsetX,
      map_offset_y: updatedOffsetY ?? mapOffsetY,
      map_scale: updatedScale ?? mapScale,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'campaign_id' })
    onTokensChange?.(updatedTokens)
  }

  function canDrag(token: Token) {
    if (isDM) return true
    return token.owner_user_id === currentUserId
  }

  function handleDragStart(e: React.DragEvent, tokenId: string) {
    setDragTokenId(tokenId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, col: number, row: number) {
    e.preventDefault()
    if (!dragTokenId) return
    const updated = tokens.map(t => t.id === dragTokenId ? { ...t, col, row } : t)
    setTokens(updated)
    saveMapState(updated)
    setDragTokenId(null)
  }

  function addToken() {
    if (!newTokenLabel.trim()) return
    const t: Token = {
      id: crypto.randomUUID(),
      label: newTokenLabel.trim().slice(0, 3).toUpperCase(),
      color: newTokenColor,
      col: 0, row: 0,
      owner_user_id: null,
    }
    const updated = [...tokens, t]
    setTokens(updated)
    saveMapState(updated)
    setNewTokenLabel('')
  }

  function removeToken(id: string) {
    const updated = tokens.filter(t => t.id !== id)
    setTokens(updated)
    saveMapState(updated)
  }

  function applyMapSettings() {
    setMapUrl(mapInput)
    saveMapState(tokens, mapInput, cols, rows, mapOffsetX, mapOffsetY, mapScale)
  }

  const cellStyle: React.CSSProperties = {
    width: CELL_SIZE, height: CELL_SIZE,
    border: '1px solid rgba(201,173,106,0.25)',
    position: 'relative',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%' }}>
      {/* Grid */}
      <div style={{
        position: 'relative',
        width: cols * CELL_SIZE,
        height: rows * CELL_SIZE,
        maxWidth: '100%',
        overflow: 'auto',
        flexShrink: 0,
        backgroundImage: mapUrl ? `url(${mapUrl})` : 'none',
        backgroundSize: mapUrl ? `${Math.round(mapScale * 100)}%` : 'cover',
        backgroundPosition: mapUrl ? `${mapOffsetX}px ${mapOffsetY}px` : 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: mapUrl ? undefined : 'rgba(0,0,0,0.15)',
        border: '1px solid var(--cs-gold)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
        }}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const tokenHere = tokens.find(t => t.col === col && t.row === row)
            return (
              <div
                key={i}
                style={cellStyle}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col, row)}
              >
                {tokenHere && (
                  <div
                    className="camp-token"
                    draggable={canDrag(tokenHere)}
                    onDragStart={e => canDrag(tokenHere) ? handleDragStart(e, tokenHere.id) : e.preventDefault()}
                    style={{
                      background: tokenHere.portrait_url
                        ? `url(${tokenHere.portrait_url}) center/cover`
                        : tokenHere.color,
                      cursor: canDrag(tokenHere) ? 'grab' : 'default',
                    }}
                    title={tokenHere.label}
                  >
                    {!tokenHere.portrait_url && tokenHere.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* DM Controls toggle */}
      {isDM && (
        <div>
          <button onClick={() => setShowDMControls(v => !v)}
            style={{ fontSize: '0.65rem', padding: '2px 10px', borderRadius: 10, border: '1px dashed rgba(201,173,106,0.5)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer' }}>
            {showDMControls ? '▲ Ocultar controles' : '▼ Controles DM'}
          </button>

          {showDMControls && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.75rem', border: '1px solid rgba(201,173,106,0.3)', background: 'rgba(201,173,106,0.05)' }}>

              {/* Map URL */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={mapInput} onChange={e => setMapInput(e.target.value)}
                  placeholder="URL del mapa..."
                  className="ifield"
                  style={{ fontSize: '0.75rem', flex: 1, minWidth: 160 }} />
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>Cols</label>
                  <input type="number" value={cols} onChange={e => setCols(Math.max(5, Math.min(40, +e.target.value)))}
                    className="ifield" style={{ fontSize: '0.75rem', width: 52 }} />
                  <label style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>Filas</label>
                  <input type="number" value={rows} onChange={e => setRows(Math.max(5, Math.min(30, +e.target.value)))}
                    className="ifield" style={{ fontSize: '0.75rem', width: 52 }} />
                </div>
              </div>

              {/* Map pan / scale */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', whiteSpace: 'nowrap' }}>Escala</label>
                <input type="range" min={0.25} max={4} step={0.05} value={mapScale}
                  onChange={e => setMapScale(+e.target.value)}
                  style={{ flex: 1, minWidth: 80, accentColor: 'var(--cs-gold)' }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--cs-gold)', fontFamily: 'Cinzel, serif', minWidth: 36 }}>{Math.round(mapScale * 100)}%</span>
                <button onClick={() => setMapScale(1)}
                  style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 6, border: '1px solid rgba(201,173,106,0.4)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer' }}>
                  ×1
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>Pos X</label>
                <input type="number" value={mapOffsetX} onChange={e => setMapOffsetX(+e.target.value)}
                  className="ifield" style={{ fontSize: '0.75rem', width: 64 }} />
                <label style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>Y</label>
                <input type="number" value={mapOffsetY} onChange={e => setMapOffsetY(+e.target.value)}
                  className="ifield" style={{ fontSize: '0.75rem', width: 64 }} />
                <button onClick={() => { setMapOffsetX(0); setMapOffsetY(0) }}
                  style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 6, border: '1px solid rgba(201,173,106,0.4)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer' }}>
                  Reset
                </button>
              </div>

              <button onClick={applyMapSettings}
                style={{ fontSize: '0.7rem', padding: '3px 12px', borderRadius: 10, border: '1px solid var(--cs-gold)', background: 'transparent', color: 'var(--cs-gold)', cursor: 'pointer', alignSelf: 'flex-start' }}>
                Aplicar mapa
              </button>

              {/* Add token */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={newTokenLabel} onChange={e => setNewTokenLabel(e.target.value)}
                  placeholder="Nombre token (3 letras)"
                  className="ifield"
                  style={{ fontSize: '0.75rem', flex: 1, minWidth: 140 }}
                  maxLength={3} />
                <div style={{ display: 'flex', gap: 4 }}>
                  {TOKEN_COLORS.map(c => (
                    <button key={c} onClick={() => setNewTokenColor(c)}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: newTokenColor === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                  ))}
                </div>
                <button onClick={addToken}
                  style={{ fontSize: '0.7rem', padding: '3px 12px', borderRadius: 10, border: '1px solid var(--cs-accent)', background: 'var(--cs-accent)', color: '#fff', cursor: 'pointer' }}>
                  + Token
                </button>
              </div>

              {/* Token list */}
              {tokens.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {tokens.map(t => (
                    <span key={t.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 10, fontSize: '0.65rem',
                      background: t.color, color: '#fff', fontFamily: 'Cinzel, serif', fontWeight: 700,
                    }}>
                      {t.label}
                      <button onClick={() => removeToken(t.id)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0, fontSize: '0.65rem', lineHeight: 1 }}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
