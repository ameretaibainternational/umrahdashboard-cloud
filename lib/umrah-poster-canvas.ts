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

export interface PosterBackgroundOption {
  name: string
  src: string
  swatch: string
}

export const POSTER_BACKGROUNDS: PosterBackgroundOption[] = [
  { name: 'Dark Blue', src: '/poster bg/Dark Blue.jpg', swatch: '#12375d' },
  { name: 'Cyan', src: '/poster bg/Cyan.jpg', swatch: '#00a8cc' },
  { name: 'Gold + Black', src: '/poster bg/Gold + Black.jpg', swatch: '#1b1b1b' },
  { name: 'Gold', src: '/poster bg/Gold.jpg', swatch: '#d4af37' },
  { name: 'Gray', src: '/poster bg/Gray.jpg', swatch: '#808080' },
  { name: 'Green', src: '/poster bg/Green.jpg', swatch: '#2e7d32' },
  { name: 'Ocean Blue', src: '/poster bg/Ocean Blue.jpg', swatch: '#0077b6' },
  { name: 'Orange', src: '/poster bg/Orange.jpg', swatch: '#e65100' },
  { name: 'Purple', src: '/poster bg/Purple.jpg', swatch: '#6a1b9a' },
  { name: 'Whiite', src: '/poster bg/Whiite.jpg', swatch: '#f0f0f0' },
]

const GRADIENT_START = '#2b4d8f'
const GRADIENT_END = '#10143d'
const GOLD = '#bd872b'

export interface UmrahPosterFormData {
  backgroundImage?: string
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

  // New customizable fields
  umrahPackageText: string
  umrahPackageColor: string
  whatsIncludedText: string
  whatsIncludedColor: string
  packagePricesText: string
  packagePricesColor: string
  moreInfoText: string
  moreInfoColor: string
  specialPromoText: string
  specialPromoColor: string
  saveUpToText: string
  saveUpToColor: string
  bookBeforeLabelText: string
  bookBeforeLabelColor: string

  // Color fields for original changeable texts
  blessedLineColor: string
  cityNameColor: string
  daysDepartureColor: string
  makkahHotelColor: string
  madinaHotelColor: string
  ziyaratColor: string
  priceColor: string
  packagePricesListColor: string
  savingPriceColor: string
  bookBeforeDateColor: string
  contactNumberColor: string
  websiteUrlColor: string

  // Airplane properties
  showAirplane: boolean
  airplaneX: number
  airplaneY: number
  airplaneWidth: number
  airplaneHeight: number
}





export const BOOK_BEFORE_PREFIX = 'Book Before'

export const DEFAULT_POSTER_DATA: UmrahPosterFormData = {
  backgroundImage: 'Dark Blue',
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
  contactNumber: '+923052394810',
  websiteUrl: 'www.ameretaiba.com',

  // Defaults for new fields
  umrahPackageText: 'UMRAH PACKAGE',
  umrahPackageColor: '#12375d',
  whatsIncludedText: "What's Included",
  whatsIncludedColor: '#ffffff',
  packagePricesText: 'Umrah Package Prices',
  packagePricesColor: '#ffffff',
  moreInfoText: 'More Information',
  moreInfoColor: '#ffffff',
  specialPromoText: 'SPECIAL\nPROMO',
  specialPromoColor: '#ffffff',
  saveUpToText: 'Save up to',
  saveUpToColor: '#12375d',
  bookBeforeLabelText: 'Book before',
  bookBeforeLabelColor: '#12375d',

  // Defaults for original changeable texts colors
  blessedLineColor: '#12375d',
  cityNameColor: '#bd872b',
  daysDepartureColor: '#12375d',
  makkahHotelColor: '#12375d',
  madinaHotelColor: '#12375d',
  ziyaratColor: '#12375d',
  priceColor: '#ffffff',
  packagePricesListColor: '#12375d',
  savingPriceColor: '#bd872b',
  bookBeforeDateColor: '#12375d',
  contactNumberColor: '#12375d',
  websiteUrlColor: '#12375d',

  showAirplane: true,
  airplaneX: 27.04,
  airplaneY: -0.15,
  airplaneWidth: 19.5,
  airplaneHeight: 5.75,
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
  color: string,
): void {
  const lineHeight = fontSize * 1.35
  const boldFont = `700 ${fontSize}px Poppins, sans-serif`
  const mediumFont = `500 ${fontSize}px Poppins, sans-serif`
  const trimmedName = name.trim()
  const trimmedDetails = details.trim()

  if (!trimmedName && !trimmedDetails) return

  let currentY = startY

  if (trimmedName) {
    const nameLines = wrapTextByCharLimit(withLeadingSpace(trimmedName), maxNameChars)
    ctx.textBaseline = 'top'
    ctx.font = boldFont
    const labelW = ctx.measureText(label).width
    ctx.font = mediumFont
    const valW = ctx.measureText(nameLines[0]).width
    const totalW = labelW + valW
    const startX = centerX - totalW / 2

    drawSolidText(ctx, label, startX, currentY, boldFont, color)
    drawSolidText(ctx, nameLines[0], startX + labelW, currentY, mediumFont, color)

    for (let i = 1; i < nameLines.length; i++) {
      currentY += lineHeight
      drawSolidText(ctx, nameLines[i], centerX, currentY, mediumFont, color, centerX)
    }
  } else {
    drawSolidText(ctx, label, centerX, currentY, boldFont, color, centerX)
  }

  if (trimmedDetails) {
    currentY += lineHeight
    drawSolidText(ctx, withLeadingSpace(trimmedDetails), centerX, currentY, mediumFont, color, centerX)
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

export function drawMultiLineSolidText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: 'left' | 'center',
  fontSize: number,
): void {
  ctx.save()
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  const lines = text.split('\n')
  const lineHeight = fontSize * 1.25
  lines.forEach((line, index) => {
    const currentY = y + index * lineHeight
    const w = ctx.measureText(line).width
    const drawX = align === 'center' ? x - w / 2 : x
    ctx.fillText(line, drawX, currentY)
  })
  ctx.restore()
}

function drawRotatedPriceTag(
  ctx: CanvasRenderingContext2D,
  price: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.save()
  ctx.translate(215, 940)
  ctx.rotate((12.5 * Math.PI) / 180)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = '700 46px Poppins, sans-serif'
  ctx.fillStyle = color
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
  color: string,
): void {
  const fontSize = 36
  const lineHeight = 48
  const rows: [string, string][] = [
    ['Sharing: ', data.sharingPrice],
    ['Quad: ', data.quadPrice],
    ['Triple: ', data.triplePrice],
    ['Double: ', data.doublePrice],
  ]
  const boldFont = `700 ${fontSize}px Poppins, sans-serif`
  const mediumFont = `500 ${fontSize}px Poppins, sans-serif`
  rows.forEach(([label, value], i) => {
    ctx.textBaseline = 'top'
    ctx.font = boldFont
    const labelW = ctx.measureText(label).width
    ctx.font = mediumFont
    const valW = ctx.measureText(value).width
    const totalW = labelW + valW
    const startX = centerX - totalW / 2

    drawSolidText(ctx, label, startX, y + i * lineHeight, boldFont, color)
    drawSolidText(ctx, value, startX + labelW, y + i * lineHeight, mediumFont, color)
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
  airplaneImage?: HTMLImageElement | null,
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

  if (data.showAirplane && airplaneImage) {
    ctx.drawImage(
      airplaneImage,
      cm(data.airplaneX),
      cm(data.airplaneY),
      cm(data.airplaneWidth),
      cm(data.airplaneHeight),
    )
  }

  const posterCenterX = POSTER_W / 2

  if (data.blessedLine.trim()) {
    drawSolidText(
      ctx,
      data.blessedLine.trim().toUpperCase(),
      posterCenterX,
      cm(8.7),
      '700 40px Poppins, sans-serif',
      data.blessedLineColor || '#12375d',
      posterCenterX,
    )
  }

  if (data.cityName.trim()) {
    drawSolidText(
      ctx,
      data.cityName.trim().toUpperCase(),
      posterCenterX,
      getCityNameY(),
      '800 150px Poppins, sans-serif',
      data.cityNameColor || GOLD,
      posterCenterX,
    )
  }

  if (data.daysDeparture.trim()) {
    drawSolidText(
      ctx,
      data.daysDeparture.trim(),
      cm(13.8),
      cm(20.7),
      '700 35px Poppins, sans-serif',
      data.daysDepartureColor || '#12375d',
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
      data.makkahHotelColor || '#12375d',
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
      data.madinaHotelColor || '#12375d',
    )
  }

  if (data.ziyarat.trim()) {
    const ziyaratLines = wrapTextByCharLimit(withLeadingSpace(data.ziyarat), 45)
    if (ziyaratLines.length > 0) {
      const lineHeight = 25 * 1.35
      const boldFont = '700 28px Poppins, sans-serif'
      const mediumFont = '500 25px Poppins, sans-serif'
      const color = data.ziyaratColor || '#12375d'

      ctx.textBaseline = 'top'
      ctx.font = boldFont
      const labelW = ctx.measureText('Ziyarat:').width
      ctx.font = '500 28px Poppins, sans-serif'
      const valW = ctx.measureText(ziyaratLines[0]).width
      const totalW = labelW + valW
      const startX = hotelCenterX - totalW / 2

      drawSolidText(ctx, 'Ziyarat:', startX, cm(32), boldFont, color)
      drawSolidText(ctx, ziyaratLines[0], startX + labelW, cm(32), '500 28px Poppins, sans-serif', color)

      for (let i = 1; i < ziyaratLines.length; i++) {
        drawSolidText(
          ctx,
          ziyaratLines[i],
          hotelCenterX,
          cm(31.3) + i * lineHeight,
          mediumFont,
          color,
          hotelCenterX,
        )
      }
    }
  }

  if (data.price.trim()) {
    drawRotatedPriceTag(ctx, data.price, cm(2.32), cm(23.45), data.priceColor || '#ffffff')
  }

  drawPackagePriceList(ctx, data, hotelCenterX, cm(37.6) + 6, data.packagePricesListColor || '#12375d')

  if (data.umrahPackageText && data.umrahPackageText.trim()) {
    drawMultiLineSolidText(
      ctx,
      data.umrahPackageText.trim().toUpperCase(),
      cm(21.03),
      cm(13.9),
      '700 110px Poppins, sans-serif',
      data.umrahPackageColor,
      'center',
      110,
    )
  }

  if (data.whatsIncludedText && data.whatsIncludedText.trim()) {
    drawMultiLineSolidText(
      ctx,
      data.whatsIncludedText.trim(),
      cm(20.9),
      cm(24.5),
      '600 33.5px Poppins, sans-serif',
      data.whatsIncludedColor,
      'center',
      33.5,
    )
  }

  if (data.packagePricesText && data.packagePricesText.trim()) {
    drawMultiLineSolidText(
      ctx,
      data.packagePricesText.trim(),
      cm(21),
      cm(35.65),
      '600 35.5px Poppins, sans-serif',
      data.packagePricesColor,
      'center',
      35.5,
    )
  }

  if (data.moreInfoText && data.moreInfoText.trim()) {
    drawMultiLineSolidText(
      ctx,
      data.moreInfoText.trim(),
      cm(13),
      cm(52.82),
      '700 30px Poppins, sans-serif',
      data.moreInfoColor,
      'left',
      30,
    )
  }

  if (data.specialPromoText && data.specialPromoText.trim()) {
    drawMultiLineSolidText(
      ctx,
      data.specialPromoText.trim(),
      cm(7.4),
      cm(47.2),
      '700 52px Poppins, sans-serif',
      data.specialPromoColor,
      'center',
      45,
    )
  }

  if (data.saveUpToText && data.saveUpToText.trim()) {
    drawMultiLineSolidText(
      ctx,
      data.saveUpToText.trim(),
      cm(7.4),
      cm(51.19),
      '700 34px Poppins, sans-serif',
      data.saveUpToColor,
      'center',
      28,
    )
  }

  if (data.bookBeforeLabelText && data.bookBeforeLabelText.trim()) {
    drawMultiLineSolidText(
      ctx,
      data.bookBeforeLabelText.trim(),
      cm(7.3),
      cm(55.39),
      '700 34px Poppins, sans-serif',
      data.bookBeforeLabelColor,
      'center',
      28,
    )
  }

  const savingPriceX = cm(7.4)
  if (data.savingPrice.trim()) {
    drawSolidText(
      ctx,
      data.savingPrice.trim(),
      savingPriceX,
      cm(53.2),
      '700 56px Poppins, sans-serif',
      data.savingPriceColor || GOLD,
      savingPriceX,
    )
  }

  const bookBeforeX = cm(7.35)
  const bookBeforeY = cm(55.39)
  const bookBeforeFont = '700 42px Poppins, sans-serif'
  const bookBeforeLineH = 28 * 1.65
  if (data.bookBeforeDate.trim()) {
    drawSolidText(
      ctx,
      data.bookBeforeDate.trim(),
      bookBeforeX,
      bookBeforeY + bookBeforeLineH,
      bookBeforeFont,
      data.bookBeforeDateColor || '#12375d',
      bookBeforeX,
    )
  }

  const footerFont = '700 34px Poppins, sans-serif'
  const footerY = cm(54.77)
  const contactY = cm(54.90)

  if (data.contactNumber.trim()) {
    drawSolidText(ctx, data.contactNumber.trim(), cm(14.76), contactY, footerFont, data.contactNumberColor || '#12375d')
  }

  if (data.websiteUrl.trim()) {
    drawSolidText(ctx, data.websiteUrl.trim(), cm(25.97), footerY, footerFont, data.websiteUrlColor || '#12375d')
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

export function loadAirplaneImage(src = '/Airplane.png'): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load airplane image: ${src}`))
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
  const bgName = data.backgroundImage || 'Dark Blue'
  const bgOpt = POSTER_BACKGROUNDS.find(bg => bg.name === bgName) || POSTER_BACKGROUNDS[0]
  const bgSrc = encodeURI(bgOpt.src)

  const [baseImage, cornerImage, logoImage, airplaneImage] = await Promise.all([
    loadBaseImage(bgSrc),
    branding.addCorner ? loadPosterCorner(branding.cornerColor) : Promise.resolve(null),
    branding.logoUrl ? loadPosterLogo(branding.logoUrl) : Promise.resolve(null),
    data.showAirplane ? loadAirplaneImage() : Promise.resolve(null),
  ])
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  renderUmrahPoster(ctx, data, baseImage, branding, cornerImage, logoImage, airplaneImage)
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
