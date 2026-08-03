import type { StaffUser } from './types'

export function buildStaffUsernameMap(staff: StaffUser[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const member of staff) {
    map[member.id] = member.username
  }
  return map
}

export function staffUsername(
  map: Record<string, string>,
  createdBy?: string | null,
): string {
  if (!createdBy) return '—'
  return map[createdBy] ?? '—'
}

export function staffUsernames(
  map: Record<string, string>,
  createdByIds: Array<string | null | undefined>,
): string {
  const names = [...new Set(
    createdByIds
      .filter((id): id is string => Boolean(id))
      .map(id => map[id])
      .filter(Boolean),
  )]
  return names.length > 0 ? names.join(', ') : '—'
}
