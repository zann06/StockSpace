import JsBarcode from 'jsbarcode'

import type { Product } from '@/types'

/**
 * Renders a Code-128 barcode for the product's SKU into an SVG string.
 * Falls back to null when the SKU cannot be encoded (e.g. characters outside
 * the Code-128 charset) — the label then shows the SKU as plain text.
 */
/** Opens a print window containing barcode labels for the given products. */
export function printBarcodeLabels(
  products: Array<Pick<Product, 'sku' | 'name'>>,
  options: { copies?: number; businessName?: string } = {}
): void {
  const copies = Math.max(1, options.copies ?? 1)
  const labels = products
    .map((product) => {
      let barcode: string
      try {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        JsBarcode(svg, product.sku, {
          format: 'CODE128',
          displayValue: true,
          width: 2,
          height: 48,
          margin: 6,
          fontSize: 13,
        })
        barcode = svg.outerHTML
      } catch {
        barcode = `<p class="sku-fallback">${escapeHtml(product.sku)}</p>`
      }
      return `<div class="label"><div class="label-inner"><p class="name">${escapeHtml(product.name)}</p>${barcode}</div></div>`
    })
    .join('')

  const copyBlocks = Array.from({ length: copies }, () => labels).join('')

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Label Barcode — StockSpace</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 16px; color: #151b4a; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .label { border: 1px dashed #c9cee6; border-radius: 8px; padding: 8px 12px; }
  .label-inner .name { margin: 0 0 4px; font-size: 12px; font-weight: 700; max-width: 220px; }
  .sku-fallback { font-family: monospace; font-size: 13px; letter-spacing: 1px; }
  .brand { font-size: 11px; color: #7a83a8; margin-bottom: 12px; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body onload="window.print()">
<p class="brand">${escapeHtml(options.businessName ?? 'StockSpace')}</p>
<div class="grid">${copyBlocks}</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=860,height=640')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
