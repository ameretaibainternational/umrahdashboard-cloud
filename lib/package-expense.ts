import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { hasDirectDb } from '@/lib/sql'
import type { Expense } from '@/lib/types'

export type PackageExpenseInput = {
  customer_name: string
  cost_pkr: number
  total_pkr: number
  profit_pkr: number
  booking_date: string
  booking_id?: string | null
  created_by: string
}

export function buildPackageExpense(
  input: PackageExpenseInput,
): Omit<Expense, 'id' | 'created_at'> | null {
  const amount = Math.round(Number(input.cost_pkr))
  if (!Number.isFinite(amount) || amount <= 0) return null

  const customer = input.customer_name.trim() || 'Walk-in Customer'

  return {
    expense_type: 'Umrah Supplier',
    supplier: customer,
    amount_pkr: amount,
    method: 'Cash',
    note: `Package cost (auto) — ${customer} · Package ${Math.round(input.total_pkr)} PKR · Profit ${Math.round(input.profit_pkr)} PKR`,
    expense_date: input.booking_date,
    booking_id: input.booking_id ?? null,
  }
}

export async function recordPackageExpense(input: PackageExpenseInput): Promise<void> {
  const row = buildPackageExpense(input)
  if (!row) return

  if (isDemoMode()) {
    demoStore.addExpense({ ...row, created_by: input.created_by })
    return
  }

  if (hasDirectDb()) {
    const { insertExpense } = await import('@/lib/crm-db')
    await insertExpense({
      expense_type: row.expense_type,
      supplier: row.supplier,
      amount_pkr: row.amount_pkr,
      method: row.method,
      note: row.note,
      expense_date: row.expense_date,
      booking_id: row.booking_id,
      created_by: input.created_by,
    })
    return
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const withOwner = { ...row, created_by: input.created_by }
  const { error } = await supabase.from('expenses').insert(withOwner)
  if (error?.message.includes('booking_id') || error?.message.includes('schema cache')) {
    const { booking_id: _, ...withoutBookingLink } = withOwner
    await supabase.from('expenses').insert(withoutBookingLink)
  }
}
