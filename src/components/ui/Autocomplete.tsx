'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
  label?: string
}

export default function Autocomplete({ value, onChange, options, placeholder, label }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.length === 0
    ? []
    : options.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 10)

  // Sync si value cambia externamente
  useEffect(() => { setQuery(value) }, [value])

  // Cerrar al click fuera
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(opt: string) {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block', fontSize: '0.82rem', marginBottom: '0.35rem',
          fontFamily: 'var(--font-cinzel, serif)', letterSpacing: '0.05em',
          color: 'var(--cs-text, var(--ink))',
        }}>
          {label}
        </label>
      )}
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => query.length > 0 && setOpen(true)}
        className="ifield"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--parchment)', border: '1px solid var(--parchment-edge)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          maxHeight: 220, overflowY: 'auto',
          margin: 0, padding: 0, listStyle: 'none',
        }}>
          {filtered.map(opt => (
            <li
              key={opt}
              onMouseDown={() => select(opt)}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.95rem',
                color: 'var(--ink)',
                fontFamily: 'var(--font-crimson, serif)',
                borderBottom: '1px solid var(--parchment-dark)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--parchment-dark)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
