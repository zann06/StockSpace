import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from '@/App'
import { LocationList } from '@/components/warehouse/LocationList'
import { balances, locations, products } from '@/mocks/warehouse-data'
import { isWebGLAvailable } from '@/lib/webgl'

describe('LocationList (accessibility fallback)', () => {
  it('renders every location with its status and quantity', () => {
    render(
      <LocationList
        locations={locations}
        balances={balances}
        products={products}
        selectedLocationId={null}
        onSelect={() => {}}
      />
    )
    for (const location of locations) {
      expect(screen.getByRole('button', { name: new RegExp(location.label) })).toBeInTheDocument()
    }
    expect(screen.getAllByText('Kosong').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Menipis').length).toBeGreaterThan(0)
  })

  it('toggles selection when a location is clicked', async () => {
    const user = userEvent.setup()
    let selected: string | null = null
    render(
      <LocationList
        locations={locations}
        balances={balances}
        products={products}
        selectedLocationId={selected}
        onSelect={(id) => {
          selected = id
        }}
      />
    )
    await user.click(screen.getByRole('button', { name: /Rak A1/ }))
    expect(selected).toBe(locations[0].id)
  })
})

describe('App shell routing', () => {
  it('lands on the dashboard with KPI cards and demo badge', async () => {
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    expect(within(sidebar).getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()
    expect(await screen.findByText('Total Stok')).toBeInTheDocument()
    expect(screen.getAllByText(/Mode Demo/).length).toBeGreaterThan(0)
    expect(screen.getByText('Stok Minimum')).toBeInTheDocument()
    expect(screen.getByText('Produk Terlaris')).toBeInTheDocument()
    expect(screen.getByText('Pergerakan Stok')).toBeInTheDocument()
  })

  it('navigates to inventory and shows the product table', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Inventaris/ }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Laptop ASUS TUF F15')).toBeInTheDocument()
  })

  it('navigates to transactions with filter tabs', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Transaksi/ }))
    expect(await screen.findByRole('tab', { name: 'Barang Masuk' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Barang Masuk' }))
    expect(screen.getAllByText('Masuk').length).toBeGreaterThan(0)
    expect(screen.queryByText('Transfer')).not.toBeNull()
  })

  it('navigates to reports and settings placeholders with phase labels', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Laporan/ }))
    expect(await screen.findByText('Laporan Pergerakan Stok')).toBeInTheDocument()
    expect(screen.getAllByText('Fase 4').length).toBeGreaterThan(0)

    await user.click(within(sidebar).getByRole('link', { name: /Pengaturan/ }))
    expect(await screen.findByText('Workspace')).toBeInTheDocument()
  })

  it('shows a 404 page for unknown routes', () => {
    window.history.pushState({}, '', '/does-not-exist')
    render(<App />)
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders the WebGL list fallback when WebGL is unavailable', () => {
    window.history.pushState({}, '', '/dashboard')
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = () => null
    try {
      expect(isWebGLAvailable()).toBe(false)
      render(<App />)
      // The dashboard still renders (KPIs + fallback list instead of the canvas)
      expect(screen.getByText('Total Stok')).toBeInTheDocument()
      expect(screen.getAllByText('Rak A1').length).toBeGreaterThan(0)
    } finally {
      HTMLCanvasElement.prototype.getContext = original
    }
  })
})
