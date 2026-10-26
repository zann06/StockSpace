import { beforeEach, describe, expect, it } from 'vitest'

import { DEMO_PASSWORD, demoFetch, resetDemoState } from '@/api/demo-api'

async function signIn(email: string) {
  const response = await demoFetch('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password: DEMO_PASSWORD },
  })
  expect(response.status).toBe(200)
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

describe('demo API — workspace members', () => {
  beforeEach(() => resetDemoState({ signedIn: false }))

  it('lets an owner invite, re-role, and remove a member', async () => {
    await signIn('farid@technusa.example')

    const invited = await demoFetch('/api/members', {
      method: 'POST',
      body: { email: 'admin@technusa.example', role: 'VIEWER' },
    })
    expect(invited.status).toBe(200)
    const member = (await body<{ data: { id: string; role: string } }>(invited)).data
    expect(member.role).toBe('VIEWER')

    const updated = await demoFetch(`/api/members/${member.id}`, {
      method: 'PATCH',
      body: { role: 'STAFF' },
    })
    expect(updated.status).toBe(200)
    expect((await body<{ data: { role: string } }>(updated)).data.role).toBe('STAFF')

    const removed = await demoFetch(`/api/members/${member.id}`, { method: 'DELETE' })
    expect(removed.status).toBe(200)

    const list = await demoFetch('/api/members')
    const payload = await body<{ data: { email: string }[] }>(list)
    expect(payload.data.some((item) => item.email === 'admin@technusa.example')).toBe(false)
  })

  it('rejects staff management and duplicate invitations', async () => {
    await signIn('dewi@technusa.example')
    const forbidden = await demoFetch('/api/members', {
      method: 'POST',
      body: { email: 'admin@technusa.example', role: 'STAFF' },
    })
    expect(forbidden.status).toBe(403)

    await signIn('farid@technusa.example')
    const duplicate = await demoFetch('/api/members', {
      method: 'POST',
      body: { email: 'dewi@technusa.example', role: 'STAFF' },
    })
    expect(duplicate.status).toBe(409)
  })
})

describe('demo API — report pagination', () => {
  beforeEach(() => resetDemoState({ signedIn: true }))

  it('paginates the movement report and reports the filtered total', async () => {
    const first = await demoFetch('/api/reports/movements?page=1&perPage=5')
    const second = await demoFetch('/api/reports/movements?page=2&perPage=5')
    const firstBody = await body<{
      data: { id: string }[]
      pagination: { page: number; perPage: number; total: number }
    }>(first)
    const secondBody = await body<{
      data: { id: string }[]
      pagination: { page: number; perPage: number; total: number }
    }>(second)

    expect(firstBody.pagination.page).toBe(1)
    expect(firstBody.pagination.perPage).toBe(5)
    expect(firstBody.pagination.total).toBeGreaterThan(5)
    expect(firstBody.data).toHaveLength(5)
    expect(secondBody.pagination.page).toBe(2)
    expect(secondBody.data[0]?.id).not.toBe(firstBody.data[0]?.id)
  })
})

describe('demo API — product CRUD', () => {
  beforeEach(() => resetDemoState({ signedIn: false }))

  it('creates and updates a product as an owner', async () => {
    await signIn('farid@technusa.example')

    const created = await demoFetch('/api/products', {
      method: 'POST',
      body: {
        sku: 'SKU-DEMO-1',
        name: 'Produk Demo Baru',
        unit: 'pcs',
        costPrice: 15000,
        reorderThreshold: 3,
        active: true,
      },
    })
    expect(created.status).toBe(200)
    const product = (await body<{ data: { id: string; totalQuantity: number } }>(created)).data
    expect(product.totalQuantity).toBe(0)

    const detail = await demoFetch(`/api/products/${product.id}`)
    expect(detail.status).toBe(200)
    expect((await body<{ data: { name: string } }>(detail)).data.name).toBe('Produk Demo Baru')

    const updated = await demoFetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      body: { name: 'Produk Demo Diubah', costPrice: 20000 },
    })
    expect(updated.status).toBe(200)
    const updatedProduct = (await body<{ data: { name: string; costPrice: number } }>(updated)).data
    expect(updatedProduct.name).toBe('Produk Demo Diubah')
    expect(updatedProduct.costPrice).toBe(20000)

    const duplicate = await demoFetch('/api/products', {
      method: 'POST',
      body: { sku: 'SKU-DEMO-1', name: 'Duplikat', unit: 'pcs' },
    })
    expect(duplicate.status).toBe(409)
  })

  it('rejects product writes from staff', async () => {
    await signIn('dewi@technusa.example')
    const response = await demoFetch('/api/products', {
      method: 'POST',
      body: { sku: 'SKU-STAFF', name: 'Tidak Boleh', unit: 'pcs' },
    })
    expect(response.status).toBe(403)
  })
})
