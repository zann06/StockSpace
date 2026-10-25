import { expect, test } from '@playwright/test'

/**
 * One-off recorder for the README demo GIF (not part of the smoke suite).
 * Flow: sign in → dashboard (3D) → warehouse tour (rotate + rack selection) →
 * stock-in form → committed movement (delivery animation) → updated dashboard.
 * Run: npx playwright test e2e/demo-gif.spec.ts
 * The video lands in e2e/screenshots/ and is converted to
 * docs/screenshots/demo-stock-in.gif with ffmpeg (palette-optimised).
 */

test.skip(!!process.env.CI, 'recording spec — local only')

test.use({ video: { mode: 'on', size: { width: 1280, height: 800 } } })

test('record demo gif', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })

  // Disable the onboarding tour for a clean recording.
  await page.addInitScript(() => localStorage.setItem('stockspace.tourDone', '1'))

  // 1. Login
  await page.goto('/login')
  await page.waitForTimeout(600)
  await page.getByLabel('Email').fill('dewi@technusa.example')
  await page.getByLabel('Password').fill('stockspace-demo')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('heading', { name: /Toko TechNusa/ })).toBeVisible()
  await page.waitForTimeout(1800) // 3D scene settles

  // 2. Warehouse: select a rack, drag to rotate a little
  await page.getByRole('link', { name: 'Warehouse 3D' }).click()
  await page.waitForTimeout(2200)
  await page.mouse.move(640, 420)
  await page.mouse.down()
  await page.mouse.move(760, 380, { steps: 24 })
  await page.mouse.up()
  await page.waitForTimeout(700)

  // 3. Stock-in form → submit (delivery animation plays in the scene)
  await page.goto('/transactions/stock-in')
  const productSelect = page.getByRole('combobox', { name: /Produk/ })
  await productSelect.waitFor()
  const productValue = await productSelect
    .locator('option', { hasText: 'Mouse Wireless Ergonomis' })
    .getAttribute('value')
  await productSelect.selectOption(productValue!)
  const destinationSelect = page.getByRole('combobox', { name: /Lokasi Tujuan/ })
  await destinationSelect.waitFor()
  const destinationValue = await destinationSelect
    .locator('option', { hasText: 'Rak A1' })
    .getAttribute('value')
  await destinationSelect.selectOption(destinationValue!)
  await page.getByRole('spinbutton', { name: /^Jumlah/ }).fill('12')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Catat Barang Masuk' }).click()
  await expect(page.getByText(/Transaksi berhasil dicatat/)).toBeVisible()
  await page.waitForTimeout(900)

  // 4. Back to the warehouse to watch the delivery land on the rack
  await page.getByRole('link', { name: 'Warehouse 3D' }).click()
  await page.waitForTimeout(1600)

  // 5. Dashboard reflects the new stock
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.getByText('Total Stok')).toBeVisible()
  await page.waitForTimeout(1200)
})
