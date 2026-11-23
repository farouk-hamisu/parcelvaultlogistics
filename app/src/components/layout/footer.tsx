import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { MapPin, ArrowRight, Headphones } from 'lucide-react'
import { LogoMark } from './header'
import { Spinner } from '../ui/primitives'
import { ContactSupportButton } from '../support/live-chat'
import { useSiteSettings } from '../../hooks/useSiteSettings'
import { PublicApi } from '../../lib/api'

export function Footer() {
  const { settings } = useSiteSettings()
  const year = new Date().getFullYear()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  async function submitNewsletter(e: React.FormEvent) {
    e.preventDefault()
    if (!newsletterEmail.trim()) return
    setNewsletterStatus('sending')
    try {
      await PublicApi.newsletter({ email: newsletterEmail.trim() })
      setNewsletterStatus('ok')
      setNewsletterEmail('')
    } catch {
      setNewsletterStatus('error')
    }
  }

  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-[1320px] px-6 pt-16 pb-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <LogoMark className="h-16" onDark />
            <p className="mt-5 text-sm leading-relaxed text-white/70 max-w-sm">
              Premium international shipping with end-to-end visibility, live tracking, and dedicated customs handling across 190+ countries.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Air','Sea','Road','Customs'].map(t => (
                <span key={t} className="rounded-pill bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs font-semibold text-white/80">{t}</span>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-light">Company</p>
            <ul className="mt-4 space-y-2 text-sm text-white/80">
              {['About','Services','Track','Gallery','Contact'].map(l => (
                <li key={l}><Link to={`/${l.toLowerCase()}`} className="hover:text-white transition">{l}</Link></li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-light">Account</p>
            <ul className="mt-4 space-y-2 text-sm text-white/80">
              <li><Link to="/track" className="hover:text-white transition">Track shipment</Link></li>
              <li><Link to="/quote" className="hover:text-white transition">Request a quote</Link></li>
              <li><Link to="/contact" className="hover:text-white transition">Send a message</Link></li>
              <li><Link to="/admin/login" className="hover:text-white transition">Staff sign in</Link></li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-light">Get in touch</p>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-3 break-words"><MapPin className="size-4 mt-0.5 text-primary-light shrink-0" /> <span>{settings.contact_address || '1801 Main Street, Kansas City, MO 64108, United States'}</span></li>
              <li className="flex items-start gap-3 text-white/70">
                <Headphones className="size-4 mt-0.5 text-primary-light shrink-0" />
                <span>Live chat with our dispatch desk — fastest way to reach us.</span>
              </li>
            </ul>
            <ContactSupportButton variant="onDark" size="sm" className="mt-5" fullWidth />
            <form className="mt-5 flex gap-2" onSubmit={submitNewsletter}>
              <input
                type="email" placeholder="Get dispatch updates" required
                value={newsletterEmail}
                onChange={e => setNewsletterEmail(e.target.value)}
                className="flex-1 min-w-0 rounded-[14px] bg-white/5 ring-1 ring-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button aria-label="Subscribe to dispatch updates" disabled={newsletterStatus === 'sending'} className="rounded-[14px] bg-primary px-4 py-2.5 text-navy hover:bg-[#0898A0] transition disabled:opacity-60">
                {newsletterStatus === 'sending' ? <Spinner className="size-4 border-navy/40 border-t-navy" /> : <ArrowRight className="size-4" />}
              </button>
            </form>
            {newsletterStatus === 'ok' && <p className="mt-2 text-xs font-semibold text-primary-light">You’re subscribed. Watch your inbox.</p>}
            {newsletterStatus === 'error' && <p className="mt-2 text-xs font-semibold text-danger">Could not subscribe. Please try again.</p>}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <p>© {year} ParcelVault Logistics. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
            <a href="#" className="hover:text-white">Customs</a>
            <a href="#" className="hover:text-white">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  )
}