/** Normalize invoice DOM for html2canvas — Poppins/web fonts are stripped in clone. */
export function applyInvoicePdfCloneStyles(clonedDoc: Document) {
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove())

  clonedDoc.querySelectorAll<HTMLElement>('[data-invoice-root]').forEach(root => {
    root.style.backgroundImage = 'none'
    root.style.backgroundColor = 'transparent'
  })

  clonedDoc.querySelectorAll<HTMLElement>('[data-invoice-branding-logo]').forEach(el => {
    el.style.display = 'none'
  })

  clonedDoc.querySelectorAll<HTMLElement>('[data-invoice-root] *').forEach(el => {
    if (el.tagName === 'IMG') return
    el.style.fontFamily = 'Arial, Helvetica, sans-serif'
    el.style.letterSpacing = 'normal'
    el.style.wordSpacing = 'normal'
    el.style.fontVariantLigatures = 'none'
    el.style.setProperty('-webkit-font-variant-ligatures', 'none')
  })

  clonedDoc.querySelectorAll<HTMLElement>('[data-invoice-row-text]').forEach(el => {
    const top = parseFloat(el.style.top)
    if (!Number.isNaN(top)) el.style.top = `${top - 4}px`
    el.style.lineHeight = el.style.fontSize || '12px'
  })

  clonedDoc.querySelectorAll<HTMLElement>('[data-invoice-hdr-text]').forEach(el => {
    const top = parseFloat(el.style.top)
    if (!Number.isNaN(top)) el.style.top = `${top - 3}px`
    el.style.lineHeight = el.style.fontSize || '12px'
  })

  clonedDoc.querySelectorAll<HTMLElement>('[data-invoice-terms]').forEach(el => {
    el.style.whiteSpace = 'normal'
    el.style.wordBreak = 'normal'
    el.style.overflowWrap = 'break-word'
    el.style.lineHeight = '10.5px'
  })
}

/** Hotel voucher page 1 — same Poppins fallback issue as invoices. */
export function applyVoucherPdfCloneStyles(clonedDoc: Document) {
  clonedDoc.querySelectorAll<HTMLElement>('[data-voucher-p1], [data-voucher-p1] *').forEach(el => {
    if (el.tagName === 'IMG') return
    el.style.fontFamily = 'Arial, Helvetica, sans-serif'
    el.style.letterSpacing = 'normal'
    el.style.wordSpacing = 'normal'
    el.style.fontVariantLigatures = 'none'
    el.style.setProperty('-webkit-font-variant-ligatures', 'none')
  })
}
