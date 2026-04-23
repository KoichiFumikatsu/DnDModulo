'use client'

import { useState, useEffect, useRef } from 'react'
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

export interface MapEffect {
  id: string
  name: string
  origin_col: number
  origin_row: number
  radius_cells: number
  color: string
  caster_user_id: string | null
  caster_token_id: string | null
  created_at: string
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
  initialEffects?: MapEffect[]
  onTokensChange?: (tokens: Token[]) => void
  speedByCharacter?: Record<string, number>
}

const METERS_PER_CELL = 2

function speedToCells(speedM: number): number {
  return Math.max(1, Math.floor(speedM / METERS_PER_CELL))
}

const TOKEN_COLORS = ['#8b1a1a', '#3a6fa8', '#2d7a4f', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#4b5563']
const EFFECT_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#ca8a04']

function metersToCells(m: number): number {
  return Math.max(1, Math.round(m / METERS_PER_CELL))
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function BattleGrid({
  campaignId, isDM, currentUserId,
  initialTokens, initialMapUrl, initialCols, initialRows,
  initialOffsetX = 0, initialOffsetY = 0, initialScale = 1,
  initialEffects = [],
  onTokensChange,
  speedByCharacter,
}: Props) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [dragTokenId, setDragTokenId] = useState<string | null>(null)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [effects, setEffects] = useState<MapEffect[]>(initialEffects)
  const [showEffectForm, setShowEffectForm] = useState(false)
  const [newEffect, setNewEffect] = useState<{ name: string; radiusM: number; color: string }>({ name: '', radiusM: 6, color: EFFECT_COLORS[0] })
  const prevInitialTokensRef = useRef(initialTokens)
  const prevInitialEffectsRef = useRef(initialEffects)

  // Sync external token changes (auto-token, other players' edits) when not dragging
  useEffect(() => {
    if (!dragTokenId && prevInitialTokensRef.current !== initialTokens) {
      prevInitialTokensRef.current = initialTokens
      setTokens(initialTokens)
    }
  }, [initialTokens, dragTokenId])

  useEffect(() => {
    if (prevInitialEffectsRef.current !== initialEffects) {
      prevInitialEffectsRef.current = initialEffects
      setEffects(initialEffects)
    }
  }, [initialEffects])

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
    updatedEffects?: MapEffect[],
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
      active_effects: updatedEffects ?? effects,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'campaign_id' })
    onTokensChange?.(updatedTokens)
  }

  function canRemoveEffect(fx: MapEffect): boolean {
    return isDM || fx.caster_user_id === currentUserId
  }

  function castEffectFromSelected() {
    if (!selectedToken) return
    const name = newEffect.name.trim() || 'Efecto'
    const radius = metersToCells(newEffect.radiusM)
    const fx: MapEffect = {
      id: crypto.randomUUID(),
      name,
      origin_col: selectedToken.col,
      origin_row: selectedToken.row,
      radius_cells: radius,
      color: newEffect.color,
      caster_user_id: selectedToken.owner_user_id ?? currentUserId,
      caster_token_id: selectedToken.id,
      created_at: new Date().toISOString(),
    }
    const updated = [...effects, fx]
    setEffects(updated)
    saveMapState(tokens, undefined, undefined, undefined, undefined, undefined, undefined, updated)
    setShowEffectForm(false)
    setNewEffect(p => ({ ...p, name: '' }))
  }

  function removeEffect(fxId: string) {
    const target = effects.find(f => f.id === fxId)
    if (!target || !canRemoveEffect(target)) return
    const updated = effects.filter(f => f.id !== fxId)
    setEffects(updated)
    saveMapState(tokens, undefined, undefined, undefined, undefined, undefined, undefined, updated)
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
    setSelectedTokenId(null)
  }

  function canSelect(token: Token): boolean {
    if (!token.character_id) return false
    return isDM || token.owner_user_id === currentUserId
  }

  function handleTokenClick(e: React.MouseEvent, token: Token) {
    if (!canSelect(token)) return
    e.stopPropagation()
    setSelectedTokenId(prev => prev === token.id ? null : token.id)
  }

  const selectedToken = selectedTokenId ? tokens.find(t => t.id === selectedTokenId) : null
  const selectedSpeedM = selectedToken?.character_id ? speedByCharacter?.[selectedToken.character_id] : undefined
  const selectedCells = selectedSpeedM ? speedToCells(selectedSpeedM) : 0

  // Manhattan distance: diagonals cost 2 (one horizontal + one vertical step),
  // matching Dofus-style grid movement. This yields a diamond-shaped reach.
  const reachableKeys = new Set<string>()
  if (selectedToken && selectedCells > 0) {
    for (let dc = -selectedCells; dc <= selectedCells; dc++) {
      for (let dr = -selectedCells; dr <= selectedCells; dr++) {
        if (dc === 0 && dr === 0) continue
        if (Math.abs(dc) + Math.abs(dr) > selectedCells) continue
        const c = selectedToken.col + dc
        const r = selectedToken.row + dr
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        reachableKeys.add(`${c},${r}`)
      }
    }
  }

  // Map of cell key → effect color (first matching effect wins when overlapping).
  // Same Manhattan shape as movement, so area effects are radial diamonds.
  const effectColorByCell = new Map<string, string>()
  for (const fx of effects) {
    for (let dc = -fx.radius_cells; dc <= fx.radius_cells; dc++) {
      for (let dr = -fx.radius_cells; dr <= fx.radius_cells; dr++) {
        if (Math.abs(dc) + Math.abs(dr) > fx.radius_cells) continue
        const c = fx.origin_col + dc
        const r = fx.origin_row + dr
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        const key = `${c},${r}`
        if (!effectColorByCell.has(key)) effectColorByCell.set(key, fx.color)
      }
    }
  }

  function moveSelectedTo(col: number, row: number) {
    if (!selectedToken) return
    const updated = tokens.map(t => t.id === selectedToken.id ? { ...t, col, row } : t)
    setTokens(updated)
    saveMapState(updated)
    setSelectedTokenId(null)
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
      {selectedToken && (
        <div style={{
          fontSize: '0.7rem',
          fontFamily: 'Cinzel, serif',
          color: 'var(--cs-gold)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}>
          {selectedCells > 0 && (
            <span>
              Movimiento: <strong style={{ color: 'var(--cs-accent)' }}>{selectedCells}</strong> casillas
              <span style={{ color: 'var(--cs-text-muted)' }}> ({selectedCells * METERS_PER_CELL} m · vel. {selectedSpeedM} m)</span>
            </span>
          )}
          <button onClick={() => setShowEffectForm(v => !v)}
            style={{ fontSize: '0.6rem', padding: '1px 10px', borderRadius: 8, border: '1px solid var(--cs-accent)', background: 'transparent', color: 'var(--cs-accent)', cursor: 'pointer' }}>
            {showEffectForm ? '▲ Efecto' : '+ Efecto'}
          </button>
          <button onClick={() => { setSelectedTokenId(null); setShowEffectForm(false) }}
            style={{ fontSize: '0.6rem', padding: '1px 8px', borderRadius: 8, border: '1px solid rgba(201,173,106,0.4)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer' }}>
            Deseleccionar
          </button>
        </div>
      )}
      {selectedToken && showEffectForm && (
        <div style={{
          display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap',
          padding: '0.5rem 0.6rem', border: '1px solid rgba(201,173,106,0.35)',
          background: 'rgba(201,173,106,0.06)', borderRadius: 6,
        }}>
          <input value={newEffect.name} onChange={e => setNewEffect(p => ({ ...p, name: e.target.value }))}
            placeholder="Nombre (ej: Bola de fuego)"
            className="ifield" style={{ fontSize: '0.72rem', flex: 1, minWidth: 140 }} />
          <label style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif' }}>Radio (m)</label>
          <input type="number" min={1} step={1} value={newEffect.radiusM}
            onChange={e => setNewEffect(p => ({ ...p, radiusM: Math.max(1, +e.target.value) }))}
            className="ifield" style={{ fontSize: '0.72rem', width: 56 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {EFFECT_COLORS.map(c => (
              <button key={c} onClick={() => setNewEffect(p => ({ ...p, color: c }))}
                style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newEffect.color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <button onClick={castEffectFromSelected}
            style={{ fontSize: '0.7rem', padding: '3px 12px', borderRadius: 10, border: '1px solid var(--cs-accent)', background: 'var(--cs-accent)', color: '#fff', cursor: 'pointer' }}>
            Lanzar
          </button>
        </div>
      )}
      {effects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', fontSize: '0.68rem' }}>
          {effects.map(fx => (
            <span key={fx.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '2px 8px', borderRadius: 10,
              background: hexWithAlpha(fx.color, 0.18),
              border: `1px solid ${hexWithAlpha(fx.color, 0.55)}`,
              fontFamily: 'Cinzel, serif', color: 'var(--cs-text)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: fx.color }} />
              {fx.name}
              <span style={{ color: 'var(--cs-text-muted)' }}>· {fx.radius_cells * METERS_PER_CELL}m</span>
              {canRemoveEffect(fx) && (
                <button onClick={() => removeEffect(fx.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--cs-text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', lineHeight: 1 }}>
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
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
            const cellKey = `${col},${row}`
            const isReachable = reachableKeys.has(cellKey)
            const isSelectedCell = selectedToken && selectedToken.col === col && selectedToken.row === row
            const effectColor = effectColorByCell.get(cellKey)
            const cellBg = isReachable
              ? 'rgba(90, 180, 120, 0.22)'
              : effectColor
                ? hexWithAlpha(effectColor, 0.22)
                : isSelectedCell
                  ? 'rgba(201, 173, 106, 0.22)'
                  : undefined
            const cellShadow = isReachable
              ? 'inset 0 0 0 1px rgba(90,180,120,0.45)'
              : effectColor
                ? `inset 0 0 0 1px ${hexWithAlpha(effectColor, 0.55)}`
                : undefined
            const canClickToMove = !!(selectedToken && isReachable && canDrag(selectedToken))
            return (
              <div
                key={i}
                style={{
                  ...cellStyle,
                  background: cellBg,
                  boxShadow: cellShadow,
                  cursor: canClickToMove ? 'pointer' : undefined,
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col, row)}
                onClick={canClickToMove ? () => moveSelectedTo(col, row) : undefined}
              >
                {tokenHere && (
                  <div
                    className="camp-token"
                    draggable={canDrag(tokenHere)}
                    onDragStart={e => canDrag(tokenHere) ? handleDragStart(e, tokenHere.id) : e.preventDefault()}
                    onClick={e => handleTokenClick(e, tokenHere)}
                    style={{
                      background: tokenHere.portrait_url
                        ? `url(${tokenHere.portrait_url}) center/cover`
                        : tokenHere.color,
                      cursor: canDrag(tokenHere)
                        ? 'grab'
                        : canSelect(tokenHere)
                          ? 'pointer'
                          : 'default',
                      outline: selectedTokenId === tokenHere.id ? '2px solid var(--cs-gold)' : undefined,
                      outlineOffset: selectedTokenId === tokenHere.id ? '1px' : undefined,
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
