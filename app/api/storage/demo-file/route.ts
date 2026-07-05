import { NextRequest, NextResponse } from 'next/server'
import { demoFileStore } from '@/lib/demo-file-store'
import { requireApiUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/is-demo'

export async function GET(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const auth = await requireApiUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const key = request.nextUrl.searchParams.get('key')
  const name = request.nextUrl.searchParams.get('name') ?? 'file.pdf'
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const buf = demoFileStore.get(key)
  if (!buf) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
