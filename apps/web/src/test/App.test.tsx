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
    const sidebar = await screen.findByRole('navigation', { name: 'Navigasi utama' })
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
    const sidebar = await screen.findByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Inventaris/ }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(await screen.findByText('Laptop ASUS TUF F15')).toBeInTheDocument()
  })

  it('filters the inventory table by search input', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = await screen.findByRole('navigation', { name: 'Navigasi utama' })
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

    await screen.findByRole('option', { name: /Laptop ASUS TUF/ })
    const productSelect = screen.getByRole('combobox', { name: /Produk/ })
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

    await screen.findByRole('option', { name: /Laptop ASUS TUF/ })
    const productSelect = screen.getByRole('combobox', { name: /Produk/ })
    await user.selectOptions(productSelect, 'p-01')

    const sourceSelect = await screen.findByRole('combobox', { name: /Lokasi Sumber/ })
    await user.selectOptions(sourceSelect, 'loc-a1')

    await user.type(screen.getByRole('spinbutton', { name: /^Jumlah/ }), '999')
    await user.click(screen.getByRole('button', { name: 'Catat Barang Keluar' }))

    await waitFor(() => expect(screen.getByText(/Stok tidak cukup/)).toBeInTheDocument())
  })

  it('navigates to reports with live data, filters, and CSV export', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sidebar = await screen.findByRole('navigation', { name: 'Navigasi utama' })
    await user.click(within(sidebar).getByRole('link', { name: /Laporan/ }))
    expect(await screen.findByText('Laporan Stok Menipis')).toBeInTheDocument()
    expect(await screen.findByText('Laporan Pergerakan Stok')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CSV Stok Menipis/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CSV Pergerakan/ })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown routes', async () => {
    window.history.pushState({}, '', '/does-not-exist')
    render(<App />)
    expect(await screen.findByText('404')).toBeInTheDocument()
  })

  it('renders the WebGL list fallback when WebGL is unavailable', async () => {
    window.history.pushState({}, '', '/dashboard')
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = () => null
    try {
      expect(isWebGLAvailable()).toBe(false)
      render(<App />)
      expect(await screen.findByText('Total Stok')).toBeInTheDocument()
      expect((await screen.findAllByText('Rak A1')).length).toBeGreaterThan(0)
    } finally {
      HTMLCanvasElement.prototype.getContext = original
    }
  })
})

describe('authentication (web)', () => {
  it('shows the login page and signs in with valid demo credentials', async () => {
    const user = userEvent.setup()
    installFetchStub({ session: false })
    window.history.pushState({}, '', '/login')
    render(<App />)

    const emailInput = await screen.findByLabelText(/Email/)
    await user.type(emailInput, 'farid@technusa.example')
    await user.type(screen.getByLabelText(/Password/), 'stockspace-demo')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(await screen.findByText('Total Stok')).toBeInTheDocument()
  })

  it('rejects wrong credentials with a readable error', async () => {
    const user = userEvent.setup()
    installFetchStub({ session: false })
    window.history.pushState({}, '', '/login')
    render(<App />)

    const emailInput = await screen.findByLabelText(/Email/)
    await user.type(emailInput, 'farid@technusa.example')
    await user.type(screen.getByLabelText(/Password/), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(await screen.findByText(/Email atau password salah/)).toBeInTheDocument()
  })

  it('redirects unauthenticated visitors to the login page', async () => {
    installFetchStub({ session: false })
    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    expect(await screen.findByText('Masuk untuk mengelola inventaris Anda')).toBeInTheDocument()
  })

  it('shows the signed-in user in the profile menu and signs out', async () => {
    const user = userEvent.setup()
    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    expect(await screen.findByText('Total Stok')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Menu pengguna' }))
    const menu = screen.getByRole('button', { name: 'Menu pengguna' }).parentElement!
    const logout = within(menu).getByRole('button', { name: 'Keluar' })
    await user.click(logout)

    // Session cleared → back to the login page.
    expect(await screen.findByText('Masuk untuk mengelola inventaris Anda')).toBeInTheDocument()
  })
})
