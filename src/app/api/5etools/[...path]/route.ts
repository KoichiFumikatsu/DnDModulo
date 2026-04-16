import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { getFiveToolsRuntimeInfo, resolveFiveToolsPath } from '@/lib/5etools/runtime'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  // Lightweight debug endpoint to check which runtime directory is active.
  if (segments[0] === '_meta' && segments[1] === 'runtime') {
    const runtime = getFiveToolsRuntimeInfo()
    return NextResponse.json({
      ok: Boolean(runtime.dataDir),
      dataDir: runtime.dataDir,
      configuredCandidates: runtime.configuredCandidates,
      resolvedCandidates: runtime.candidates,
      examples: [
        '/api/5etools/races.json',
        '/api/5etools/books.json',
        '/api/5etools/book/book-phb.json',
        '/api/5etools/adventures.json',
        '/api/5etools/adventure/adventure-cos.json',
      ],
    })
  }

  const resolved = resolveFiveToolsPath(segments)

  if (resolved.error === 'Forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!resolved.filePath) {
    return NextResponse.json({
      error: '5etools runtime data not found',
      hint: 'Set FIVETOOLS_DATA_DIR to the extracted 5etools data folder or root folder.',
      configuredCandidates: resolved.configuredCandidates,
      resolvedCandidates: resolved.candidates,
    }, { status: 404 })
  }

  try {
    const content = await fs.readFile(resolved.filePath, 'utf8')
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({
      error: 'Not found',
      dataDir: resolved.dataDir,
      requestedPath: segments.join('/'),
    }, { status: 404 })
  }
}
