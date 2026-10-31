import { expect, test } from '@playwright/test'

test.skip(!!process.env.CI, 'recording spec — local only')

/**
 * One-off recorder for the README demo GIF (live demo on GitHub Pages).
 * Flow: login → dashboard (3D + dressing + NPCs) → warehouse fly-to focus →
 * stock-in form → forklift delivery replay → stock opname → restock report →
 * suppliers card.
 */
test('record demo gif', async ({ page }) => {
  // suppress the onboarding tour for a clean recording
  await page.addInitScript(() => localStorage.setItem('stockspace.tourDone', '1'))

  // 1. login
  await page.goto('/StockSpace/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByLabel('Email').fill('dewi@technusa.example')
  await page.getByLabel('Password').fill('stockspace-demo')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByText('Total Stok')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(2200) // let the 3D scene + NPCs settle

  // 2. warehouse: select a rack → fly-to + dimming showcase
  await page.getByRole('link', { name: 'Warehouse 3D' }).click()
  await page.waitForTimeout(2200)
  await page.mouse.move(640, 420)
  await page.mouse.down()
  await page.mouse.move(740, 380, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  const label = page.getByRole('button', { name: 'Rak A1' }).first()
  await label.click()
  await page.waitForTimeout(1800) // fly-to glide + rack pulse

  // 3. stock-in form → submit (delivery replays in the warehouse after)
  await page.getByRole('link', { name: 'Transaksi' }).click()
  await page.getByRole('tab', { name: 'Barang Masuk' }).click()
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
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Catat Barang Masuk' }).click()
  await expect(page.getByText(/Transaksi berhasil dicatat/)).toBeVisible()
  await page.waitForTimeout(700)

  // 4. watch the forklift deliver the box on the warehouse page
  await page.getByRole('link', { name: 'Warehouse 3D' }).click()
  await page.waitForTimeout(2200)

  // 5. stock opname page
  await page.getByRole('link', { name: 'Stock Opname' }).click()
  await page.waitForTimeout(700)

  // 6. reports: restock proposal
  await page.getByRole('link', { name: 'Laporan' }).click()
  await expect(page.getByRole('heading', { name: 'Usulan Pesanan Ulang' })).toBeVisible({
    timeout: 15000,
  })
  await page.waitForTimeout(900)

  // 7. settings: suppliers card
  await page.getByRole('link', { name: 'Pengaturan' }).click()
  await expect(page.getByText('Kelola Supplier')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(800)

  // 8. back to dashboard to close
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.getByText('Total Stok')).toBeVisible()
  await page.waitForTimeout(1200)
})
