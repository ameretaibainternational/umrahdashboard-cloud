import type { InvoiceBranding } from '@/lib/custom-invoice-branding-layout'
import { resolveLogoRect, scaleRect } from '@/lib/custom-invoice-branding-layout'
import { applyInvoicePdfCloneStyles } from '@/lib/invoice-pdf-onclone'

function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
  if (imgs.length === 0) return Promise.resolve()
  return Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load invoice image'))
    })
  })).then(() => undefined)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, x, y, dw, dh)
}

export async function generateCustomInvoicePdfBytes(
  wrapper: HTMLElement,
  branding: InvoiceBranding,
  backgroundSrc = '/invoice-empty.jpg',
): Promise<Uint8Array> {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const pages = Array.from(wrapper.querySelectorAll('[data-invoice-root]')) as HTMLElement[]
  if (pages.length === 0) throw new Error('No invoice pages found')

  await waitForImages(wrapper)

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const origin = window.location.origin
  const SCALE = 2
  const PAGE_W = 595.5
  const PAGE_H = 842

  const bgImg = await loadImage(`${origin}${backgroundSrc.startsWith('/') ? backgroundSrc : `/${backgroundSrc}`}`)
  const logoImg = branding.logoUrl ? await loadImage(branding.logoUrl) : null

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage()

    const contentCanvas = await html2canvas(pages[i], {
      scale: SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      imageTimeout: 30000,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        applyInvoicePdfCloneStyles(clonedDoc)
      },
    })

    const composite = document.createElement('canvas')
    composite.width = Math.round(PAGE_W * SCALE)
    composite.height = Math.round(PAGE_H * SCALE)
    const ctx = composite.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bgImg, 0, 0, composite.width, composite.height)
    ctx.drawImage(contentCanvas, 0, 0)

    if (i === 0 && logoImg) {
      const { x, y, w, h } = resolveLogoRect(branding)
      const rect = scaleRect(x, y, w, h)
      drawImageContain(
        ctx,
        logoImg,
        rect.left * SCALE,
        rect.top * SCALE,
        rect.width * SCALE,
        rect.height * SCALE,
      )
    }

    pdf.addImage(composite.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297)
  }

  return new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer)
}
