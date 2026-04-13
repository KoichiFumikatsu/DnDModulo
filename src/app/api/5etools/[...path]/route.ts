import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_ROOT = path.join(process.cwd(), 'src/lib/5etools-v2.26.1/data')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  const filePath = path.join(DATA_ROOT, ...segments)

  // Security: ensure resolved path is still under DATA_ROOT
  if (!filePath.startsWith(DATA_ROOT)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
