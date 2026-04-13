import type { Metadata } from 'next'
import { Cinzel, Crimson_Text, New_Rocker, Montaga } from 'next/font/google'
import './globals.css'

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '600', '700'],
  display: 'swap',
})

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  variable: '--font-crimson',
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const newRocker = New_Rocker({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-new-rocker',
  display: 'swap',
})

const montaga = Montaga({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-montaga',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Grimorio — DnD Character Manager',
  description: 'Crea y gestiona tus personajes de D&D 5e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full ${cinzel.variable} ${crimsonText.variable} ${newRocker.variable} ${montaga.variable}`}>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-crimson, 'Georgia', serif)" }}
      >
        {children}
      </body>
    </html>
  )
}
