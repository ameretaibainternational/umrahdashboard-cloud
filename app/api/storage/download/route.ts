import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { getPdfBuffer } from '@/lib/r2'
import { canAccessDocument, getApiCallerContext, requireApiUser } from '@/lib/api-auth'
import { isDirectDbConnectionError, markDirectDbAuthFailed } from '@/lib/sql'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const caller = await getApiCallerContext()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  const type = request.nextUrl.searchParams.get('type')

  if (!id || (type !== 'invoice' && type !== 'voucher' && type !== 'poster')) {
    return NextResponse.json({ error: 'Invalid id or type' }, { status: 400 })
  }

  if (isDemoMode()) {
    const row = type === 'invoice'
      ? demoStore.customInvoices.find(i => i.id === id)
      : type === 'voucher'
        ? demoStore.hotelVouchers.find(v => v.id === id)
        : demoStore.umrahPosters.find(p => p.id === id)

    if (!row) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    if (!canAccessDocument(caller.permission, row.created_by, caller.userId)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }
    if (row.file_deleted_at) {
      return NextResponse.json({ error: 'File removed' }, { status: 410 })
    }
    if (!row.storage_key) return NextResponse.json({ error: 'No stored file' }, { status: 404 })

    const buf = await getPdfBuffer(row.storage_key)
    const filename = type === 'invoice'
      ? `${(row as { invoice_number: string }).invoice_number}.pdf`
      : type === 'voucher'
        ? `${(row as { voucher_number: string }).voucher_number}.pdf`
        : `${(row as { poster_number: string }).poster_number}.jpg`
    const contentType = type === 'poster' ? 'image/jpeg' : 'application/pdf'

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }

  const { fetchFileForDownload } = await import('@/lib/document-db')
  let row: Awaited<ReturnType<typeof fetchFileForDownload>> | null = null
  try {
    row = await fetchFileForDownload(id, type)
  } catch (error) {
    if (!isDirectDbConnectionError(error)) throw error
    markDirectDbAuthFailed()
    const { fetchFileForDownloadSupabase } = await import('@/lib/supabase-document-db')
    row = await fetchFileForDownloadSupabase(id, type)
  }

  if (!row) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  if (!canAccessDocument(caller.permission, row.created_by, caller.userId)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }
  if (row.file_deleted_at) {
    return NextResponse.json({ error: 'File removed' }, { status: 410 })
  }
  if (!row.storage_key) return NextResponse.json({ error: 'No stored file' }, { status: 404 })

  const buf = await getPdfBuffer(row.storage_key)
  const ext = type === 'poster' ? 'jpg' : 'pdf'
  const contentType = type === 'poster' ? 'image/jpeg' : 'application/pdf'

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${row.number}.${ext}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
