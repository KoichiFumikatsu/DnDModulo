'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const prevPath = useRef(pathname)

  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname

    const el = ref.current
    if (!el) return

    el.classList.remove('page-turning-enter')
    // Force reflow
    void el.offsetWidth
    el.classList.add('page-turning-enter')

    const cleanup = () => el.classList.remove('page-turning-enter')
    el.addEventListener('animationend', cleanup, { once: true })
    return () => el.removeEventListener('animationend', cleanup)
  }, [pathname])

  return (
    <div ref={ref} style={{ minHeight: '100%' }}>
      {children}
    </div>
  )
}
