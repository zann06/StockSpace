import { expect, test } from '@playwright/test'

test.skip(!!process.env.CI, 'screenshot capture — local only')

test.use({ video: { mode: 'off' } })

const OUT = '../../docs/screenshots'

test('capture gallery screenshots', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => localStorage.setItem('stockspace.tourDone', '1'))
  await page.setViewportSize({ width: 1280, height: 800 })

  await page.goto('/StockSpace/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/login.png` })

  await page.getByLabel('Email').fill('dewi@technusa.example')
  await page.getByLabel('Password').fill('stockspace-demo')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByText('Total Stok')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(2500) // 3D + NPCs settle
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true })

  await page.getByRole('link', { name: 'Warehouse 3D' }).click()
  await page.waitForTimeout(2200)
  const label = page.getByRole('button', { name: 'Rak A1' }).first()
  await label.click()
  await page.waitForTimeout(1800) // fly-to + dimming settle
  await page.screenshot({ path: `${OUT}/warehouse.png` })

  await page.getByRole('link', { name: 'Inventaris' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await page.screenshot({ path: `${OUT}/inventory.png`, fullPage: true })

  await page.getByRole('link', { name: 'Stock Opname' }).click()
  await page.getByRole('button', { name: 'Mulai Stock Opname' }).click()
  await page.getByRole('button', { name: 'Buat', exact: true }).click()
  await expect(page.getByText(/Terhitung/)).toBeVisible({ timeout: 15000 })
  const firstInput = page.getByRole('spinbutton').first()
  await firstInput.fill('5')
  await firstInput.blur()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/stocktakes.png` })

  await page.getByRole('link', { name: 'Laporan' }).click()
  await expect(page.getByRole('heading', { name: 'Usulan Pesanan Ulang' })).toBeVisible({
    timeout: 15000,
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/reports.png`, fullPage: true })
})
