import { expect, test } from '@playwright/test'

test('debug demo login', async ({ page }) => {
  const errors: string[] = []
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) console.log('NAVIGATED TO:', frame.url())
  })
  page.on('request', (req) => {
    if (!req.url().includes('.woff')) console.log('REQ:', req.method(), req.url().slice(0, 140))
  })
  page.on('download', (dl) => console.log('DOWNLOAD:', dl.url()))
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log('HTTP', res.status(), res.url().slice(0, 160))
      const headers = res.headers()
      Object.entries(headers).forEach(([k, v]) =>
        console.log('  HDR', k + ':', String(v).slice(0, 90))
      )
      res
        .text()
        .then((t) => console.log('404 BODY:', t.slice(0, 200)))
        .catch(() => {})
    }
  })
  page.on('pageerror', (error) => {
    const text = `PAGEERROR: ${error.message.slice(0, 300)}`
    errors.push(text)
    console.log(text)
  })
  page.on('console', (msg) => {
    {
      const text = `CONSOLE[${msg.type()}]: ${msg.text().slice(0, 300)}`
      errors.push(text)
      console.log(text)
    }
  })
  page.on('pageerror', (error) => {
    const text = `PAGEERROR: ${error.message.slice(0, 300)}`
    errors.push(text)
    console.log(text)
  })

  await page.goto('http://127.0.0.1:4176/StockSpace/', { waitUntil: 'networkidle' })
  console.log('URL after load:', page.url())
  console.log('title:', await page.title())
  await page.waitForTimeout(2000)
  console.log('BODY@2s:', JSON.stringify((await page.locator('body').innerText()).slice(0, 200)))

  await page.getByLabel('Email').fill('dewi@technusa.example')
  await page.getByLabel('Password').fill('stockspace-demo')
  const btn = page.getByRole('button', { name: 'Masuk' })
  console.log('btn disabled before click:', await btn.isDisabled())
  await btn.click()
  console.log('btn disabled right after click:', await btn.isDisabled().catch(() => 'n/a'))
  await page.waitForTimeout(500)
  console.log(
    'alert @500ms:',
    JSON.stringify(
      await page
        .locator('[role=alert]')
        .textContent()
        .catch(() => null)
    )
  )
  console.log('url @500ms:', page.url())
  await page.waitForTimeout(2500)
  console.log('URL after submit:', page.url())
  console.log('errors:', errors.length ? errors.join('\n') : 'none')
  expect(errors, errors.join('\n')).toHaveLength(0)
})
