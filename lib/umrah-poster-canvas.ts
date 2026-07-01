/** Umrah package poster — canvas rendering (1587 × 2245 px, 1 cm = 37.78 px). */

import {
  DEFAULT_POSTER_LOGO_SIZE,
  DEFAULT_POSTER_LOGO_X,
  DEFAULT_POSTER_LOGO_Y,
  drawPosterCorner,
  drawPosterLogoContain,
  loadPosterCorner,
  loadPosterLogo,
  type PosterBranding,
} from '@/lib/umrah-poster-branding-layout'

export const CM_TO_PX = 37.78
export const POSTER_W = 1587
export const POSTER_H = 2245
export const BASE_IMAGE_SRC = '/Umrah Package-empty.jpg'

const GRADIENT_START = '#2b4d8f'
const GRADIENT_END = '#10143d'
const GOLD = '#bd872b'

export interface UmrahPosterFormData {
  blessedLine: string
  cityName: string
  daysDeparture: string
  makkahHotelName: string
  makkahHotelDetails: string
  madinaHotelName: string
  madinaHotelDetails: string
  ziyarat: string
  price: string
  sharingPrice: string
  quadPrice: string
  triplePrice: string
  doublePrice: string
  savingPrice: string
  bookBeforeDate: string
  contactNumber: string
  websiteUrl: string
}

export const BOOK_BEFORE_PREFIX = 'Book Before'

export const DEFAULT_POSTER_DATA: UmrahPosterFormData = {
  blessedLine: '03 BLESSED UMRAHS WITH ZIYARATS',
  cityName: 'ISLAMABAD',
  daysDeparture: '15 Days | Departs 15 March 2026',
  makkahHotelName: 'Hiba Hijra 6 or Similar',
  makkahHotelDetails: '( Nights 12 | 1500 Meter + Shuttle Service )',
  madinaHotelName: 'Anwar Al Madinah Mövenpick',
  madinaHotelDetails: '( Haram View )',
  ziyarat: ' Makkah & Madinah Ziyarat Included',
  price: '185,000',
  sharingPrice: '185,000',
  quadPrice: '195,000',
  triplePrice: '210,000',
  doublePrice: '235,000',
  savingPrice: 'PKR: 15,000',
  bookBeforeDate: '10 March 2026',
  contactNumber: '+92 300 0000000',
  websiteUrl: 'www.ameretaiba.com',
}

export function cm(value: number): number {
  return value * CM_TO_PX
}

function getCityNameY(): number {
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return cm(10.0)
  }
  return cm(10.15)
}

/** Load Poppins weights used on the poster. */
export async function loadPosterFonts(): Promise<void> {
  const poppinsLoads = [
    '500 22px Poppins',
    '700 22px Poppins',
    '500 25px Poppins',
    '700 25px Poppins',
    '700 27.8px Poppins',
    '500 32px Poppins',
    '700 32px Poppins',
    '700 34px Poppins',
    '700 33px Poppins',
    '700 40px Poppins',
    '700 42px Poppins',
    '700 46px Poppins',
    '700 47px Poppins',
    '700 36px Poppins',
    '800 140px Poppins',
  ]
  await Promise.all(poppinsLoads.map(f => document.fonts.load(f)))
  await document.fonts.ready
}

export function drawGradientText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  gradientColors: [string, string] = [GRADIENT_START, GRADIENT_END],
): void {
  ctx.save()
  ctx.font = font
  ctx.textBaseline = 'top'
  const w = ctx.measureText(text).width
  const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(font)
  const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 22
  const h = fontSize * 1.2
  const grad = ctx.createLinearGradient(x, y, x + Math.max(w, 1), y + h)
  grad.addColorStop(0, gradientColors[0])
  grad.addColorStop(1, gradientColors[1])
  ctx.fillStyle = grad
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function drawMixedWeightText(
  ctx: CanvasRenderingContext2D,
  boldPart: string,
  mediumPart: string,
  x: number,
  y: number,
  fontSize: number,
  align: 'left' | 'center' = 'left',
  centerX?: number,
): void {
  const boldFont = `700 ${fontSize}px Poppins, sans-serif`
  const mediumFont = `500 ${fontSize}px Poppins, sans-serif`
  ctx.textBaseline = 'top'
  ctx.font = boldFont
  const boldWidth = ctx.measureText(boldPart).width
  ctx.font = mediumFont
  const mediumWidth = ctx.measureText(mediumPart).width
  const totalWidth = boldWidth + mediumWidth
  const startX = align === 'center' && centerX !== undefined
    ? centerX - totalWidth / 2
    : x
  drawGradientText(ctx, boldPart, startX, y, boldFont)
  drawGradientText(ctx, mediumPart, startX + boldWidth, y, mediumFont)
}

/** Ensure exactly one leading space; empty if no visible text. */
export function withLeadingSpace(value: string): string {
  if (!value.trim()) return ''
  return value.startsWith(' ') ? value : ` ${value}`
}

/** Split text into lines of at most maxChars characters (spaces included, not trimmed). */
export function wrapTextByCharLimit(text: string, maxChars: number): string[] {
  if (!text || maxChars <= 0) return []
  const lines: string[] = []
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars))
  }
  return lines
}

function drawCenteredGradientText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  font: string,
): void {
  ctx.font = font
  const w = ctx.measureText(text).width
  drawGradientText(ctx, text, centerX - w / 2, y, font)
}

/** Bold label + name on line 1; details on one line below, centered to the name block. */
function drawHotelEntry(
  ctx: CanvasRenderingContext2D,
  label: string,
  name: string,
  details: string,
  startY: number,
  fontSize: number,
  centerX: number,
  maxNameChars: number,
): void {
  const lineHeight = fontSize * 1.35
  const mediumFont = `500 ${fontSize}px Poppins, sans-serif`
  const trimmedName = name.trim()
  const trimmedDetails = details.trim()

  if (!trimmedName && !trimmedDetails) return

  let currentY = startY

  if (trimmedName) {
    const nameLines = wrapTextByCharLimit(withLeadingSpace(trimmedName), maxNameChars)
    drawMixedWeightText(ctx, label, nameLines[0], 0, currentY, fontSize, 'center', centerX)
    for (let i = 1; i < nameLines.length; i++) {
      currentY += lineHeight
      drawCenteredGradientText(ctx, nameLines[i], centerX, currentY, mediumFont)
    }
  } else {
    drawMixedWeightText(ctx, label, '', 0, currentY, fontSize, 'center', centerX)
  }

  if (trimmedDetails) {
    currentY += lineHeight
    drawCenteredGradientText(ctx, withLeadingSpace(trimmedDetails), centerX, currentY, mediumFont)
  }
}

function drawSolidText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  centerX?: number,
): void {
  ctx.save()
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  const w = ctx.measureText(text).width
  const drawX = centerX !== undefined ? centerX - w / 2 : x
  ctx.fillText(text, drawX, y)
  ctx.restore()
}

function drawRotatedPriceTag(
  ctx: CanvasRenderingContext2D,
  price: string,
  x: number,
  y: number,
): void {
  ctx.save()
  ctx.translate(215, 940)
  ctx.rotate((12.5 * Math.PI) / 180)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = '700 46px Poppins, sans-serif'
  ctx.fillStyle = '#ffffff'
  const lineGap = 48
  ctx.fillText('PKR', 0, 0)
  if (price.trim()) ctx.fillText(price.trim(), 0, lineGap)
  ctx.restore()
}

function drawPackagePriceList(
  ctx: CanvasRenderingContext2D,
  data: UmrahPosterFormData,
  centerX: number,
  y: number,
): void {
  const fontSize = 36
  const lineHeight = 48
  const rows: [string, string][] = [
    ['Sharing: ', data.sharingPrice],
    ['Quad: ', data.quadPrice],
    ['Triple: ', data.triplePrice],
    ['Double: ', data.doublePrice],
  ]
  rows.forEach(([label, value], i) => {
    drawMixedWeightText(ctx, label, value, 0, y + i * lineHeight, fontSize, 'center', centerX)
  })
}

/** Draw the full poster onto ctx (must be 1587×2245). Base image must already be loaded. */
export function renderUmrahPoster(
  ctx: CanvasRenderingContext2D,
  data: UmrahPosterFormData,
  baseImage: HTMLImageElement,
  branding: PosterBranding = {},
  cornerImage?: HTMLImageElement | null,
  logoImage?: HTMLImageElement | null,
): void {
  ctx.clearRect(0, 0, POSTER_W, POSTER_H)
  ctx.drawImage(baseImage, 0, 0, POSTER_W, POSTER_H)

  if (branding.addCorner && cornerImage) {
    drawPosterCorner(ctx, cornerImage)
  }

  if (logoImage) {
    drawPosterLogoContain(
      ctx,
      logoImage,
      branding.logoX ?? DEFAULT_POSTER_LOGO_X,
      branding.logoY ?? DEFAULT_POSTER_LOGO_Y,
      branding.logoSize ?? DEFAULT_POSTER_LOGO_SIZE,
    )
  }

  const posterCenterX = POSTER_W / 2

  if (data.blessedLine.trim()) {
    drawCenteredGradientText(
      ctx,
      data.blessedLine.trim().toUpperCase(),
      posterCenterX,
      cm(9.12),
      '700 40px Poppins, sans-serif',
    )
  }

  if (data.cityName.trim()) {
    drawSolidText(
      ctx,
      data.cityName.trim().toUpperCase(),
      posterCenterX,
      getCityNameY(),
      '800 150px Poppins, sans-serif',
      GOLD,
      posterCenterX,
    )
  }

  if (data.daysDeparture.trim()) {
    drawGradientText(
      ctx,
      data.daysDeparture.trim(),
      cm(13.8),
      cm(20.7),
      '700 35px Poppins, sans-serif',
    )
  }

  const hotelCenterX = posterCenterX

  if (data.makkahHotelName.trim() || data.makkahHotelDetails.trim()) {
    drawHotelEntry(
      ctx,
      'Makkah Hotel:',
      data.makkahHotelName,
      data.makkahHotelDetails,
      cm(26.7),
      28,
      hotelCenterX,
      42,
    )
  }

  if (data.madinaHotelName.trim() || data.madinaHotelDetails.trim()) {
    drawHotelEntry(
      ctx,
      'Madina Hotel:',
      data.madinaHotelName,
      data.madinaHotelDetails,
      cm(29.3),
      28,
      hotelCenterX,
      41,
    )
  }

  if (data.ziyarat.trim()) {
    const ziyaratLines = wrapTextByCharLimit(withLeadingSpace(data.ziyarat), 45)
    if (ziyaratLines.length > 0) {
      const lineHeight = 25 * 1.35
      drawMixedWeightText(ctx, 'Ziyarat:', ziyaratLines[0], 0, cm(32), 28, 'center', hotelCenterX)
      for (let i = 1; i < ziyaratLines.length; i++) {
        drawCenteredGradientText(
          ctx,
          ziyaratLines[i],
          hotelCenterX,
          cm(31.3) + i * lineHeight,
          '500 25px Poppins, sans-serif',
        )
      }
    }
  }

  if (data.price.trim()) {
    drawRotatedPriceTag(ctx, data.price, cm(2.32), cm(23.45))
  }

  drawPackagePriceList(ctx, data, hotelCenterX, cm(37.6) + 6)

  const savingPriceX = cm(7.35)
  const bookBeforeX = cm(7.35)
  const bookBeforeY = cm(55.39)

  if (data.savingPrice.trim()) {
    drawSolidText(
      ctx,
      data.savingPrice.trim(),
      savingPriceX,
      cm(53.2),
      '700 56px Poppins, sans-serif',
      GOLD,
      savingPriceX,
    )
  }

  const bookBeforeFont = '700 38px Poppins, sans-serif'
  const bookBeforeLineH = 28 * 1.65
  drawCenteredGradientText(ctx, BOOK_BEFORE_PREFIX, bookBeforeX, bookBeforeY, bookBeforeFont)
  if (data.bookBeforeDate.trim()) {
    drawCenteredGradientText(
      ctx,
      data.bookBeforeDate.trim(),
      bookBeforeX,
      bookBeforeY + bookBeforeLineH,
      bookBeforeFont,
    )
  }

  const footerFont = '700 34px Poppins, sans-serif'
  const footerY = cm(54.77)
  const contactY = cm(54.90)

  if (data.contactNumber.trim()) {
    drawGradientText(ctx, data.contactNumber.trim(), cm(14.76), contactY, footerFont)
  }

  if (data.websiteUrl.trim()) {
    drawGradientText(ctx, data.websiteUrl.trim(), cm(25.97), footerY, footerFont)
  }
}

export function loadBaseImage(src = BASE_IMAGE_SRC): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load poster base image: ${src}`))
    img.src = src
  })
}

export async function renderPosterToCanvas(
  canvas: HTMLCanvasElement,
  data: UmrahPosterFormData,
  branding: PosterBranding = {},
): Promise<void> {
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  await loadPosterFonts()
  const [baseImage, cornerImage, logoImage] = await Promise.all([
    loadBaseImage(),
    branding.addCorner ? loadPosterCorner() : Promise.resolve(null),
    branding.logoUrl ? loadPosterLogo(branding.logoUrl) : Promise.resolve(null),
  ])
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  renderUmrahPoster(ctx, data, baseImage, branding, cornerImage, logoImage)
}

export function downloadPosterCanvas(canvas: HTMLCanvasElement, filename = 'umrah-package-poster.jpg'): void {
  const url = canvas.toDataURL('image/jpeg', 1.0)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
