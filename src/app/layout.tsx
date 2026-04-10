import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DnD Character Manager',
  description: 'Crea y gestiona tus personajes de D&D 5e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
