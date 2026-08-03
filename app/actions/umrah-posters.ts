'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { uploadPosterJpegToStorage } from '@/app/actions/storage'
import { friendlyDbError } from '@/lib/friendly-db-error'
import {
  hasDirectDb,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
} from '@/lib/sql'
import { requireModeratorFeature } from '@/lib/permissions-server'

const PATHS = ['/umrah-poster', '/settings/storage']

export async function createUmrahPosterWithImage(payload: {
  title: string
  poster_date: string
  poster_data: Record<string, unknown>
  branding_data: Record<string, unknown>
  calc_data: Record<string, unknown> | null
  jpeg_base64: string
}) {
  const ctx = await requireModeratorFeature('umrah_posters')
  if ('error' in ctx) return ctx

  const id = crypto.randomUUID()
  const upload = await uploadPosterJpegToStorage(id, payload.jpeg_base64)
  if ('error' in upload) return { error: upload.error }

  const row = {
    id,
    title: payload.title,
    poster_date: payload.poster_date,
    poster_data: payload.poster_data,
    branding_data: payload.branding_data,
    calc_data: payload.calc_data,
    storage_key: upload.storage_key,
    file_size_bytes: upload.file_size_bytes,
  }

  if (isDemoMode()) {
    const poster = demoStore.addUmrahPoster({
      id,
      title: row.title,
      poster_date: row.poster_date,
      poster_data: row.poster_data,
      branding_data: row.branding_data,
      calc_data: row.calc_data,
      storage_key: upload.storage_key,
      file_size_bytes: upload.file_size_bytes,
      file_deleted_at: null,
      created_by: ctx.userId,
    })
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, id: poster.id, poster_number: poster.poster_number }
  }

  try {
    const { insertUmrahPoster } = await import('@/lib/document-db')
    const data = await insertUmrahPoster({
      id,
      title: row.title,
      poster_date: row.poster_date,
      poster_data: row.poster_data,
      branding_data: row.branding_data,
      calc_data: row.calc_data,
      storage_key: upload.storage_key,
      file_size_bytes: upload.file_size_bytes,
      created_by: ctx.userId,
    })
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const, id: data.id, poster_number: data.poster_number }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Save failed') }
  }
}

export async function updateUmrahPosterWithImage(payload: {
  id: string
  title: string
  poster_date: string
  poster_data: Record<string, unknown>
  branding_data: Record<string, unknown>
  calc_data: Record<string, unknown> | null
  jpeg_base64: string
}) {
  const ctx = await requireModeratorFeature('umrah_posters')
  if ('error' in ctx) return ctx

  const upload = await uploadPosterJpegToStorage(payload.id, payload.jpeg_base64)
  if ('error' in upload) return { error: upload.error }

  const row = {
    title: payload.title,
    poster_date: payload.poster_date,
    poster_data: payload.poster_data,
    branding_data: payload.branding_data,
    calc_data: payload.calc_data,
    storage_key: upload.storage_key,
    file_size_bytes: upload.file_size_bytes,
  }

  if (isDemoMode()) {
    demoStore.updateUmrahPoster(payload.id, row)
    PATHS.forEach(p => revalidatePath(p))
    return { success: true as const }
  }

  try {
    if (hasDirectDb()) {
      try {
        const { updateUmrahPosterDirect } = await import('@/lib/document-db')
        await updateUmrahPosterDirect(payload.id, row)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const }
      } catch (error) {
        if (!isDirectDbRecoverableError(error)) throw error
        markDirectDbAuthFailed()
        const { updateUmrahPosterSupabase } = await import('@/lib/supabase-document-db')
        await updateUmrahPosterSupabase(payload.id, row)
        PATHS.forEach(p => revalidatePath(p))
        return { success: true as const }
      }
    } else {
      const { updateUmrahPosterSupabase } = await import('@/lib/supabase-document-db')
      await updateUmrahPosterSupabase(payload.id, row)
      PATHS.forEach(p => revalidatePath(p))
      return { success: true as const }
    }
  } catch (e) {
    return { error: friendlyDbError(e instanceof Error ? e.message : 'Update failed') }
  }
}

export async function deleteUmrahPoster(id: string) {
  const ctx = await requireModeratorFeature('umrah_posters')
  if ('error' in ctx) return ctx

  if (isDemoMode()) {
    demoStore.deleteUmrahPoster(id)
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    if (!ctx.isAdmin) {
      const { data: poster } = await supabase.from('umrah_posters').select('created_by').eq('id', id).single()
      if (!poster) return { error: 'Poster not found.' }
      if (poster.created_by !== ctx.userId) return { error: 'You can only delete your own posters.' }
    }

    try {
      if (hasDirectDb()) {
        try {
          const { deleteUmrahPosterDirect } = await import('@/lib/document-db')
          await deleteUmrahPosterDirect(id)
        } catch (error) {
          if (!isDirectDbRecoverableError(error)) throw error
          markDirectDbAuthFailed()
          const { deleteUmrahPosterSupabase } = await import('@/lib/supabase-document-db')
          await deleteUmrahPosterSupabase(id)
        }
      } else {
        const { deleteUmrahPosterSupabase } = await import('@/lib/supabase-document-db')
        await deleteUmrahPosterSupabase(id)
      }
      const { syncStorageUsageSupabase, fetchStoredFilesSupabase } = await import('@/lib/supabase-document-db')
      const { storageUsageFromFiles } = await import('@/lib/storage-usage')
      const files = await fetchStoredFilesSupabase()
      await syncStorageUsageSupabase(storageUsageFromFiles(files).total_bytes)
    } catch (e) {
      return { error: friendlyDbError(e instanceof Error ? e.message : 'Delete failed') }
    }
  }
  PATHS.forEach(p => revalidatePath(p))
  return { success: true }
}

export async function deleteUmrahPosters(ids: string[]) {
  if (ids.length === 0) return { error: 'No posters selected.' }

  const uniqueIds = [...new Set(ids)]
  let deleted = 0
  const errors: string[] = []

  for (const id of uniqueIds) {
    const result = await deleteUmrahPoster(id)
    if ('error' in result && result.error) {
      errors.push(result.error)
    } else {
      deleted++
    }
  }

  if (deleted === 0) {
    return { error: errors[0] ?? 'Delete failed.' }
  }

  if (errors.length > 0) {
    return { success: true, deleted, error: `${deleted} deleted, ${errors.length} failed.` }
  }

  return { success: true, deleted }
}
