import { Outlet, useLocation } from '@tanstack/react-router'
import { Suspense, useEffect } from 'react'
import { Header } from './header'
import { Footer } from './footer'

const TITLES: Record<string, string> = {
  '/': 'Premium International Shipping & Logistics',
  '/track': 'Track Shipment',
  '/services': 'Freight Services',
  '/about': 'About Us',
  '/gallery': 'Gallery',
  '/contact': 'Contact',
  '/quote': 'Request a Quote',
  '/login': 'Sign In',
  '/register': 'Create an Account',
  '/dashboard': 'Customer Dashboard',
  '/admin/login': 'Admin Login',
}

export function RootLayout() {
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname
    const key = path.startsWith('/admin') && path !== '/admin/login'
      ? '/admin'
      : path.startsWith('/track/')
        ? '/track'
        : path
    const page = key === '/admin' ? 'Admin Dashboard' : TITLES[key]
    document.title = page ? `${page} — ParcelVault Logistics` : 'ParcelVault Logistics'
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Suspense fallback={
          <div className="grid place-items-center gap-4 min-h-[40vh] py-20">
            <p className="text-lg font-extrabold tracking-tight text-navy animate-pulse">ParcelVault Logistics</p>
            <span className="inline-block size-6 rounded-full border-2 border-border border-t-primary animate-spin" />
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
