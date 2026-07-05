import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { hasDirectDb } from '@/lib/sql'
import type { Expense } from '@/lib/types'

export type CustomInvoiceExpenseInput = {
  invoice_id: string
  invoice_number: string
  customer_name: string
  total_pkr: number
  profit_pkr: number
  invoice_date: string
  created_by: string
}

export function buildCustomInvoiceExpense(
  input: CustomInvoiceExpenseInput,
): Omit<Expense, 'id' | 'created_at'> | null {
  const profit = Math.round(Number(input.profit_pkr))
  const total = Math.round(Number(input.total_pkr))
  const amount = Math.max(0, total - profit)
  if (!Number.isFinite(amount) || amount <= 0) return null

  const customer = input.customer_name.trim() || 'Customer'

  return {
    expense_type: 'Other Umrah Expense',
    supplier: customer,
    amount_pkr: amount,
    method: 'Cash',
    note: `Custom invoice (auto) — ${input.invoice_number} · Total ${total} PKR · Profit ${profit} PKR`,
    expense_date: input.invoice_date,
    booking_id: null,
    invoice_id: input.invoice_id,
  }
}

export async function recordCustomInvoiceExpense(input: CustomInvoiceExpenseInput): Promise<void> {
  const row = buildCustomInvoiceExpense(input)
  if (!row) return

  if (isDemoMode()) {
    demoStore.deleteExpensesForInvoice(input.invoice_id)
    demoStore.addExpense({ ...row, created_by: input.created_by })
    return
  }

  await deleteCustomInvoiceExpense(input.invoice_id)

  if (hasDirectDb()) {
    const { insertExpense } = await import('@/lib/crm-db')
    await insertExpense({
      expense_type: row.expense_type,
      supplier: row.supplier,
      amount_pkr: row.amount_pkr,
      method: row.method,
      note: row.note,
      expense_date: row.expense_date,
      booking_id: null,
      invoice_id: input.invoice_id,
      created_by: input.created_by,
    })
    return
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const withOwner = { ...row, created_by: input.created_by }
  const { error } = await supabase.from('expenses').insert(withOwner)
  if (error?.message.includes('invoice_id') || error?.message.includes('schema cache')) {
    const { invoice_id: _, ...withoutInvoiceLink } = withOwner
    await supabase.from('expenses').insert(withoutInvoiceLink)
  }
}

export async function deleteCustomInvoiceExpense(invoiceId: string): Promise<void> {
  if (isDemoMode()) {
    demoStore.deleteExpensesForInvoice(invoiceId)
    return
  }

  if (hasDirectDb()) {
    const { deleteExpensesByInvoiceId } = await import('@/lib/crm-db')
    await deleteExpensesByInvoiceId(invoiceId)
    return
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  await supabase.from('expenses').delete().eq('invoice_id', invoiceId)
}
