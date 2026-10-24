import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { Header } from '@/components/layout/Header'
import { Sidebar, SidebarMobile } from '@/components/layout/Sidebar'

/** Responsive application shell: fixed sidebar on desktop, off-canvas on mobile. */
export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Lompat ke konten utama
      </a>
      <Sidebar />
      <SidebarMobile open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
