import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'no text' }, { status: 400 })

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`,
      { next: { revalidate: 86400 } }  // cache 24h
    )
    const data = await res.json()
    const translated = data.responseData?.translatedText
    if (!translated) throw new Error('no translation')
    return NextResponse.json({ translated })
  } catch {
    return NextResponse.json({ error: 'translation failed' }, { status: 500 })
  }
}
