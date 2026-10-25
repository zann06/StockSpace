import { expect, test } from '@playwright/test'

/** One-off verification of the live GitHub Pages demo (login → dashboard). */
test('live demo login works', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stockspace.tourDone', '1'))
  await page.goto('https://zann06.github.io/StockSpace/', { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill('dewi@technusa.example')
  await page.getByLabel('Password').fill('stockspace-demo')
  await page.getByRole('button', { name: 'Masuk' }).click()


  await expect(page.getByRole('heading', { name: /Toko TechNusa/ })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Total Stok')).toBeVisible()

  // record a movement to prove the demo is stateful
  await page.goto('https://zann06.github.io/StockSpace/#/transactions/stock-in')
  const productSelect = page.getByRole('combobox', { name: /Produk/ })
  await productSelect.waitFor()
  const productValue = await productSelect
    .locator('option', { hasText: 'Mouse Wireless Ergonomis' })
    .getAttribute('value')
  await productSelect.selectOption(productValue!)
  const destinationSelect = page.getByRole('combobox', { name: /Lokasi Tujuan/ })
  const destinationValue = await destinationSelect
    .locator('option', { hasText: 'Rak A1' })
    .getAttribute('value')
  await destinationSelect.selectOption(destinationValue!)
  await page.getByRole('spinbutton', { name: /^Jumlah/ }).fill('7')
  await page.getByRole('button', { name: 'Catat Barang Masuk' }).click()
  await expect(page.getByText(/Transaksi berhasil dicatat/)).toBeVisible()
})
