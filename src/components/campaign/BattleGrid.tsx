'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseSpell, shapeCells, pickCardinal, type AoeShape, type Direction4, type ParsedSpell } from '@/lib/spells/parseArea'

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
  radius_cells: number        // legacy name; interpreted as sizeCells for the shape
  color: string
  caster_user_id: string | null
  caster_token_id: string | null
  created_at: string
  shape?: AoeShape            // defaults to 'circle' for legacy rows
  direction?: Direction4      // only relevant for cone/line
}

export interface CastableSpell {
  id: string
  name: string
  spell_level: number
  damage: string | null
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
  mySpells?: CastableSpell[]
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

interface CastMode {
  spell: CastableSpell
  parsed: ParsedSpell
  casterTokenId: string
  color: string
}

export default function BattleGrid({
  campaignId, isDM, currentUserId,
  initialTokens, initialMapUrl, initialCols, initialRows,
  initialOffsetX = 0, initialOffsetY = 0, initialScale = 1,
  initialEffects = [],
  onTokensChange,
  speedByCharacter,
  mySpells = [],
}: Props) {
  const [tokens, setTokens] = useState<Token[]>(initialTokens)
  const [dragTokenId, setDragTokenId] = useState<string | null>(null)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [effects, setEffects] = useState<MapEffect[]>(initialEffects)
  const [showEffectForm, setShowEffectForm] = useState(false)
  const [newEffect, setNewEffect] = useState<{ name: string; radiusM: number; color: string }>({ name: '', radiusM: 6, color: EFFECT_COLORS[0] })
  const [castMode, setCastMode] = useState<CastMode | null>(null)
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null)
  const [spellDetails, setSpellDetails] = useState<Record<string, { range?: string; description?: string | null }>>({})
  const [hoverSpellId, setHoverSpellId] = useState<string | null>(null)
  const [spellLoadingId, setSpellLoadingId] = useState<string | null>(null)
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
      shape: 'circle',
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

  const myToken = tokens.find(t => t.owner_user_id === currentUserId) ?? null

  async function beginCast(spell: CastableSpell) {
    if (!myToken) return
    let detail = spellDetails[spell.name]
    if (!detail) {
      setSpellLoadingId(spell.id)
      try {
        const res = await fetch(`/api/spell-info?name=${encodeURIComponent(spell.name)}`)
        if (res.ok) detail = await res.json()
      } catch { /* ignore, detail stays undefined */ }
      setSpellLoadingId(null)
      if (detail) setSpellDetails(prev => ({ ...prev, [spell.name]: detail! }))
    }
    const parsed = parseSpell(detail?.range, detail?.description)
    const color = EFFECT_COLORS[spell.spell_level % EFFECT_COLORS.length]
    setCastMode({ spell, parsed, casterTokenId: myToken.id, color })
    setSelectedTokenId(null)
    setShowEffectForm(false)
    setHoverCell(null)
  }

  function cancelCast() {
    setCastMode(null)
    setHoverCell(null)
  }

  function commitCast(targetCol: number, targetRow: number) {
    if (!castMode) return
    const caster = tokens.find(t => t.id === castMode.casterTokenId)
    if (!caster) return
    const { parsed, spell, color } = castMode
    // Target must be inside range (unless range is 0 = self)
    const dc = targetCol - caster.col
    const dr = targetRow - caster.row
    const dist = Math.abs(dc) + Math.abs(dr)
    if (parsed.rangeCells === 0) {
      // Self: target only used to pick direction for cone/line
    } else if (dist === 0 || dist > parsed.rangeCells) return

    let originCol = targetCol
    let originRow = targetRow
    let shape: AoeShape = parsed.aoe?.shape ?? 'circle'
    let sizeCells = parsed.aoe?.sizeCells ?? 1
    let direction: Direction4 | undefined

    if (parsed.rangeCells === 0) {
      // Self-origin spells: AoE is anchored at the caster.
      originCol = caster.col
      originRow = caster.row
      if (shape === 'cone' || shape === 'line') direction = pickCardinal(dc, dr)
    } else if (shape === 'cone' || shape === 'line') {
      originCol = caster.col
      originRow = caster.row
      direction = pickCardinal(dc, dr)
    } else if (!parsed.aoe) {
      // No AoE parsed → treat as a 1-cell marker at target.
      shape = 'circle'
      sizeCells = 0
    }

    const fx: MapEffect = {
      id: crypto.randomUUID(),
      name: spell.name,
      origin_col: originCol,
      origin_row: originRow,
      radius_cells: sizeCells,
      color,
      caster_user_id: currentUserId,
      caster_token_id: caster.id,
      created_at: new Date().toISOString(),
      shape,
      direction,
    }
    const updated = [...effects, fx]
    setEffects(updated)
    saveMapState(tokens, undefined, undefined, undefined, undefined, undefined, undefined, updated)
    setCastMode(null)
    setHoverCell(null)
  }

  useEffect(() => {
    if (!castMode) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') cancelCast() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [castMode])

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
    if (castMode) {
      const key = `${token.col},${token.row}`
      if (rangeKeys.has(key)) {
        e.stopPropagation()
        commitCast(token.col, token.row)
      }
      return
    }
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
  const effectColorByCell = new Map<string, string>()
  for (const fx of effects) {
    const shape = fx.shape ?? 'circle'
    const cells = shapeCells({
      shape,
      sizeCells: fx.radius_cells,
      originCol: fx.origin_col,
      originRow: fx.origin_row,
      direction: fx.direction,
    })
    // For 0-size circle, include the origin cell itself.
    if (shape === 'circle' && fx.radius_cells === 0) cells.add(`${fx.origin_col},${fx.origin_row}`)
    for (const key of cells) {
      const [c, r] = key.split(',').map(Number)
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue
      if (!effectColorByCell.has(key)) effectColorByCell.set(key, fx.color)
    }
  }

  // Cast mode overlays: range cells (pickable) and AoE preview on hover.
  const rangeKeys = new Set<string>()
  const previewKeys = new Set<string>()
  let castCaster: Token | null = null
  if (castMode) {
    castCaster = tokens.find(t => t.id === castMode.casterTokenId) ?? null
    if (castCaster) {
      const { parsed } = castMode
      if (parsed.rangeCells === 0) {
        // Self origin: all grid cells are selectable to pick a direction.
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
          if (c === castCaster.col && r === castCaster.row) continue
          rangeKeys.add(`${c},${r}`)
        }
      } else {
        for (let dc = -parsed.rangeCells; dc <= parsed.rangeCells; dc++) {
          for (let dr = -parsed.rangeCells; dr <= parsed.rangeCells; dr++) {
            if (Math.abs(dc) + Math.abs(dr) > parsed.rangeCells) continue
            if (dc === 0 && dr === 0) continue
            const c = castCaster.col + dc
            const r = castCaster.row + dr
            if (c < 0 || r < 0 || c >= cols || r >= rows) continue
            rangeKeys.add(`${c},${r}`)
          }
        }
      }
      if (hoverCell && rangeKeys.has(`${hoverCell.col},${hoverCell.row}`)) {
        const dc = hoverCell.col - castCaster.col
        const dr = hoverCell.row - castCaster.row
        const shape = parsed.aoe?.shape ?? 'circle'
        const size = parsed.aoe?.sizeCells ?? 0
        let originCol = hoverCell.col
        let originRow = hoverCell.row
        let direction: Direction4 | undefined
        if (parsed.rangeCells === 0) {
          originCol = castCaster.col
          originRow = castCaster.row
          if (shape === 'cone' || shape === 'line') direction = pickCardinal(dc, dr)
        } else if (shape === 'cone' || shape === 'line') {
          originCol = castCaster.col
          originRow = castCaster.row
          direction = pickCardinal(dc, dr)
        }
        const cells = size > 0
          ? shapeCells({ shape, sizeCells: size, originCol, originRow, direction })
          : new Set<string>([`${originCol},${originRow}`])
        for (const key of cells) {
          const [c, r] = key.split(',').map(Number)
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue
          previewKeys.add(key)
        }
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
      {mySpells.length > 0 && myToken && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--cs-text-muted)', fontFamily: 'Cinzel, serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hechizos</span>
          {mySpells.map(sp => {
            const detail = spellDetails[sp.name]
            const parsed = detail ? parseSpell(detail.range, detail.description) : null
            const isLoading = spellLoadingId === sp.id
            const isActive = castMode?.spell.id === sp.id
            return (
              <div key={sp.id} style={{ position: 'relative' }}
                onMouseEnter={() => setHoverSpellId(sp.id)}
                onMouseLeave={() => setHoverSpellId(prev => prev === sp.id ? null : prev)}>
                <button
                  onClick={() => isActive ? cancelCast() : beginCast(sp)}
                  disabled={isLoading}
                  style={{
                    fontFamily: 'Cinzel, serif', fontSize: '0.7rem',
                    padding: '3px 10px', borderRadius: 12,
                    border: `1px solid ${isActive ? 'var(--cs-accent)' : 'var(--cs-gold)'}`,
                    background: isActive ? 'var(--cs-accent)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--cs-gold)',
                    cursor: isLoading ? 'wait' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                  }}>
                  {sp.name}
                  <span style={{ marginLeft: 4, fontSize: '0.58rem', opacity: 0.7 }}>
                    {sp.spell_level === 0 ? 'cant' : `L${sp.spell_level}`}
                  </span>
                </button>
                {hoverSpellId === sp.id && detail && (
                  <div style={{
                    position: 'absolute', zIndex: 40, top: '100%', left: 0, marginTop: 4,
                    width: 280, padding: '0.6rem 0.75rem',
                    background: 'var(--cs-card)', border: '1px solid var(--cs-gold)', borderRadius: 6,
                    fontSize: '0.7rem', color: 'var(--cs-text)', fontFamily: 'var(--font-montaga)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                  }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: 'var(--cs-accent)', marginBottom: 4 }}>{sp.name}</div>
                    {detail.range && <div style={{ color: 'var(--cs-text-muted)', marginBottom: 4 }}>Rango: {detail.range}{parsed && parsed.rangeCells > 0 ? ` (${parsed.rangeCells * METERS_PER_CELL} m)` : ''}{parsed?.aoe ? ` · ${parsed.aoe.shape} ${parsed.aoe.sizeCells * METERS_PER_CELL}m` : ''}</div>}
                    <div style={{ maxHeight: 140, overflowY: 'auto', lineHeight: 1.4 }}>{detail.description ?? 'Sin descripción'}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {castMode && castCaster && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
          padding: '0.4rem 0.7rem', borderRadius: 6,
          border: `1px solid ${castMode.color}`,
          background: hexWithAlpha(castMode.color, 0.08),
          fontSize: '0.7rem', fontFamily: 'Cinzel, serif',
        }}>
          <span style={{ color: castMode.color, fontWeight: 700 }}>⚡ Lanzando: {castMode.spell.name}</span>
          <span style={{ color: 'var(--cs-text-muted)' }}>
            {castMode.parsed.rangeCells === 0 ? 'origen en sí mismo' : `rango ${castMode.parsed.rangeCells * METERS_PER_CELL} m`}
            {castMode.parsed.aoe && ` · ${castMode.parsed.aoe.shape} ${castMode.parsed.aoe.sizeCells * METERS_PER_CELL} m`}
          </span>
          <span style={{ color: 'var(--cs-text-muted)', fontSize: '0.62rem' }}>Click una casilla marcada · Esc para cancelar</span>
          <button onClick={cancelCast}
            style={{ fontSize: '0.6rem', padding: '1px 8px', borderRadius: 8, border: '1px solid rgba(201,173,106,0.4)', background: 'transparent', color: 'var(--cs-text-muted)', cursor: 'pointer', marginLeft: 'auto' }}>
            Cancelar
          </button>
        </div>
      )}
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
      }}
      onMouseLeave={() => setHoverCell(null)}>
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
            const isRange = rangeKeys.has(cellKey)
            const isPreview = previewKeys.has(cellKey)
            const castColor = castMode?.color
            const cellBg = isPreview && castColor
              ? hexWithAlpha(castColor, 0.35)
              : isRange && castColor
                ? hexWithAlpha(castColor, 0.12)
                : isReachable
                  ? 'rgba(90, 180, 120, 0.22)'
                  : effectColor
                    ? hexWithAlpha(effectColor, 0.22)
                    : isSelectedCell
                      ? 'rgba(201, 173, 106, 0.22)'
                      : undefined
            const cellShadow = isPreview && castColor
              ? `inset 0 0 0 1px ${hexWithAlpha(castColor, 0.75)}`
              : isRange && castColor
                ? `inset 0 0 0 1px ${hexWithAlpha(castColor, 0.35)}`
                : isReachable
                  ? 'inset 0 0 0 1px rgba(90,180,120,0.45)'
                  : effectColor
                    ? `inset 0 0 0 1px ${hexWithAlpha(effectColor, 0.55)}`
                    : undefined
            const canClickToMove = !!(selectedToken && isReachable && canDrag(selectedToken))
            const canClickToCast = !!(castMode && isRange)
            return (
              <div
                key={i}
                style={{
                  ...cellStyle,
                  background: cellBg,
                  boxShadow: cellShadow,
                  cursor: canClickToCast ? 'crosshair' : canClickToMove ? 'pointer' : undefined,
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col, row)}
                onMouseEnter={castMode ? () => setHoverCell({ col, row }) : undefined}
                onClick={
                  canClickToCast ? () => commitCast(col, row)
                  : canClickToMove ? () => moveSelectedTo(col, row)
                  : undefined
                }
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
