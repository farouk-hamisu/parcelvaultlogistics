import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, X, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSiteSettings } from '../../hooks/useSiteSettings'
import { ContactSupportButton } from '../support/live-chat'

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Track', to: '/track' },
  { label: 'Services', to: '/services' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { settings } = useSiteSettings()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="sticky top-0 z-50">
      <div className="hidden lg:block bg-navy text-white">
        <div className="mx-auto max-w-[1320px] px-6 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              {settings.business_hours || 'Mon – Fri: 08:00 – 18:00'}
            </span>
            <span className="inline-flex items-center gap-2 text-white/70">
              <MapPinSmall /> {settings.contact_address || '1801 Main Street, Kansas City, MO 64108, United States'}
            </span>
            <ContactSupportButton
              variant="onDark"
              size="sm"
              className="!px-3 !py-1 !text-[11px] !rounded-pill"
            />
          </div>
          <div className="flex items-center gap-5">
            <Socials />
            <Link to="/quote" className="rounded-pill bg-primary px-4 py-1.5 font-semibold text-navy transition hover:bg-[#0898A0]">Request Quote</Link>
          </div>
        </div>
      </div>

      <div className={cn('bg-surface transition-all duration-300', scrolled ? 'shadow-[0_12px_32px_-20px_rgba(5,45,75,0.18)]' : '')}>
        <div className="mx-auto max-w-[1320px] px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center group" aria-label="ParcelVault Logistics home">
            <LogoMark />
          </Link>

          <nav className="hidden lg:flex items-center gap-9">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} className="text-sm font-semibold text-ocean-blue hover:text-navy transition relative group">
                {l.label}
                <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/track" className="hidden md:inline-flex items-center gap-2 rounded-[14px] bg-primary px-5 py-2.5 text-sm font-semibold text-navy hover:bg-[#0898A0] transition shadow-[0_8px_24px_-8px_rgba(5,163,170,0.5)]">
              Track Shipment <ChevronRight className="size-4" />
            </Link>
            <button className="lg:hidden inline-flex items-center justify-center size-10 rounded-full text-navy hover:bg-background" onClick={() => setOpen(v => !v)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className={cn('lg:hidden bg-surface border-t border-border overflow-hidden transition-all duration-300', open ? 'max-h-[420px]' : 'max-h-0')}>
        <div className="px-6 py-5 space-y-2">
          {[...navLinks, { label: 'Quote', to: '/quote' }].map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="flex items-center justify-between py-2.5 text-sm font-semibold text-ocean-blue">
              {l.label}
              <ChevronRight className="size-4 text-primary-dark" />
            </Link>
          ))}
          <hr className="my-3 border-border" />
          <Link to="/track" onClick={() => setOpen(false)} className="rounded-pill bg-primary px-4 py-2.5 text-center text-sm font-semibold text-navy">Track Shipment</Link>
        </div>
      </div>
    </header>
  )
}

export function LogoMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="grid size-10 sm:size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-[0_8px_20px_-8px_rgba(5,163,170,0.7)] ring-1 ring-navy/10">
        <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 sm:size-8" fill="none">
          <path d="M7 25V7h8.2c4 0 6.6 2.2 6.6 5.9 0 3.7-2.6 5.9-6.6 5.9h-3.7V25H7Zm4.5-8.9h3.1c1.4 0 2.2-.7 2.2-1.9s-.8-1.9-2.2-1.9h-3.1v3.8Z" fill="white"/>
          <path d="m17 25.8 6.7-7-2.5-2.5-4.2 4.2 2.5 2.5-2.5 2.8" stroke="#7FD7DB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className={cn('whitespace-nowrap text-[15px] sm:text-lg font-extrabold tracking-tight', onDark ? 'text-white' : 'text-navy')}>
          ParcelVault
        </span>
        <span className={cn('mt-1 whitespace-nowrap text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.26em]', onDark ? 'text-primary-light' : 'text-primary-dark')}>
          Logistics
        </span>
      </span>
    </span>
  )
}

function Socials() {
  return (
    <div className="flex items-center gap-3 text-dtl-white/60">
      {['F','X','in','IG'].map(s => (
        <a key={s} href="#" aria-label={s} className="grid size-7 place-items-center rounded-full text-[10px] font-bold text-dtl-white/50 hover:bg-white/10 hover:text-white transition">{s}</a>
      ))}
    </div>
  )
}

function MapPinSmall() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  )
}
