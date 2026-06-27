export const DEFAULT_COMPANY_LOGO_PATH = '/logo.png'

export function resolveCompanyLogoPath(logoUrl?: string | null): string {
  const trimmed = logoUrl?.trim()
  if (!trimmed) return DEFAULT_COMPANY_LOGO_PATH
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }
  return DEFAULT_COMPANY_LOGO_PATH
}

export function absoluteImageSrc(src: string): string {
  if (src.startsWith('http') || src.startsWith('data:') || typeof window === 'undefined') return src
  return `${window.location.origin}${src.startsWith('/') ? src : `/${src}`}`
}

/** Load logo as data URL so html2canvas always paints it (no network race). */
export async function preloadCompanyLogo(logoUrl?: string | null): Promise<string> {
  const primary = resolveCompanyLogoPath(logoUrl)
  try {
    return await loadImageAsDataUrl(primary)
  } catch {
    if (primary === DEFAULT_COMPANY_LOGO_PATH) {
      return absoluteImageSrc(DEFAULT_COMPANY_LOGO_PATH)
    }
    try {
      return await loadImageAsDataUrl(DEFAULT_COMPANY_LOGO_PATH)
    } catch {
      return absoluteImageSrc(DEFAULT_COMPANY_LOGO_PATH)
    }
  }
}

function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 1
        canvas.height = img.naturalHeight || 1
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(absoluteImageSrc(src))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(absoluteImageSrc(src))
      }
    }
    img.onerror = () => reject(new Error(`Failed to load logo: ${src}`))
    img.src = absoluteImageSrc(src)
  })
}

export function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
  if (imgs.length === 0) return Promise.resolve()
  return Promise.all(
    imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load invoice image'))
      })
    }),
  ).then(() => undefined)
}
