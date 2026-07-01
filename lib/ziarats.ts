import type { PackageInvoiceData, ZiaratOption } from './types'

export const LEGACY_ZIARAT_SLUGS = ['makkah', 'madinah', 'badr', 'taif', 'walking'] as const
export type LegacyZiaratSlug = (typeof LEGACY_ZIARAT_SLUGS)[number]

export const DEFAULT_ZIARAT_SEED: Omit<ZiaratOption, 'id' | 'created_at'>[] = [
  { name: 'Makkah Ziarat', slug: 'makkah', rate_sar: 15, sort_order: 1 },
  { name: 'Madinah Ziarat', slug: 'madinah', rate_sar: 12, sort_order: 2 },
  { name: 'Badr Ziarat', slug: 'badr', rate_sar: 9, sort_order: 3 },
  { name: 'Taif Ziarat', slug: 'taif', rate_sar: 9, sort_order: 4 },
  { name: 'Walking Ziarats', slug: 'walking', rate_sar: 0, sort_order: 5 },
]

export function ziaratBySlug(ziarats: ZiaratOption[], slug: LegacyZiaratSlug): ZiaratOption | undefined {
  return ziarats.find(z => z.slug === slug)
}

export function resolveSelectedZiaratIds(
  data: Pick<
    PackageInvoiceData,
    'selectedZiaratIds' | 'makkahZiarat' | 'madinahZiarat' | 'badrZiarat' | 'taifZiarat' | 'walkingZiarat'
  > | null | undefined,
  ziarats: ZiaratOption[],
): string[] {
  if (!data) return []
  if (Array.isArray(data.selectedZiaratIds) && data.selectedZiaratIds.length > 0) {
    const valid = new Set(ziarats.map(z => z.id))
    return data.selectedZiaratIds.filter(id => valid.has(id))
  }

  const ids: string[] = []
  if (data.makkahZiarat) {
    const id = ziaratBySlug(ziarats, 'makkah')?.id
    if (id) ids.push(id)
  }
  if (data.madinahZiarat) {
    const id = ziaratBySlug(ziarats, 'madinah')?.id
    if (id) ids.push(id)
  }
  if (data.badrZiarat) {
    const id = ziaratBySlug(ziarats, 'badr')?.id
    if (id) ids.push(id)
  }
  if (data.taifZiarat) {
    const id = ziaratBySlug(ziarats, 'taif')?.id
    if (id) ids.push(id)
  }
  if (data.walkingZiarat) {
    const id = ziaratBySlug(ziarats, 'walking')?.id
    if (id) ids.push(id)
  }
  return ids
}

export function ziaratLegacyFlags(selectedIds: string[], ziarats: ZiaratOption[]) {
  const selected = new Set(selectedIds)
  const has = (slug: LegacyZiaratSlug) => {
    const z = ziaratBySlug(ziarats, slug)
    return Boolean(z && selected.has(z.id))
  }
  return {
    makkahZiarat: has('makkah'),
    madinahZiarat: has('madinah'),
    badrZiarat: has('badr'),
    taifZiarat: has('taif'),
    walkingZiarat: has('walking'),
  }
}

export function mergeDefaultZiarats(rows: ZiaratOption[]): ZiaratOption[] {
  if (rows.length > 0) return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  return DEFAULT_ZIARAT_SEED.map((seed, i) => ({
    id: `default-z${i + 1}`,
    ...seed,
  }))
}
