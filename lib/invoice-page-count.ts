import type { CustomInvoiceLineItem } from './types'

const ROWS_P1 = 4
const ROWS_PC = 5

function filterInvoiceLineItems(
  lineItems: CustomInvoiceLineItem[],
  hideServiceCharges: boolean,
): CustomInvoiceLineItem[] {
  if (!hideServiceCharges) return lineItems
  return lineItems.filter(item => {
    const name = item.service.toLowerCase().trim()
    return name !== 'service charges' && name !== 'services charges'
  })
}

/** Mirrors CustomInvoiceTemplate page split logic for preview height sizing. */
export function getInvoiceTemplatePageCount(
  lineItems: CustomInvoiceLineItem[],
  hideServiceCharges = false,
): number {
  const items = filterInvoiceLineItems(lineItems, hideServiceCharges)
  if (items.length <= ROWS_P1) return 1
  return 1 + Math.ceil((items.length - ROWS_P1) / ROWS_PC)
}
