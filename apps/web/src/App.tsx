import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { useSession } from '@/api/auth'
import { I18nProvider } from '@/i18n'
import { WorkspaceProvider } from '@/api/workspace-provider'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { WarehousePage } from '@/pages/WarehousePage'
import { useI18n } from '@/i18n'

/** One client per app instance (keeps test renders isolated). */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 15_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function FullPageLoading() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-sm font-semibold text-muted">{t('Memuat StockSpace…')}</p>
    </div>
  )
}

/** Redirects unauthenticated visitors to /login and boots the workspace context. */
function RequireAuth() {
  const sessionQuery = useSession()
  const location = useLocation()

  if (sessionQuery.isLoading) return <FullPageLoading />
  if (sessionQuery.error || !sessionQuery.data?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  )
}

function GuestOnly({ children }: { children: ReactNode }) {
  const sessionQuery = useSession()
  if (sessionQuery.isLoading) return <FullPageLoading />
  if (sessionQuery.data?.user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route
              path="/login"
              element={
                <GuestOnly>
                  <LoginPage />
                </GuestOnly>
              }
            />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/warehouse" element={<WarehousePage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route
                  path="/inventory/products/new"
                  element={<Navigate to="/inventory" replace />}
                />
                <Route path="/inventory/products/:id" element={<ProductDetailPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route
                  path="/transactions/stock-in"
                  element={<TransactionsPage initialTab="IN" />}
                />
                <Route
                  path="/transactions/stock-out"
                  element={<TransactionsPage initialTab="OUT" />}
                />
                <Route
                  path="/transactions/transfers"
                  element={<TransactionsPage initialTab="TRANSFER" />}
                />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}
