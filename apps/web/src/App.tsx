import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { WarehousePage } from '@/pages/WarehousePage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/products/new" element={<Navigate to="/inventory" replace />} />
          <Route path="/inventory/products/:id" element={<ProductDetailPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/transactions/stock-in" element={<TransactionsPage initialTab="IN" />} />
          <Route path="/transactions/stock-out" element={<TransactionsPage initialTab="OUT" />} />
          <Route
            path="/transactions/transfers"
            element={<TransactionsPage initialTab="TRANSFER" />}
          />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Outlet />
    </BrowserRouter>
  )
}
