import { NextRequest, NextResponse } from 'next/server'

const MAX_CHUNK = 480

function splitChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text]

  const chunks: string[] = []
  // Split on sentence boundaries first
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length <= MAX_CHUNK) {
      current += sentence
    } else {
      if (current) chunks.push(current.trim())
      // If a single sentence is too long, split on commas/semicolons
      if (sentence.length > MAX_CHUNK) {
        const subparts = sentence.match(/[^,;]+[,;]?/g) ?? [sentence]
        let sub = ''
        for (const part of subparts) {
          if ((sub + part).length <= MAX_CHUNK) {
            sub += part
          } else {
            if (sub) chunks.push(sub.trim())
            sub = part
          }
        }
        if (sub) current = sub
        else current = ''
      } else {
        current = sentence
      }
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

async function translateChunk(text: string): Promise<string> {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`,
    { next: { revalidate: 86400 } }
  )
  const data = await res.json()
  const translated = data.responseData?.translatedText
  if (!translated || translated.includes('QUERY LENGTH LIMIT')) throw new Error('failed')
  return translated
}

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'no text' }, { status: 400 })

  try {
    const chunks = splitChunks(text)
    const results = await Promise.all(chunks.map(translateChunk))
    return NextResponse.json({ translated: results.join(' ') })
  } catch {
    return NextResponse.json({ error: 'translation failed' }, { status: 500 })
  }
}
