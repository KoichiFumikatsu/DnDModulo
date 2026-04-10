'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Character, ClassResource, SpellSlot, CharacterClass, CustomStat } from '../types'

interface Props {
  character: Character
  classResources: ClassResource[]
  spellSlots: SpellSlot[]
  classes: CharacterClass[]
  customStats: CustomStat[]
}

function StatStepper({
  label,
  current,
  max,
  color = 'var(--accent)',
  onUpdate,
}: {
  label: string
  current: number
  max: number
  color?: string
  onUpdate: (val: number) => void
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0

  return (
    <div className="rounded-lg border p-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 rounded-full mb-3 overflow-hidden"
        style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdate(Math.max(0, current - 1))}
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-lg transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>
          −
        </button>
        <input
          type="number"
          value={current}
          min={0}
          max={max}
          onChange={e => onUpdate(Math.max(0, Math.min(max, parseInt(e.target.value) || 0)))}
          className="flex-1 text-center py-1 rounded border text-sm font-bold outline-none"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border)',
            color: 'var(--on-dark)',
          }}
        />
        <button
          onClick={() => onUpdate(Math.min(max, current + 1))}
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-lg transition-colors hover:opacity-80"
          style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>
          +
        </button>
      </div>
    </div>
  )
}

function HpBlock({ character }: { character: Character }) {
  const supabase = createClient()
  const [hp, setHp] = useState(character.hp_current)
  const [temp, setTemp] = useState(character.hp_temp)
  const [dmg, setDmg] = useState('')
  const [heal, setHeal] = useState('')

  async function applyDamage() {
    const val = parseInt(dmg)
    if (!val || val <= 0) return
    const newTemp = Math.max(0, temp - val)
    const remaining = val - temp
    const newHp = remaining > 0 ? Math.max(0, hp - remaining) : hp
    setTemp(newTemp)
    setHp(newHp)
    setDmg('')
    await supabase.from('characters').update({ hp_current: newHp, hp_temp: newTemp }).eq('id', character.id)
  }

  async function applyHeal() {
    const val = parseInt(heal)
    if (!val || val <= 0) return
    const newHp = Math.min(character.hp_max, hp + val)
    setHp(newHp)
    setHeal('')
    await supabase.from('characters').update({ hp_current: newHp }).eq('id', character.id)
  }

  async function updateHp(val: number) {
    setHp(val)
    await supabase.from('characters').update({ hp_current: val }).eq('id', character.id)
  }

  async function updateTemp(val: number) {
    setTemp(val)
    await supabase.from('characters').update({ hp_temp: val }).eq('id', character.id)
  }

  const pct = Math.max(0, Math.min(100, (hp / character.hp_max) * 100))
  const hpColor = pct > 50 ? 'var(--success)' : pct > 25 ? 'var(--accent-gold)' : 'var(--danger)'

  return (
    <div className="rounded-xl border p-4 col-span-2"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Puntos de Vida
        </span>
        <span className="text-2xl font-bold" style={{ color: hpColor }}>
          {hp} <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>/ {character.hp_max}</span>
        </span>
      </div>

      <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: hpColor }} />
      </div>

      {/* Quick damage / heal */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex gap-2">
          <input
            type="number"
            value={dmg}
            onChange={e => setDmg(e.target.value)}
            placeholder="Daño"
            min={1}
            className="flex-1 px-2 py-1.5 rounded border text-sm outline-none"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--on-dark)' }}
            onKeyDown={e => e.key === 'Enter' && applyDamage()}
          />
          <button onClick={applyDamage}
            className="px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--danger)', color: 'white' }}>
            Daño
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={heal}
            onChange={e => setHeal(e.target.value)}
            placeholder="Curar"
            min={1}
            className="flex-1 px-2 py-1.5 rounded border text-sm outline-none"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--on-dark)' }}
            onKeyDown={e => e.key === 'Enter' && applyHeal()}
          />
          <button onClick={applyHeal}
            className="px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--success)', color: 'white' }}>
            Curar
          </button>
        </div>
      </div>

      {/* Manual stepper */}
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>HP actual</div>
          <div className="flex items-center gap-1">
            <button onClick={() => updateHp(Math.max(0, hp - 1))}
              className="w-7 h-7 rounded text-sm font-bold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>−</button>
            <input type="number" value={hp} min={0} max={character.hp_max}
              onChange={e => updateHp(Math.max(0, Math.min(character.hp_max, parseInt(e.target.value) || 0)))}
              className="w-16 text-center py-1 rounded border text-sm font-bold outline-none"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--on-dark)' }} />
            <button onClick={() => updateHp(Math.min(character.hp_max, hp + 1))}
              className="w-7 h-7 rounded text-sm font-bold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>+</button>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>HP temporal</div>
          <div className="flex items-center gap-1">
            <button onClick={() => updateTemp(Math.max(0, temp - 1))}
              className="w-7 h-7 rounded text-sm font-bold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>−</button>
            <input type="number" value={temp} min={0}
              onChange={e => updateTemp(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 text-center py-1 rounded border text-sm font-bold outline-none"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: '#60a5fa' }} />
            <button onClick={() => updateTemp(temp + 1)}
              className="w-7 h-7 rounded text-sm font-bold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>+</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function QuickStats({ character, classResources, spellSlots, classes, customStats }: Props) {
  const supabase = createClient()

  async function updateResource(id: string, current: number) {
    await supabase.from('character_class_resources').update({ current }).eq('id', id)
  }

  async function updateSpellSlot(id: string, used: number) {
    await supabase.from('character_spell_slots').update({ slots_used: used }).eq('id', id)
  }

  async function updateCustomStat(id: string, val: number) {
    await supabase.from('character_custom_stats').update({ current_value: val }).eq('id', id)
  }

  const classMap = Object.fromEntries(classes.map(c => [c.id, c.class_name]))

  // Group spell slots by class
  const slotsByClass: Record<string, SpellSlot[]> = {}
  spellSlots.forEach(s => {
    if (s.slots_total > 0) {
      if (!slotsByClass[s.class_id]) slotsByClass[s.class_id] = []
      slotsByClass[s.class_id].push(s)
    }
  })

  return (
    <div className="space-y-6">
      {/* HP */}
      <div className="grid grid-cols-2 gap-3">
        <HpBlock character={character} />
      </div>

      {/* Class Resources */}
      {classResources.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--on-dark-muted)' }}>
            Recursos de clase
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {classResources.map(res => (
              <ResourceStepper
                key={res.id}
                resource={res}
                onUpdate={val => updateResource(res.id, val)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Spell Slots */}
      {Object.keys(slotsByClass).length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--on-dark-muted)' }}>
            Espacios de hechizo
          </h3>
          {Object.entries(slotsByClass).map(([classId, slots]) => (
            <div key={classId} className="mb-4">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--accent-gold)' }}>
                {classMap[classId]}
              </p>
              <div className="space-y-2">
                {slots.sort((a, b) => a.spell_level - b.spell_level).map(slot => (
                  <SpellSlotRow
                    key={slot.id}
                    slot={slot}
                    onUpdate={used => updateSpellSlot(slot.id, used)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Custom Stats */}
      {customStats.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--on-dark-muted)' }}>
            Stats personalizados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {customStats.map(stat => (
              stat.stat_type === 'counter' || stat.stat_type === 'tracker' ? (
                <StatStepper
                  key={stat.id}
                  label={stat.name}
                  current={stat.current_value ?? 0}
                  max={stat.max_value ?? 0}
                  color="var(--accent-gold)"
                  onUpdate={val => updateCustomStat(stat.id, val)}
                />
              ) : null
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ResourceStepper({ resource, onUpdate }: {
  resource: ClassResource
  onUpdate: (val: number) => void
}) {
  const [current, setCurrent] = useState(resource.current)

  function handle(val: number) {
    const clamped = Math.max(0, Math.min(resource.maximum, val))
    setCurrent(clamped)
    onUpdate(clamped)
  }

  const pct = resource.maximum > 0 ? (current / resource.maximum) * 100 : 0

  return (
    <div className="rounded-lg border p-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {resource.name}
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {current}/{resource.maximum}
        </span>
      </div>
      <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => handle(current - 1)}
          className="w-8 h-8 rounded font-bold text-lg"
          style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>−</button>
        <input type="number" value={current} min={0} max={resource.maximum}
          onChange={e => handle(parseInt(e.target.value) || 0)}
          className="flex-1 text-center py-1 rounded border text-sm font-bold outline-none"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--on-dark)' }} />
        <button onClick={() => handle(current + 1)}
          className="w-8 h-8 rounded font-bold text-lg"
          style={{ background: 'var(--bg-secondary)', color: 'var(--on-dark)' }}>+</button>
      </div>
      <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        Recupera en: {resource.reset_on === 'short_rest' ? 'descanso corto' : resource.reset_on === 'long_rest' ? 'descanso largo' : 'manual'}
      </div>
    </div>
  )
}

function SpellSlotRow({ slot, onUpdate }: {
  slot: SpellSlot
  onUpdate: (used: number) => void
}) {
  const [used, setUsed] = useState(slot.slots_used)
  const available = slot.slots_total - used

  function toggle(index: number) {
    const newUsed = index < used ? index : index + 1
    setUsed(newUsed)
    onUpdate(newUsed)
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{ background: 'var(--bg-secondary)' }}>
      <span className="text-xs font-medium w-16 flex-shrink-0" style={{ color: 'var(--on-dark-muted)' }}>
        Nv {slot.spell_level}
      </span>
      <div className="flex gap-1.5 flex-1">
        {Array.from({ length: slot.slots_total }).map((_, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="w-6 h-6 rounded-full border-2 transition-all"
            style={{
              borderColor: 'var(--accent)',
              background: i < used ? 'transparent' : 'var(--accent)',
            }}
          />
        ))}
      </div>
      <span className="text-xs" style={{ color: available > 0 ? 'var(--on-dark)' : 'var(--on-dark-muted)' }}>
        {available} disp.
      </span>
    </div>
  )
}
