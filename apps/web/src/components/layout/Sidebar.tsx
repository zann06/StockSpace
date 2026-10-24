import { useEffect, useRef } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  Settings,
  X,
} from 'lucide-react'

import { useDismiss } from '@/lib/hooks'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/warehouse', label: 'Warehouse 3D', icon: Boxes },
  { to: '/inventory', label: 'Inventaris', icon: Package },
  { to: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { to: '/reports', label: 'Laporan', icon: BarChart3 },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]

function SidebarLogo() {
  return (
    <Link
      to="/dashboard"
      className="flex items-center gap-2.5 px-2 py-1"
      aria-label="StockSpace — ke Dashboard"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
        <Boxes aria-hidden className="h-5 w-5 text-white" />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-ink">StockSpace</span>
    </Link>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? 'bg-primary-soft text-primary'
                : 'text-muted hover:bg-canvas hover:text-ink'
            }`
          }
        >
          <item.icon aria-hidden className="h-[18px] w-[18px]" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Original inline illustration — three isometric cubes, no external assets. */
function PromoIllustration() {
  return (
    <svg
      viewBox="0 0 120 76"
      role="img"
      aria-label="Ilustrasi kubus isometrik"
      className="h-auto w-full"
    >
      <g>
        <polygon points="30,34 46,26 62,34 46,42" fill="#8b74f9" />
        <polygon points="30,34 46,42 46,58 30,50" fill="#6d55f7" />
        <polygon points="62,34 46,42 46,58 62,50" fill="#5540d0" />
        <polygon points="58,22 74,14 90,22 74,30" fill="#a695fb" />
        <polygon points="58,22 74,30 74,46 58,38" fill="#8b74f9" />
        <polygon points="90,22 74,30 74,46 90,38" fill="#6d55f7" />
        <polygon points="44,50 60,42 76,50 60,58" fill="#8b74f9" />
        <polygon points="44,50 60,58 60,72 44,64" fill="#6d55f7" />
        <polygon points="76,50 60,58 60,72 76,64" fill="#5540d0" />
      </g>
    </svg>
  )
}

function SidebarPromo() {
  return (
    <div className="rounded-card bg-primary-soft p-4">
      <PromoIllustration />
      <p className="mt-2 text-sm font-bold text-ink">Smarter Inventory, Better Business</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Kelola stok, lokasi, dan laporan gudang Anda dalam satu tempat.
      </p>
      <button
        type="button"
        disabled
        title="Fitur opsional — StockSpace adalah MVP open-source dan belum memiliki paket berbayar."
        className="mt-3 w-full rounded-control bg-primary/50 px-3 py-2 text-xs font-bold text-white cursor-not-allowed"
      >
        Upgrade Pro
      </button>
    </div>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <SidebarLogo />
      <SidebarNav onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-3">
        <SidebarPromo />
        <p className="px-1 text-[11px] text-muted">v0.1.0 · MVP · Mode Demo</p>
      </div>
    </div>
  )
}

/** Desktop sidebar — fixed, hidden below the lg breakpoint. */
export function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 z-40 hidden h-screen w-64 border-r border-line bg-surface lg:block">
      <SidebarBody />
    </aside>
  )
}

interface SidebarMobileProps {
  open: boolean
  onClose: () => void
}

/** Mobile off-canvas navigation with overlay, Escape-to-close, and autofocus. */
export function SidebarMobile({ open, onClose }: SidebarMobileProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDismiss(panelRef, onClose, open)

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLButtonElement>('button[type="button"]')?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu navigasi"
    >
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className="absolute top-0 left-0 h-full w-72 border-r border-line bg-surface shadow-xl"
      >
        <div className="flex justify-end p-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="h-[calc(100%-3.25rem)]">
          <SidebarBody onNavigate={onClose} />
        </div>
      </div>
    </div>
  )
}
