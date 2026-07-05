/** Intrinsic pixel size of `public/invoice-empty.jpg` (width × height). */
export const INTRINSIC_BG_W = 2482
export const INTRINSIC_BG_H = 3510

/** Template overlay size used by `CustomInvoiceTemplate` (A4 pt-like px). */
export const TEMPLATE_W = 595.5
export const TEMPLATE_H = 842

// Default logo placement (overridden by form sliders; intrinsic background pixels)
export const LOGO_X = 108
export const LOGO_Y = 208
export const LOGO_W = 550
export const LOGO_H = 320

export const DEFAULT_LOGO_X = LOGO_X
export const DEFAULT_LOGO_Y = LOGO_Y
export const DEFAULT_LOGO_SIZE = 748

export const LOGO_SIZE_MIN = 150
export const LOGO_SIZE_MAX = 900

export const SIGNATURE_IMAGE_X = 1693
export const SIGNATURE_IMAGE_Y = 2920
export const SIGNATURE_IMAGE_W = 540
export const SIGNATURE_IMAGE_H = 240

export const SIGNATURE_NAME_X = 1701
export const SIGNATURE_NAME_Y = 3200
export const SIGNATURE_NAME_FONT_SIZE = 48

export const LOGO_MAX_BYTES = 150 * 1024

export interface ScaledRect {
  left: number
  top: number
  width: number
  height: number
}

export interface InvoiceBranding {
  logoUrl?: string | null
  signatureUrl?: string | null
  signaturePersonName?: string
  logoX?: number
  logoY?: number
  logoSize?: number
}

export function getLogoBoxSize(logoSize: number): { w: number; h: number } {
  const w = logoSize
  const h = Math.round(logoSize * (LOGO_H / LOGO_W))
  return { w, h }
}

export function resolveLogoRect(
  branding: Pick<InvoiceBranding, 'logoX' | 'logoY' | 'logoSize'>,
): { x: number; y: number; w: number; h: number } {
  const size = branding.logoSize ?? DEFAULT_LOGO_SIZE
  const { w, h } = getLogoBoxSize(size)
  return {
    x: branding.logoX ?? DEFAULT_LOGO_X,
    y: branding.logoY ?? DEFAULT_LOGO_Y,
    w,
    h,
  }
}

export function clampInvoiceLogoPosition(
  x: number,
  y: number,
  logoSize: number,
): { x: number; y: number } {
  const { w, h } = getLogoBoxSize(logoSize)
  const maxX = Math.max(0, INTRINSIC_BG_W - w)
  const maxY = Math.max(0, INTRINSIC_BG_H - h)
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

export function scaleX(value: number): number {
  return (value / INTRINSIC_BG_W) * TEMPLATE_W
}

export function scaleY(value: number): number {
  return (value / INTRINSIC_BG_H) * TEMPLATE_H
}

export function scaleRect(x: number, y: number, w: number, h: number): ScaledRect {
  return {
    left: scaleX(x),
    top: scaleY(y),
    width: scaleX(w),
    height: scaleY(h),
  }
}

export function scaleFontSize(intrinsicPx: number): number {
  return (intrinsicPx / INTRINSIC_BG_H) * TEMPLATE_H
}
