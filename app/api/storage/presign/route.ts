import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { getPresignedDownloadUrl } from '@/lib/r2'
import { canAccessDocument, getApiCallerContext, requireApiUser } from '@/lib/api-auth'
import { isDirectDbConnectionError, markDirectDbAuthFailed } from '@/lib/sql'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const caller = await getApiCallerContext()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  const type = request.nextUrl.searchParams.get('type')

  if (!id || (type !== 'invoice' && type !== 'voucher')) {
    return NextResponse.json({ error: 'Invalid id or type' }, { status: 400 })
  }

  if (isDemoMode()) {
    const row = type === 'invoice'
      ? demoStore.customInvoices.find(i => i.id === id)
      : demoStore.hotelVouchers.find(v => v.id === id)

    if (!row) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    if (!canAccessDocument(caller.permission, row.created_by, caller.userId)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }
    if (row.file_deleted_at) {
      return NextResponse.json({
        error: 'File removed to save space',
        removed: true,
        removedAt: row.file_deleted_at.split('T')[0],
      }, { status: 410 })
    }
    if (!row.storage_key) return NextResponse.json({ error: 'No stored file for this record' }, { status: 404 })

    const filename = type === 'invoice'
      ? `${(row as { invoice_number: string }).invoice_number}.pdf`
      : `${(row as { voucher_number: string }).voucher_number}.pdf`

    const url = await getPresignedDownloadUrl(row.storage_key, filename)
    return NextResponse.json({ url })
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
    return NextResponse.json({
      error: 'File removed to save space',
      removed: true,
      removedAt: String(row.file_deleted_at).split('T')[0],
    }, { status: 410 })
  }
  if (!row.storage_key) return NextResponse.json({ error: 'No stored file for this record' }, { status: 404 })

  const url = await getPresignedDownloadUrl(row.storage_key, `${row.number}.pdf`)
  return NextResponse.json({ url })
}
