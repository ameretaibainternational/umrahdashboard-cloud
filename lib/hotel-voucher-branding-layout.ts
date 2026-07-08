/** Intrinsic pixel size of `public/Empty-Hotel-Voucher.jpg`. */
export const VOUCHER_INTRINSIC_BG_W = 2482
export const VOUCHER_INTRINSIC_BG_H = 3510

/** Template overlay size used by `HotelVoucherTemplate` pages. */
export const VOUCHER_TEMPLATE_W = 794
export const VOUCHER_TEMPLATE_H = 1123

// Default logo placement (overridden by form sliders; intrinsic background pixels)
export const VOUCHER_LOGO_X = 125
export const VOUCHER_LOGO_Y = 136
export const VOUCHER_LOGO_W = 550
export const VOUCHER_LOGO_H = 320

export const DEFAULT_VOUCHER_LOGO_X = VOUCHER_LOGO_X
export const DEFAULT_VOUCHER_LOGO_Y = VOUCHER_LOGO_Y
export const DEFAULT_VOUCHER_LOGO_SIZE = 783

export const VOUCHER_LOGO_SIZE_MIN = 150
export const VOUCHER_LOGO_SIZE_MAX = 900

export const VOUCHER_LOGO_MAX_BYTES = 150 * 1024

export interface VoucherBranding {
  logoUrl?: string | null
  logoX?: number
  logoY?: number
  logoSize?: number
}

export interface ScaledRect {
  left: number
  top: number
  width: number
  height: number
}

export function getVoucherLogoBoxSize(logoSize: number): { w: number; h: number } {
  const w = logoSize
  const h = Math.round(logoSize * (VOUCHER_LOGO_H / VOUCHER_LOGO_W))
  return { w, h }
}

export function resolveVoucherLogoRect(
  branding: Pick<VoucherBranding, 'logoX' | 'logoY' | 'logoSize'>,
): { x: number; y: number; w: number; h: number } {
  const size = branding.logoSize ?? DEFAULT_VOUCHER_LOGO_SIZE
  const { w, h } = getVoucherLogoBoxSize(size)
  return {
    x: branding.logoX ?? DEFAULT_VOUCHER_LOGO_X,
    y: branding.logoY ?? DEFAULT_VOUCHER_LOGO_Y,
    w,
    h,
  }
}

export function clampVoucherLogoPosition(
  x: number,
  y: number,
  logoSize: number,
): { x: number; y: number } {
  const { w, h } = getVoucherLogoBoxSize(logoSize)
  const maxX = Math.max(0, VOUCHER_INTRINSIC_BG_W - w)
  const maxY = Math.max(0, VOUCHER_INTRINSIC_BG_H - h)
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

export function scaleVoucherX(value: number): number {
  return (value / VOUCHER_INTRINSIC_BG_W) * VOUCHER_TEMPLATE_W
}

export function scaleVoucherY(value: number): number {
  return (value / VOUCHER_INTRINSIC_BG_H) * VOUCHER_TEMPLATE_H
}

export function scaleVoucherRect(x: number, y: number, w: number, h: number): ScaledRect {
  return {
    left: scaleVoucherX(x),
    top: scaleVoucherY(y),
    width: scaleVoucherX(w),
    height: scaleVoucherY(h),
  }
}
