/** Umrah poster canvas size matches `POSTER_W` × `POSTER_H` in umrah-poster-canvas.ts. */

export const POSTER_CANVAS_W = 1587
export const POSTER_CANVAS_H = 2245

// Default logo placement (overridden by form sliders)
export const DEFAULT_POSTER_LOGO_X = 20
export const DEFAULT_POSTER_LOGO_Y = 20
export const DEFAULT_POSTER_LOGO_SIZE = 242
export const DEFAULT_POSTER_ADD_CORNER = true

export const POSTER_LOGO_SIZE_MIN = 40
export const POSTER_LOGO_SIZE_MAX = 400

export const POSTER_LOGO_MAX_BYTES = 150 * 1024

export const POSTER_CORNER_SRC = '/poster-corner.png'

// EDIT THESE VARIABLES TO ADJUST CORNER POSITION
export const POSTER_CORNER_X = 0
export const POSTER_CORNER_Y = 0
export const POSTER_CORNER_W = 376
export const POSTER_CORNER_H = 376

export interface PosterBranding {
  logoUrl?: string | null
  addCorner?: boolean
  logoX?: number
  logoY?: number
  logoSize?: number
}

export function clampLogoPosition(
  x: number,
  y: number,
  size: number,
): { x: number; y: number } {
  const maxX = Math.max(0, POSTER_CANVAS_W - size)
  const maxY = Math.max(0, POSTER_CANVAS_H - size)
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  }
}

export function getPosterLogoDrawSize(
  img: HTMLImageElement,
  size: number,
): { width: number; height: number } {
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight)
  return {
    width: img.naturalWidth * scale,
    height: img.naturalHeight * scale,
  }
}

/** Draw logo with top-left at (x, y); size is the max width/height (contain scale). */
export function drawPosterLogoContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
): void {
  const { width, height } = getPosterLogoDrawSize(img, size)
  ctx.drawImage(img, x, y, width, height)
}

export function drawPosterCorner(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x = POSTER_CORNER_X,
  y = POSTER_CORNER_Y,
  w = POSTER_CORNER_W,
  h = POSTER_CORNER_H,
): void {
  ctx.drawImage(img, x, y, w, h)
}

export function loadPosterLogo(src: string): Promise<HTMLImageElement> {
  return loadPosterImage(src, 'poster logo')
}

export function loadPosterCorner(): Promise<HTMLImageElement> {
  return loadPosterImage(POSTER_CORNER_SRC, 'poster corner')
}

function loadPosterImage(src: string, label: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${label}`))
    img.src = src
  })
}
