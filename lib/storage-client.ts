'use client'

export type PdfDownloadMethod = 'anchor' | 'opened' | 'shared' | 'navigated'

function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function revokeBlobUrlLater(url: string, ms = 120_000): void {
  window.setTimeout(() => URL.revokeObjectURL(url), ms)
}

function openPdfBlobUrl(url: string): PdfDownloadMethod {
  const opened = window.open(url, '_blank')
  if (opened) {
    revokeBlobUrlLater(url)
    return 'opened'
  }
  window.location.assign(url)
  revokeBlobUrlLater(url)
  return 'navigated'
}

async function sharePdfBlob(blob: Blob, filename: string): Promise<PdfDownloadMethod | null> {
  if (typeof navigator.share !== 'function' || typeof File === 'undefined') return null
  try {
    const file = new File([blob], filename, { type: 'application/pdf' })
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return null
    await navigator.share({ files: [file], title: filename })
    return 'shared'
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return 'shared'
    return null
  }
}

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

/**
 * Package calculator PDF download — iOS Safari ignores anchor downloads after async work.
 * Opens the PDF in Safari or the Share sheet so the user can save it.
 */
export async function downloadCalculatorPdf(
  bytes: Uint8Array,
  filename: string,
): Promise<PdfDownloadMethod> {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  if (isAppleMobile()) {
    const shared = await sharePdfBlob(blob, safeName)
    if (shared) {
      revokeBlobUrlLater(url)
      return shared
    }
    return openPdfBlobUrl(url)
  }

  downloadPdfBytes(bytes, safeName)
  return 'anchor'
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

export function pdfDownloadHint(method: PdfDownloadMethod): string | null {
  if (method === 'opened' || method === 'navigated') {
    return 'PDF opened — tap Share, then Save to Files.'
  }
  return null
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
