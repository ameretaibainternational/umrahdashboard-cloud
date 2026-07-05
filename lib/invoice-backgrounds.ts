export interface InvoiceBackgroundOption {
  id: string
  name: string
  src: string
  /** CSS `background` for picker bubbles — colors/gradients only, not the full JPG. */
  swatch: string
}

/** Encode filename segments so paths with spaces work in CSS url() and fetch. */
export function invoiceBackgroundUrl(src: string): string {
  if (!src.includes(' ')) return src
  const idx = src.lastIndexOf('/')
  if (idx === -1) return encodeURIComponent(src)
  return `${src.slice(0, idx + 1)}${encodeURIComponent(src.slice(idx + 1))}`
}

/** Representative swatches derived from each background’s palette (not image thumbnails). */
const SWATCH_BY_NAME: Record<string, string> = {
  Classic: 'linear-gradient(145deg, #121117 0%, #2a2a35 100%)',
  'Berry Gradient': 'linear-gradient(145deg, #6b2d5c 0%, #c44569 55%, #e84393 100%)',
  'Beige Solid': '#e8dcc8',
  'Coral Gradient': 'linear-gradient(145deg, #ff6b6b 0%, #ff8e53 100%)',
  'Dark Charcoal': 'linear-gradient(145deg, #1a1a1a 0%, #3d3d3d 100%)',
  'Gold Gradient': 'linear-gradient(145deg, #6b4e1f 0%, #c9a227 50%, #f5e6a3 100%)',
  'Lime Gradient': 'linear-gradient(145deg, #7cb518 0%, #c6f055 100%)',
  'Midnight Blue': 'linear-gradient(145deg,rgb(0, 0, 0) 0%,rgb(36, 36, 100) 50%,rgb(0, 7, 92) 100%)',
  'Mint Gradient': 'linear-gradient(145deg, #84fab0 0%, #8fd3f4 100%)',
  'Ocean Gradient': 'linear-gradient(145deg, #2193b0 0%, #6dd5ed 100%)',
  'Pearl White': 'linear-gradient(145deg, #ffffff 0%, #e8e8e8 100%)',
  'Pink Gradient': 'linear-gradient(145deg,rgb(111, 89, 253) 0%,rgb(255, 101, 201) 100%)',
  'Purple Gradient': 'linear-gradient(145deg, #667eea 0%, #764ba2 100%)',
  'Silver Solid': 'linear-gradient(145deg, #bdc3c7 0%, #ecf0f1 100%)',
  'Sky Blue': 'linear-gradient(145deg,rgb(117, 86, 242) 0%,rgb(72, 206, 255) 100%)',
  'Steel Gradient': 'linear-gradient(145deg, #434343 0%, #757575 100%)',
  'Sunset Gradient': 'linear-gradient(145deg,rgb(124, 0, 207) 0%,rgb(255, 191, 0) 100%)',
}

function swatchForName(name: string): string {
  return SWATCH_BY_NAME[name] ?? 'linear-gradient(145deg, #888 0%, #ccc 100%)'
}

const COLORFUL_BG_FILES = [
  'Berry Gradient.jpg',
  'Beige Solid.jpg',
  'Coral Gradient.jpg',
  'Dark Charcoal.jpg',
  'Gold Gradient.jpg',
  'Lime Gradient.jpg',
  'Midnight Blue.jpg',
  'Mint Gradient.jpg',
  'Ocean Gradient.jpg',
  'Pearl White.jpg',
  'Pink Gradient.jpg',
  'Purple Gradient.jpg',
  'Silver Solid.jpg',
  'Sky Blue.jpg',
  'Steel Gradient.jpg',
  'Sunset Gradient.jpg',
] as const

function bgNameFromFile(file: string): string {
  return file.replace(/\.jpg$/i, '')
}

export const DEFAULT_INVOICE_TEXT_COLOR = '#fefefe'

export const LEGACY_INVOICE_BACKGROUNDS: InvoiceBackgroundOption[] = [
  { id: 'classic', name: 'Classic', src: '/invoice-empty.jpg', swatch: swatchForName('Classic') },
]

export const COLORFUL_INVOICE_BACKGROUNDS: InvoiceBackgroundOption[] = COLORFUL_BG_FILES.map(file => {
  const name = bgNameFromFile(file)
  return {
    id: file.replace(/\s+/g, '-').replace(/\.jpg$/i, '').toLowerCase(),
    name,
    src: `/invoice-bg/${file}`,
    swatch: swatchForName(name),
  }
})

export const INVOICE_BACKGROUNDS: InvoiceBackgroundOption[] = [
  ...LEGACY_INVOICE_BACKGROUNDS,
  ...COLORFUL_INVOICE_BACKGROUNDS,
]

export function getInvoiceBackgroundSwatch(src: string): string {
  const match = INVOICE_BACKGROUNDS.find(bg => bg.src === src)
  return match?.swatch ?? swatchForName('Classic')
}

export const DEFAULT_CUSTOM_INVOICE_BACKGROUND = '/invoice-empty.jpg'
export const DEFAULT_PACKAGE_INVOICE_BACKGROUND = DEFAULT_CUSTOM_INVOICE_BACKGROUND

export const INVOICE_TEXT_COLOR_PRESETS = [
  '#fefefe',
  '#ffffff',
  '#071426',
  '#1a1a1a',
  '#bd872b',
  '#2b4d8f',
] as const

/** Apply alpha (0–1) to a #rrggbb color. */
export function invoiceTextColorWithAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return hex
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
