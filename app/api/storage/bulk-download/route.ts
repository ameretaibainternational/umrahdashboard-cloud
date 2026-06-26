import { NextRequest, NextResponse } from 'next/server'
import { ZipArchive } from 'archiver'
import { PassThrough } from 'stream'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { getPdfBuffer } from '@/lib/r2'
import { getApiPermission, requireApiUser } from '@/lib/api-auth'
import type { StoredFileType } from '@/lib/types'

interface BulkItem {
  id: string
  type: StoredFileType
}

async function resolveFileDemo(item: BulkItem): Promise<{ name: string; buffer: Buffer } | null> {
  const row = item.type === 'invoice'
    ? demoStore.customInvoices.find(i => i.id === item.id)
    : demoStore.hotelVouchers.find(v => v.id === item.id)
  if (!row?.storage_key || row.file_deleted_at) return null
  const { demoFileStore } = await import('@/lib/demo-file-store')
  const buf = demoFileStore.get(row.storage_key)
  if (!buf) return null
  const name = item.type === 'invoice'
    ? `${(row as { invoice_number: string }).invoice_number}.pdf`
    : `${(row as { voucher_number: string }).voucher_number}.pdf`
  return { name, buffer: buf }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const perm = await getApiPermission()
  if (perm !== 'Full Access') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  let items: BulkItem[] = []
  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = await request.json() as { items?: BulkItem[] }
      items = body.items ?? []
    } else {
      const form = await request.formData()
      const raw = form.get('payload')
      if (typeof raw === 'string') items = (JSON.parse(raw) as { items: BulkItem[] }).items ?? []
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'No files selected' }, { status: 400 })
  }

  let files: { name: string; buffer: Buffer }[]

  if (isDemoMode()) {
    files = (await Promise.all(items.map(resolveFileDemo))).filter(Boolean) as { name: string; buffer: Buffer }[]
  } else {
    const { fetchFileForBulkDownload } = await import('@/lib/document-db')
    files = (await Promise.all(items.map(async item => {
      const hit = await fetchFileForBulkDownload(item.id, item.type)
      if (!hit) return null
      const buffer = await getPdfBuffer(hit.storage_key)
      return { name: hit.name, buffer }
    }))).filter(Boolean) as { name: string; buffer: Buffer }[]
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'No downloadable files found' }, { status: 404 })
  }

  const pass = new PassThrough()
  const archive = new ZipArchive({ zlib: { level: 6 } })
  archive.on('error', (err: Error) => pass.destroy(err))
  archive.pipe(pass)

  for (const file of files) {
    archive.append(file.buffer, { name: file.name })
  }
  void archive.finalize()

  const webStream = new ReadableStream({
    start(controller) {
      pass.on('data', chunk => controller.enqueue(chunk))
      pass.on('end', () => controller.close())
      pass.on('error', err => controller.error(err))
    },
  })

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="storage-backup.zip"',
      'Cache-Control': 'private, no-store',
    },
  })
}
