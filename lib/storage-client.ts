'use client'

/** Trigger an immediate browser download from PDF bytes (used right after save). */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Fetch a presigned URL and open the stored PDF (never regenerates). */
export async function downloadStoredPdf(id: string, type: 'invoice' | 'voucher'): Promise<void> {
  const res = await fetch(`/api/storage/presign?id=${encodeURIComponent(id)}&type=${type}`)
  const data = await res.json() as { url?: string; error?: string; removed?: boolean; removedAt?: string }
  if (!res.ok || data.error) {
    throw new Error(data.error ?? 'Download failed')
  }
  if (data.removed) {
    throw new Error(`File removed — storage was freed${data.removedAt ? ` on ${data.removedAt}` : ''}.`)
  }
  if (!data.url) throw new Error('No download URL returned')
  window.open(data.url, '_blank', 'noopener,noreferrer')
}

/** Trigger bulk ZIP download for selected storage files. */
export function downloadStorageZip(items: { id: string; type: 'invoice' | 'voucher' }[]) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = '/api/storage/bulk-download'
  form.target = '_blank'

  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = 'payload'
  input.value = JSON.stringify({ items })
  form.appendChild(input)

  document.body.appendChild(form)
  form.submit()
  form.remove()
}
