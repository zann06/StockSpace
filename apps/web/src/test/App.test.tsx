import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { LocationList } from '@/components/warehouse/LocationList'
import { balances, locations, products } from '@/mocks/warehouse-data'
import { isWebGLAvailable } from '@/lib/webgl'
import { installFetchStub } from './fetch-stub'

beforeEach(() => {
  installFetchStub()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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

describe('App shell routing (live API data flow)', () => {
  it('lands on the dashboard with KPI cards fed by the API', async () => {
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    expect(within(sidebar).getByRole('link', { name: /Dashboard/ })).toBeInTheDocument()

    expect(await screen.findByText('Total Stok')).toBeInTheDocument()
    expect(await screen.findByText('4.831')).toBeInTheDocument()
    expect(screen.getByText('Stok Menipis')).toBeInTheDocument()
    expect(screen.getByText('Produk Terlaris')).toBeInTheDocument()
    expect(screen.getByText('Pergerakan Stok')).toBeInTheDocument()
    expect(screen.getAllByText(/Data Seed Demo/).length).toBeGreaterThan(0)
  })

  it('navigates to inventory and shows products from the API', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Inventaris/ }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(await screen.findByText('Laptop ASUS TUF F15')).toBeInTheDocument()
  })

  it('filters the inventory table by search input', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Inventaris/ }))
    await screen.findByText('Laptop ASUS TUF F15')

    const search = screen.getByRole('textbox', { name: 'Cari produk' })
    await user.clear(search)
    await user.type(search, 'laptop')
    expect(await screen.findByText('Laptop ASUS TUF F15')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Kertas HVS A4 80gsm')).not.toBeInTheDocument())
  })

  it('shows the stock-in form and records a movement through the API', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/transactions/stock-in')
    render(<App />)

    const productSelect = await screen.findByRole('combobox', { name: /Produk/ })
    await user.selectOptions(productSelect, 'p-01')

    const destinationSelect = await screen.findByRole('combobox', { name: /Lokasi Tujuan/ })
    await user.selectOptions(destinationSelect, 'loc-a1')

    await user.type(screen.getByRole('spinbutton', { name: /^Jumlah/ }), '5')

    const submit = screen.getByRole('button', { name: 'Catat Barang Masuk' })
    await user.click(submit)

    await waitFor(() => expect(screen.getByText(/Transaksi berhasil dicatat/)).toBeInTheDocument())
  })

  it('rejects a stock-out that exceeds the available balance', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/transactions/stock-out')
    render(<App />)

    const productSelect = await screen.findByRole('combobox', { name: /Produk/ })
    await user.selectOptions(productSelect, 'p-01')

    const sourceSelect = await screen.findByRole('combobox', { name: /Lokasi Sumber/ })
    await user.selectOptions(sourceSelect, 'loc-a1')

    await user.type(screen.getByRole('spinbutton', { name: /^Jumlah/ }), '999')
    await user.click(screen.getByRole('button', { name: 'Catat Barang Keluar' }))

    await waitFor(() => expect(screen.getByText(/Stok tidak cukup/)).toBeInTheDocument())
  })

  it('navigates to reports with live low-stock and utilization data', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = screen.getByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Laporan/ }))
    expect(await screen.findByText('Laporan Stok Menipis')).toBeInTheDocument()
    expect(await screen.findByText('Inventaris per Lokasi')).toBeInTheDocument()
    expect(screen.getAllByText(/Fase 4/).length).toBeGreaterThan(0)
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
      expect(screen.getByText('Total Stok')).toBeInTheDocument()
      expect(screen.getAllByText('Rak A1').length).toBeGreaterThan(0)
    } finally {
      HTMLCanvasElement.prototype.getContext = original
    }
  })
})
