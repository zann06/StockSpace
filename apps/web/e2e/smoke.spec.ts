import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * PRD §13 end-to-end smoke test: login → inventory → stock-in → updated
 * dashboard, against the real API + PostgreSQL (fictional demo workspace).
 * Also runs an axe accessibility scan on the dashboard and captures the
 * screenshots used in the README.
 */

const DEMO = { email: 'dewi@technusa.example', password: 'stockspace-demo' }

/** Parses the "Total Stok" KPI value (Indonesian thousand separators). */
async function totalUnitsFromDashboard(page: Page): Promise<number> {
  await expect(page.getByText('Total Stok')).toBeVisible()
  const raw = await page
    .locator('xpath=//p[normalize-space()="Total Stok"]/following::p[1]')
    .textContent()
  const match = (raw ?? '').match(/[\d.]+/)
  const number = Number.parseInt((match?.[0] ?? '').replace(/\./g, ''), 10)
  expect(Number.isNaN(number)).toBe(false)
  return number
}

test('login page rejects invalid credentials with a readable error', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await page.screenshot({ path: '../../docs/screenshots/login.png', fullPage: true })

  await page.getByLabel('Email').fill('wrong@example.com')
  await page.getByLabel('Password').fill('totally-wrong')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})

test('smoke: login → dashboard (a11y scan) → warehouse → inventory → stock-in → updated dashboard → logout', async ({
  page,
}) => {
  // 1. Sign in as STAFF.
  await page.goto('/login')
  await page.getByLabel('Email').fill(DEMO.email)
  await page.getByLabel('Password').fill(DEMO.password)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('heading', { name: /Toko TechNusa/ })).toBeVisible()

  // 2. Dashboard shows KPIs derived from the database.
  const unitsBefore = await totalUnitsFromDashboard(page)
  await page.screenshot({ path: '../../docs/screenshots/dashboard.png', fullPage: true })

  // 3. Accessibility scan — serious/critical violations fail the gate.
  const axe = await new AxeBuilder({ page }).analyze()
  const serious = axe.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? '')
  )
  expect(
    serious.map((violation) => violation.id),
    JSON.stringify(serious, null, 2)
  ).toHaveLength(0)

  // 4. Warehouse 3D page renders the scene (screenshot for the README).
  await page.getByRole('link', { name: 'Warehouse 3D' }).click()
  await expect(page.getByText('Detail Lokasi')).toBeVisible()
  await page.waitForTimeout(1500) // let the 3D scene settle
  await page.screenshot({ path: '../../docs/screenshots/warehouse.png' })

  // 5. Inventory lists seeded products.
  await page.getByRole('link', { name: 'Inventaris' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByText('Laptop ASUS TUF F15')).toBeVisible()
  await page.screenshot({ path: '../../docs/screenshots/inventory.png', fullPage: true })

  // 6. Record a stock-in movement through the real form.
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
  await page.getByRole('button', { name: 'Catat Barang Masuk' }).click()
  await expect(page.getByText(/Transaksi berhasil dicatat/)).toBeVisible()

  // 7. Dashboard reflects the persisted change.
  await page.goto('/dashboard')
  const unitsAfter = await totalUnitsFromDashboard(page)
  expect(unitsAfter).toBe(unitsBefore + 12)

  // 8. Sign out returns to the login page.
  await page.getByRole('button', { name: /buka menu pengguna/ }).click()
  await page.getByRole('button', { name: 'Keluar' }).click()
  await expect(page.getByText('Masuk untuk mengelola inventaris Anda')).toBeVisible()
})
