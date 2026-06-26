'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'

import { requireAdmin } from '@/lib/permissions-server'

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server')
  return createClient()
}

export async function updateHotelVoucherGuidelines(payload: {
  urdu_guidelines: string[]
  urdu_footer: string
}) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx

  const urdu_guidelines = payload.urdu_guidelines.map(l => l.trim()).filter(Boolean)
  const urdu_footer = payload.urdu_footer.trim()

  if (urdu_guidelines.length === 0) {
    return { error: 'Add at least one guideline line.' }
  }
  if (!urdu_footer) {
    return { error: 'Footer text is required.' }
  }

  if (isDemoMode()) {
    demoStore.updateHotelVoucherSettings({ urdu_guidelines, urdu_footer })
  } else {
    const supabase = await getSupabase()
    const { data: existing } = await supabase.from('hotel_voucher_settings').select('id').maybeSingle()
    const row = { urdu_guidelines, urdu_footer, updated_at: new Date().toISOString() }
    if (existing?.id) {
      await supabase.from('hotel_voucher_settings').update(row).eq('id', existing.id)
    } else {
      await supabase.from('hotel_voucher_settings').insert(row)
    }
  }

  revalidatePath('/hotel-voucher')
  return { success: true as const }
}
