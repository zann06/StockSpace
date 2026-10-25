import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Menu, Package, Search, Settings, Warehouse } from 'lucide-react'

import { useSession, useSignOut } from '@/api/auth'
import {
  useNotifications,
  useProductsList,
  useMarkNotificationRead,
  useWarehouseData,
} from '@/api/hooks'
import { useWorkspace } from '@/api/workspace-context'
import { useI18n } from '@/i18n'
import { Badge } from '@/components/ui/Badge'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'
import { useDismiss } from '@/lib/hooks'

function GlobalSearch() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useDismiss(containerRef, () => setOpen(false), open)

  const productsQuery = useProductsList()
  const { locations } = useWarehouseData()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return { products: [], locations: [] }
    return {
      products: (productsQuery.data?.data ?? [])
        .filter(
          (product) =>
            product.name.toLowerCase().includes(q) ||
            product.sku.toLowerCase().includes(q) ||
            (product.barcode ?? '').includes(q)
        )
        .slice(0, 4),
      locations: locations
        .filter(
          (location) =>
            location.code.toLowerCase().includes(q) || location.label.toLowerCase().includes(q)
        )
        .slice(0, 3),
    }
  }, [query, productsQuery.data, locations])

  const hasResults = results.products.length > 0 || results.locations.length > 0

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          if (query.trim()) {
            navigate(`/inventory?q=${encodeURIComponent(query.trim())}`)
            setOpen(false)
          }
        }}
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('Cari produk, rak, atau kode barang…')}
          aria-label={t('Cari produk, rak, atau kode barang')}
          className="h-10 w-full rounded-control border border-line bg-surface pr-3.5 pl-10 text-sm text-ink placeholder:text-muted/70"
        />
      </form>

      {open && query.trim().length >= 1 ? (
        <div className="absolute top-12 left-0 z-40 w-full overflow-hidden rounded-card border border-line bg-surface shadow-lg">
          {!hasResults ? (
            <p className="px-4 py-3 text-xs text-muted">
              {t('Tidak ada hasil untuk')} “{query}”.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto scroll-slim py-1.5">
              {results.products.length > 0 ? (
                <p className="px-4 py-1 text-[11px] font-bold tracking-wide text-muted uppercase">
                  {t('Produk')}
                </p>
              ) : null}
              {results.products.map((product) => (
                <Link
                  key={product.id}
                  to={`/inventory/products/${product.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-canvas"
                >
                  <Package aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {product.name}
                    </span>
                    <span className="block text-xs text-muted">{product.sku}</span>
                  </span>
                </Link>
              ))}
              {results.locations.length > 0 ? (
                <p className="px-4 py-1 pt-2 text-[11px] font-bold tracking-wide text-muted uppercase">
                  {t('Lokasi')}
                </p>
              ) : null}
              {results.locations.map((location) => (
                <Link
                  key={location.id}
                  to={`/warehouse?loc=${location.code}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-canvas"
                >
                  <Warehouse aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {location.label}
                    </span>
                    <span className="block text-xs text-muted">{location.code}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function NotificationBell() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useDismiss(containerRef, () => setOpen(false), open)
  const notificationsQuery = useNotifications()
  const markRead = useMarkNotificationRead()

  const notifications = notificationsQuery.data?.data ?? []
  const unread = notificationsQuery.data?.unread ?? 0

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-control border border-line bg-surface text-muted hover:bg-canvas hover:text-ink"
      >
        <Bell aria-hidden className="h-[18px] w-[18px]" />
        <span className="sr-only">{t('Notifikasi')}</span>
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute top-12 right-0 z-40 w-80 overflow-hidden rounded-card border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">{t('Notifikasi')}</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => {
                  notifications
                    .filter((item) => item.readAt === null)
                    .forEach((item) => markRead.mutate(item.id))
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t('Tandai dibaca')}
              </button>
            ) : null}
          </div>
          <div className="max-h-72 overflow-y-auto scroll-slim">
            {notificationsQuery.isLoading ? (
              <p className="px-4 py-4 text-xs font-semibold text-muted">
                {t('Memuat notifikasi…')}
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted">{t('Belum ada notifikasi.')}</p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 border-t border-line/70 px-4 py-2.5 first:border-t-0"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-line' : 'bg-primary'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    {item.body ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.body}</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  STAFF: 'Staf Gudang',
  VIEWER: 'Viewer',
}

function ProfileMenu() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useDismiss(containerRef, () => setOpen(false), open)
  const { workspace } = useWorkspace()
  const { data: sessionData } = useSession()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const user = sessionData?.user

  const roleLabel = workspace?.role ? t(ROLE_LABEL[workspace.role] ?? workspace.role) : ''

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-control border border-line bg-surface p-1 pr-2 hover:bg-canvas"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-xs font-bold text-white"
        >
          {user ? user.name.slice(0, 2).toUpperCase() : '··'}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[120px] truncate text-xs font-bold text-ink">
            {user?.name ?? t('Memuat…')}
          </span>
          <span className="block text-[11px] text-muted">{roleLabel}</span>
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 text-muted" />
        <span className="sr-only">{t('buka menu pengguna')}</span>
      </button>

      {open ? (
        <div className="absolute top-12 right-0 z-40 w-64 overflow-hidden rounded-card border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold text-ink">{user?.name ?? '—'}</p>
            <p className="truncate text-xs text-muted">{user?.email ?? ''}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {workspace?.role ? <Badge tone="primary">{roleLabel}</Badge> : null}
              {workspace ? <Badge>{workspace.name}</Badge> : null}
            </div>
            <div className="mt-3">
              <LanguageSwitch />
            </div>
          </div>
          <div className="p-1.5">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink"
            >
              <Settings aria-hidden className="h-4 w-4" /> {t('Pengaturan')}
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                signOut.mutate(undefined, {
                  onSuccess: () => navigate('/login', { replace: true }),
                })
              }}
              disabled={signOut.isPending}
              className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-semibold text-danger-fg hover:bg-danger-soft disabled:opacity-60"
            >
              <LogOut aria-hidden className="h-4 w-4" />{' '}
              {signOut.isPending ? t('Keluar…') : t('Keluar')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface HeaderProps {
  onOpenMobileNav: () => void
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 md:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label={t('Buka menu navigasi')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-surface text-muted hover:bg-surface hover:text-ink lg:hidden"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>

        <GlobalSearch />

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden md:block">
            <LanguageSwitch compact />
          </div>
          <NotificationBell />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}
